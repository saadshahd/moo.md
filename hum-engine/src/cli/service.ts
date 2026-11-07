import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import { join } from "node:path";
import { type Command, InvalidArgumentError, Option } from "commander";
import { z } from "zod";
import { listHopeSkills } from "../config/load.ts";
import { readCiTick, recordCiTick } from "../service/ci-tick.ts";
import { EXIT_UPDATED, supervise } from "../service/supervise.ts";
import { reportCards, wakeUntilQuiet } from "../service/wake.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import { readStatus } from "../status/file.ts";
import { npmLatest, openWorker } from "../worker/open.ts";
import type { Io } from "./ops.ts";

/** How often the supervisor checks the worker's heartbeat. */
export const DEFAULT_INTERVAL_S = 30;

const whole = (text: string): number => {
	const n = Number(text);

	if (!Number.isInteger(n) || n <= 0) throw new InvalidArgumentError("a positive whole number");

	return n;
};

const collect = (value: string, seen: string[]): string[] => [...seen, value];

type WorkFlags = { kind?: string; check: string[]; holder?: string; base?: string };

/**
 * What a worker needs to know that no file in the repo says yet: its kind, and the checks a change must pass.
 * A unit or workflow sets them as HUM_KIND and HUM_CHECKS (a JSON array of commands), so its command line stays fixed.
 */
const withWorkOptions = (cmd: Command): Command =>
	cmd
		.addOption(new Option("--kind <name>", "the kind every item runs as").env("HUM_KIND"))
		.option("--check <command>", "a command the repo's checks run before a merge; repeat for more (HUM_CHECKS: a JSON array)", collect, [])
		.option("--holder <name>", "the name this worker claims items by; default <where>@<host>")
		.option("--base <branch>", "the branch items merge into; default main");

const PluginList = z.array(z.looseObject({ id: z.string(), installPath: z.string() }));

/** The folder of the installed hope plugin: `HUM_HOPE_ROOT`, else the path `claude plugin list` gives. */
const hopeRoot = (): string => {
	if (process.env.HUM_HOPE_ROOT) return process.env.HUM_HOPE_ROOT;

	const listed = spawnSync("claude", ["plugin", "list", "--json"], { encoding: "utf8" });
	const hope = listed.status === 0 ? PluginList.parse(JSON.parse(listed.stdout)).find((p) => p.id.startsWith("hope@")) : undefined;

	if (!hope) throw new Error("the hope plugin is not installed: run `claude plugin install hope@moo.md`, or set HUM_HOPE_ROOT to its folder");

	return hope.installPath;
};

/** HUM_CHECKS: a JSON array of check commands; unset is none. A value that is not that array fails loud. */
const envChecks = (): string[] => {
	const raw = process.env.HUM_CHECKS;

	if (!raw) return [];

	const parsed = z.array(z.string().min(1)).safeParse(JSON.parse(raw));

	if (!parsed.success) throw new Error("HUM_CHECKS must be a JSON array of commands, such as [\"bun test\"]");

	return parsed.data;
};

const openFor = (repo: string, flags: WorkFlags, where: "mac" | "ci") => {
	const checks = flags.check.length > 0 ? flags.check : envChecks();
	const kind = flags.kind;

	if (checks.length === 0) throw new Error("name at least one check: --check, or HUM_CHECKS as a JSON array of commands");

	if (!kind) throw new Error("name the kind: --kind, or HUM_KIND");

	return openWorker(repo, {
		hopeSkills: listHopeSkills(hopeRoot()),
		kind: () => kind,
		checks,
		holder: flags.holder ?? `${where}@${hostname()}`,
		base: flags.base,
		where,
		// The Mac reads the npm version and when the scheduled workflow last ran; a CI job is that workflow.
		latestVersion: where === "mac" ? npmLatest : undefined,
		ciTick: where === "mac" ? () => readCiTick(repo, "origin") : undefined,
	});
};

const onStop = (stop: () => void) => {
	for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, stop);
};

/**
 * `hum work`, `hum serve` and `hum wake`: the processes a service unit and a CI workflow start. They are not ops:
 * roles and machines never name them, so they stay out of the table `hum help --json` prints.
 */
export const addServiceCommands = (root: Command, io: Io, done: (code: number) => void): void => {
	withWorkOptions(root.command("work").description("Run the worker on this machine until it is stopped or an update arrives; exits 75 for an update."))
		.action(async (flags: WorkFlags) => {
			const abort = new AbortController();

			onStop(() => abort.abort());

			const worker = await openFor(io.cwd, flags, "mac");
			const ended = await worker.serve(abort.signal);

			io.stderr(`hum work: stopped, ${ended.reason}\n`);
			done(ended.reason === "stopped" ? 0 : EXIT_UPDATED);
		});

	root
		.command("serve")
		.description("The service unit's start script: run `hum work` with the arguments after `--`, start it again when it exits, and stop after too many crashes.")
		.option("--max-crashes <n>", "crashes within the window that stop the restarts", whole, 5)
		.option("--crash-window <minutes>", "the window for --max-crashes", whole, 10)
		.argument("[work-args...]", "options of `hum work`, after `--`")
		.action(async (workArgs: string[], flags: { maxCrashes: number; crashWindow: number }) => {
			const abort = new AbortController();
			const state = openState(defaultStateDir(io.cwd));

			onStop(() => abort.abort());

			const ended = await supervise({
				state,
				spawn: () => {
					const child = Bun.spawn([process.execPath, process.argv[1] ?? "", "work", ...workArgs], { cwd: io.cwd, stdin: "ignore", stdout: "inherit", stderr: "inherit" });

					return { exited: child.exited, kill: () => child.kill("SIGTERM") };
				},
				now: Date.now,
				sleep: (ms, cancel) =>
					new Promise((resolve) => {
						const timer = setTimeout(resolve, ms);

						cancel.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
					}),
				intervalMs: DEFAULT_INTERVAL_S * 1000,
				maxCrashes: flags.maxCrashes,
				crashWindowMs: flags.crashWindow * 60_000,
				backoffMs: 1000,
				stop: abort.signal,
			});

			// Gave up or stopped on request: either way the unit must not start this script again, so the exit is 0.
			io.stderr(`hum serve: ${ended}\n`);
			done(0);
		});

	withWorkOptions(root.command("wake").description("One CI wake: tick until nothing more starts, record the tick when --event is schedule, and show the cards."))
		.option("--event <name>", "the GitHub event that started this job")
		.action(async (flags: WorkFlags & { event?: string }) => {
			const worker = await openFor(io.cwd, flags, "ci");

			await wakeUntilQuiet(worker);

			if (flags.event === "schedule") await recordCiTick(io.cwd, "origin", Date.now());

			const status = readStatus(join(defaultStateDir(io.cwd), "status.json"));
			const cards = status.ok ? status.status.cards : [];

			reportCards(cards, io.stdout);
			done(cards.length > 0 ? 1 : 0);
		});
};
