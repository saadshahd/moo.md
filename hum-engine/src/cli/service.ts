import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { x } from "tinyexec";
import { z } from "zod";
import { listPluginSkills } from "../config/load.ts";
import { HumConfig } from "../config/schema.ts";
import { readSettings } from "../config/settings.ts";
import { commandTimeoutMs, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { restoreCiState, saveCiState } from "../service/ci-state.ts";
import { readCiTick, recordCiTick } from "../service/ci-tick.ts";
import { EXIT_UPDATED, supervise } from "../service/supervise.ts";
import { installPlugins } from "../service/plugins.ts";
import { reportCards, wakeUntilQuiet } from "../service/wake.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import { readStatus } from "../status/file.ts";
import { npmLatest, openWorker } from "../worker/open.ts";
import type { Io } from "./ops.ts";
import { Holder } from "../adapter-api.ts";
import { parseArgument } from "../adapters/argument.ts";

const EXIT_OK = 0;

/** The start script's exit code when it gave up or was stopped: the unit restarts a script only after a failure. */
const EXIT_STAY_DOWN = EXIT_OK;

const EXIT_CARDS_SHOWN = 1;

const EXIT_FAILED = 1;

const SCHEDULE_EVENT = "schedule";

type WorkFlags = { holder?: string; base?: string };

/** What a worker needs to know that no file in the repo says: who it claims as, and where items merge. */
const withWorkOptions = (cmd: Command): Command =>
	cmd
		.option("--holder <name>", "the name this worker claims items by; default <where>@<host>")
		.option("--base <branch>", "the branch items merge into; default main");

const PluginList = z.array(z.looseObject({ id: z.string(), installPath: z.string(), enabled: z.boolean().default(true) }));

const HOPE = "hope";

/**
 * The skills of every enabled plugin, as a role names them (`sound:prime`), read from the folders `claude plugin list`
 * gives. `HUM_HOPE_ROOT` names hope's folder instead, and then hope's skills are all there is. hope must be there.
 */
export const installedSkills = async (): Promise<ReadonlySet<string>> => {
	if (process.env.HUM_HOPE_ROOT) return new Set(listPluginSkills(HOPE, process.env.HUM_HOPE_ROOT));

	const listed = await exec("claude", ["plugin", "list", "--json"], { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const plugins = listed.exitCode === 0 ? PluginList.parse(JSON.parse(listed.stdout)).filter(({ enabled }) => enabled).map(({ id, installPath }) => ({ name: id.split("@")[0] ?? id, installPath })) : [];

	if (!plugins.some(({ name }) => name === HOPE)) throw new Error("the hope plugin is not installed: run `claude plugin install hope@moo.md`, or set HUM_HOPE_ROOT to its folder");

	return new Set(plugins.flatMap(({ name, installPath }) => listPluginSkills(name, installPath)));
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
const openFor = async ({ cwd: repo, env }: Io, flags: WorkFlags, where: "mac" | "ci") => {
	const timeoutMs = commandTimeoutMs(serviceSettings(repo));

	return openWorker(repo, {
		now: Date.now,
		env,
		newSessionId: randomUUID,
		installedSkills: await installedSkills(),
		holder: parseArgument(Holder, flags.holder ?? `${where}@${hostname()}`),
		base: flags.base,
		where,
		latestVersion: where === "mac" ? npmLatest : undefined,
		ciTick: where === "mac" ? () => readCiTick({ repo, remote: "origin", timeoutMs }) : undefined,
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

			const worker = await openFor(io, flags, "mac");
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
				state: openState(await defaultStateDir(io.cwd), { now: Date.now }),
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

	root
		.command("plugins")
		.description("Install hope and the repo's own Claude Code plugins for a CI wake: moo.md at the commit this engine shipped with, then each marketplace and enabled plugin .claude/settings.json names.")
		.action(async () => {
			try {
				for (const args of await installPlugins({ repo: io.cwd, env: io.env })) io.stdout(`claude ${args.join(" ")}\n`);

				done(EXIT_OK);
			} catch (error) {
				io.stderr(`hum plugins: ${error instanceof Error ? error.message : String(error)}\n`);
				done(EXIT_FAILED);
			}
		});

	withWorkOptions(root.command("wake").description("One CI wake: bring back the state the last wake saved, tick until nothing more starts, saving the state after each tick, record the tick when --event is schedule, and show the cards."))
		.option("--event <name>", "the GitHub event that started this job")
		.action(async (flags: WorkFlags & { event?: string }) => {
			const dir = await defaultStateDir(io.cwd);
			const where = { repo: io.cwd, remote: "origin", dir };
			// A CI job's git dir dies with it, so the state the last wake saved comes back first and goes back after each tick.
			let saved = await restoreCiState({ ...where, timeoutMs: commandTimeoutMs(serviceSettings(io.cwd)) });
			const worker = await openFor(io, flags, "ci");
			const timeoutMs = commandTimeoutMs(worker.config.hum);

			const save = async () => {
				saved = await saveCiState({ ...where, ...saved, identity: worker.config.hum.commitIdentity, at: Date.now(), timeoutMs });
			};

			try {
				await wakeUntilQuiet(worker, save);
			} finally {
				await save();
			}

			if (flags.event === SCHEDULE_EVENT) await recordCiTick({ repo: io.cwd, remote: "origin", at: Date.now(), identity: worker.config.hum.commitIdentity, timeoutMs });

			const status = readStatus(join(dir, "status.json"));
			const cards = status.ok ? status.status.cards : [];

			await reportCards(cards, { hasStepSummary: Boolean(process.env.GITHUB_STEP_SUMMARY) });
			done(cards.length > 0 ? EXIT_CARDS_SHOWN : EXIT_OK);
		});
};
