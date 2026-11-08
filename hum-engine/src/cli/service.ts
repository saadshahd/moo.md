import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { type Command, Option } from "commander";
import { x } from "tinyexec";
import { z } from "zod";
import { listHopeSkills } from "../config/load.ts";
import { HumConfig } from "../config/schema.ts";
import { readCiTick, recordCiTick } from "../service/ci-tick.ts";
import { EXIT_UPDATED, supervise } from "../service/supervise.ts";
import { reportCards, wakeUntilQuiet } from "../service/wake.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import { readStatus } from "../status/file.ts";
import { npmLatest, openWorker } from "../worker/open.ts";
import type { Io } from "./ops.ts";

const SECOND_MS = 1000;

/** The pause before a supervised worker's first restart. */
const RESTART_BACKOFF_MS = SECOND_MS;

const EXIT_OK = 0;

/** The start script's exit code when it gave up or was stopped: the unit restarts a script only after a failure. */
const EXIT_STAY_DOWN = EXIT_OK;

const EXIT_CARDS_SHOWN = 1;

const SCHEDULE_EVENT = "schedule";

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
const hopeRoot = async (): Promise<string> => {
	if (process.env.HUM_HOPE_ROOT) return process.env.HUM_HOPE_ROOT;

	const listed = await x("claude", ["plugin", "list", "--json"]);
	const hope = listed.exitCode === 0 ? PluginList.parse(JSON.parse(listed.stdout)).find((plugin) => plugin.id.startsWith("hope@")) : undefined;

	if (!hope) throw new Error("the hope plugin is not installed: run `claude plugin install hope@moo.md`, or set HUM_HOPE_ROOT to its folder");

	return hope.installPath;
};

const ServiceSettings = z.looseObject({
	tickIntervalSeconds: HumConfig.shape.tickIntervalSeconds,
	workerDownTicks: HumConfig.shape.workerDownTicks,
	maxCrashes: HumConfig.shape.maxCrashes,
	crashWindowSeconds: HumConfig.shape.crashWindowSeconds,
});

/**
 * The settings the start script needs, with the shipped default for any it cannot read. A config the worker
 * refuses is the worker's to report: it exits, and the script counts the crash and shows the card.
 */
const serviceSettings = (repo: string): z.infer<typeof ServiceSettings> => {
	try {
		return ServiceSettings.parse(JSON.parse(readFileSync(join(repo, ".hum", "hum.json"), "utf8")));
	} catch {
		return ServiceSettings.parse({});
	}
};

/** HUM_CHECKS: a JSON array of check commands; unset is none. A value that is not that array fails loud. */
const envChecks = (): string[] => {
	const raw = process.env.HUM_CHECKS;

	if (!raw) return [];

	const parsed = z.array(z.string().min(1)).safeParse(JSON.parse(raw));

	if (!parsed.success) throw new Error("HUM_CHECKS must be a JSON array of commands, such as [\"bun test\"]");

	return parsed.data;
};

/** The Mac reads the npm version and when the scheduled workflow last ran; a CI job is that workflow. */
const openFor = async (repo: string, flags: WorkFlags, where: "mac" | "ci") => {
	const checks = flags.check.length > 0 ? flags.check : envChecks();
	const kind = flags.kind;

	if (checks.length === 0) throw new Error("name at least one check: --check, or HUM_CHECKS as a JSON array of commands");

	if (!kind) throw new Error("name the kind: --kind, or HUM_KIND");

	return openWorker(repo, {
		hopeSkills: listHopeSkills(await hopeRoot()),
		kind: () => kind,
		checks,
		holder: flags.holder ?? `${where}@${hostname()}`,
		base: flags.base,
		where,
		latestVersion: where === "mac" ? npmLatest : undefined,
		ciTick: where === "mac" ? () => readCiTick(repo, "origin") : undefined,
	});
};

const onStop = (stop: () => void) => {
	for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, stop);
};

/** `hum work` as a child process of this one, sharing its terminal. */
const spawnWorker = (cwd: string, workArgs: readonly string[]) => {
	const child = x(process.execPath, [process.argv[1] ?? "", "work", ...workArgs], { nodeOptions: { cwd, stdio: "inherit" } });

	return { exited: Promise.resolve(child).then(({ exitCode }) => exitCode ?? 1), kill: () => void child.kill("SIGTERM") };
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
			done(ended.reason === "stopped" ? EXIT_OK : EXIT_UPDATED);
		});

	root
		.command("serve")
		.description("The service unit's start script: run `hum work` with the arguments after `--`, start it again when it exits, and stop after too many crashes.")
		.argument("[work-args...]", "options of `hum work`, after `--`")
		.action(async (workArgs: string[]) => {
			const abort = new AbortController();
			const settings = serviceSettings(io.cwd);

			onStop(() => abort.abort());

			const ended = await supervise({
				state: openState(defaultStateDir(io.cwd)),
				spawn: () => spawnWorker(io.cwd, workArgs),
				now: Date.now,
				intervalMs: settings.tickIntervalSeconds * SECOND_MS,
				workerDownTicks: settings.workerDownTicks,
				maxCrashes: settings.maxCrashes,
				crashWindowMs: settings.crashWindowSeconds * SECOND_MS,
				backoffMs: RESTART_BACKOFF_MS,
				stop: abort.signal,
			});

			io.stderr(`hum serve: ${ended}\n`);
			done(EXIT_STAY_DOWN);
		});

	withWorkOptions(root.command("wake").description("One CI wake: tick until nothing more starts, record the tick when --event is schedule, and show the cards."))
		.option("--event <name>", "the GitHub event that started this job")
		.action(async (flags: WorkFlags & { event?: string }) => {
			const worker = await openFor(io.cwd, flags, "ci");

			await wakeUntilQuiet(worker);

			if (flags.event === SCHEDULE_EVENT) await recordCiTick(io.cwd, "origin", Date.now(), worker.config.hum.commitIdentity);

			const status = readStatus(join(defaultStateDir(io.cwd), "status.json"));
			const cards = status.ok ? status.status.cards : [];

			await reportCards(cards);
			done(cards.length > 0 ? EXIT_CARDS_SHOWN : EXIT_OK);
		});
};
