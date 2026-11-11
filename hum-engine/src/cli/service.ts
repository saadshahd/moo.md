import { hostname } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { x } from "tinyexec";
import { z } from "zod";
import { listHopeSkills } from "../config/load.ts";
import { HumConfig } from "../config/schema.ts";
import { readSettings } from "../config/settings.ts";
import { commandTimeoutMs, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { readCiTick, recordCiTick } from "../service/ci-tick.ts";
import { EXIT_UPDATED, supervise } from "../service/supervise.ts";
import { reportCards, wakeUntilQuiet } from "../service/wake.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import { readStatus } from "../status/file.ts";
import { npmLatest, openWorker } from "../worker/open.ts";
import type { Io } from "./ops.ts";

const EXIT_OK = 0;

/** The start script's exit code when it gave up or was stopped: the unit restarts a script only after a failure. */
const EXIT_STAY_DOWN = EXIT_OK;

const EXIT_CARDS_SHOWN = 1;

const SCHEDULE_EVENT = "schedule";

type WorkFlags = { holder?: string; base?: string };

/** What a worker needs to know that no file in the repo says: who it claims as, and where items merge. */
const withWorkOptions = (cmd: Command): Command =>
	cmd
		.option("--holder <name>", "the name this worker claims items by; default <where>@<host>")
		.option("--base <branch>", "the branch items merge into; default main");

const PluginList = z.array(z.looseObject({ id: z.string(), installPath: z.string() }));

/** The folder of the installed hope plugin: `HUM_HOPE_ROOT`, else the path `claude plugin list` gives. */
export const hopeRoot = async (): Promise<string> => {
	if (process.env.HUM_HOPE_ROOT) return process.env.HUM_HOPE_ROOT;

	const listed = await exec("claude", ["plugin", "list", "--json"], { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const hope = listed.exitCode === 0 ? PluginList.parse(JSON.parse(listed.stdout)).find((plugin) => plugin.id.startsWith("hope@")) : undefined;

	if (!hope) throw new Error("the hope plugin is not installed: run `claude plugin install hope@moo.md`, or set HUM_HOPE_ROOT to its folder");

	return hope.installPath;
};

const ServiceSettings = z.looseObject({
	tickIntervalSeconds: HumConfig.shape.tickIntervalSeconds,
	workerDownTicks: HumConfig.shape.workerDownTicks,
	maxCrashes: HumConfig.shape.maxCrashes,
	crashWindowSeconds: HumConfig.shape.crashWindowSeconds,
	restartBackoff: HumConfig.shape.restartBackoff,
	commandTimeoutSeconds: HumConfig.shape.commandTimeoutSeconds,
});

/**
 * The settings the start script needs, with the shipped default for any it cannot read. A config the worker
 * refuses is the worker's to report: it exits, and the script counts the crash and shows the card.
 */
const serviceSettings = (repo: string): z.infer<typeof ServiceSettings> => {
	try {
		return readSettings(repo, ServiceSettings);
	} catch {
		return ServiceSettings.parse({});
	}
};

/** The Mac reads the npm version and when the scheduled workflow last ran; a CI job is that workflow. */
const openFor = async (repo: string, flags: WorkFlags, where: "mac" | "ci") => {
	const timeoutMs = commandTimeoutMs(serviceSettings(repo));

	return openWorker(repo, {
		hopeSkills: listHopeSkills(await hopeRoot()),
		holder: flags.holder ?? `${where}@${hostname()}`,
		base: flags.base,
		where,
		latestVersion: where === "mac" ? npmLatest : undefined,
		ciTick: where === "mac" ? () => readCiTick(repo, "origin", timeoutMs) : undefined,
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
				state: openState(await defaultStateDir(io.cwd)),
				spawn: () => spawnWorker(io.cwd, workArgs),
				now: Date.now,
				intervalMs: settings.tickIntervalSeconds * SECOND_MS,
				workerDownTicks: settings.workerDownTicks,
				maxCrashes: settings.maxCrashes,
				crashWindowMs: settings.crashWindowSeconds * SECOND_MS,
				backoffMs: settings.restartBackoff.firstSeconds * SECOND_MS,
				maxBackoffMs: settings.restartBackoff.maxSeconds * SECOND_MS,
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

			if (flags.event === SCHEDULE_EVENT) await recordCiTick(io.cwd, "origin", Date.now(), worker.config.hum.commitIdentity, commandTimeoutMs(worker.config.hum));

			const status = readStatus(join(await defaultStateDir(io.cwd), "status.json"));
			const cards = status.ok ? status.status.cards : [];

			await reportCards(cards);
			done(cards.length > 0 ? EXIT_CARDS_SHOWN : EXIT_OK);
		});
};
