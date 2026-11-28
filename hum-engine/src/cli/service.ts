import * as core from "@actions/core";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { z } from "zod";
import { listPluginSkills } from "../config/load.ts";
import { HumConfig } from "../config/schema.ts";
import { readSettings } from "../config/settings.ts";
import { installedCli } from "../engine.ts";
import { commandTimeoutMs, exec, SHIPPED_COMMAND_TIMEOUT_MS, spawn } from "../exec.ts";
import { CI_STATE_REF, CiStateRaced, restoreCiState, saveCiState } from "../service/ci-state.ts";
import { readCiTick, recordCiTick } from "../service/ci-tick.ts";
import { EXIT_UPDATED, supervise } from "../service/supervise.ts";
import { CARD_CODES, CARD_KINDS } from "../service/cards.ts";
import { programDifferences, programEntry, readProgram } from "../service/program.ts";
import { reportStatus } from "../service/program-status.ts";
import { installPlugins, MOO_PLUGINS } from "../service/plugins.ts";
import { doesStopWake, reportCards, wakeUntilQuiet } from "../service/wake.ts";
import { alone } from "../state/alone.ts";
import { defaultStateDir, openState, type State } from "../state/open.ts";
import { ENGINE_VERSION } from "../state/format.ts";
import { SECOND_MS } from "../time.ts";
import { type StatusPlaces, writeCards } from "../status/file.ts";
import type { Card } from "../status/format.ts";
import { closingAfter, npmLatest, type OpenWorkerOptions, workerOptions } from "../worker/open.ts";
import { Worker, type WorkerOptions } from "../worker/worker.ts";
import { DEFAULT_BASE, publisherOf } from "../worker/thin-path.ts";
import { tallyOf } from "../worker/tally.ts";
import { installedVersion } from "../worker/signature.ts";
import { signsCommits } from "../worker/signed-push.ts";
import { Gathered, inboxIntegrations, readInbox, readOutbox, workRemote, writeBaseCheck, writeInbox, writeOutboxState, writePass } from "../publish/handover.ts";
import { checkMergesAt } from "../worker/base-check.ts";
import { publishWake } from "../publish/wake.ts";
import { configuredModelCall } from "../adapters/model-call.ts";
import { type Git, gitIn } from "../adapters/git.ts";
import { APP_TOKEN_MINUTES, WAKE_ENV } from "../config/wake-job.ts";
import { MINUTE_MS } from "../time.ts";
import type { Io } from "./ops.ts";
import { Holder, type Item, ItemId } from "../adapter-api.ts";
import { parseArgument } from "../adapters/argument.ts";
import { MEGABYTE } from "../bytes.ts";

const EXIT_OK = 0;

/** The start script's exit code once stopped: the unit restarts a script only after a failure. */
const EXIT_STAY_DOWN = EXIT_OK;

const EXIT_WAKE_STOPPED = 1;

const EXIT_FAILED = 1;

const SCHEDULE_EVENT = "schedule";

type WorkFlags = { holder?: string; base?: string };

/** What a worker needs to know that no file in the repo says: who it claims as, and where items merge. */
const withWorkOptions = (cmd: Command): Command =>
	cmd
		.option("--holder <name>", "the name this worker claims items by; default <where>@<host>:<a hash of its state folder>")
		.option("--base <branch>", "the branch items merge into; default main");

const PluginList = z.array(z.looseObject({ id: z.string(), installPath: z.string(), enabled: z.boolean().default(true) }));

const HOPE = "hope";

/**
 * The skills of every enabled plugin, as a role names them (`sound:prime`), read from the folders `claude plugin list`
 * gives. `HUM_HOPE_ROOT` names hope's folder in a moo.md checkout instead, and then the skills are those of the moo.md
 * plugins hum's roles name, each in its folder beside hope's. hope must be there.
 */
export const installedSkills = async (): Promise<ReadonlySet<string>> => {
	const hopeRoot = process.env.HUM_HOPE_ROOT;

	if (hopeRoot) return new Set(MOO_PLUGINS.flatMap((plugin) => listPluginSkills(plugin, join(dirname(hopeRoot), plugin))));

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
	runSlots: HumConfig.shape.runSlots,
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
const optionsFor = async ({ cwd: repo, env }: Io, flags: WorkFlags, where: "mac" | "ci", extra: Partial<OpenWorkerOptions> = {}): Promise<WorkerOptions> => {
	const timeoutMs = commandTimeoutMs(serviceSettings(repo));

	return workerOptions(repo, {
		now: Date.now,
		env,
		newSessionId: randomUUID,
		installedSkills: extra.judgmentsOnly ? undefined : await installedSkills(),
		holder: flags.holder === undefined ? undefined : parseArgument(Holder, flags.holder),
		base: flags.base,
		where,
		latestVersion: where === "mac" ? npmLatest : undefined,
		ciTick: where === "mac" ? () => readCiTick({ repo, remote: "origin", timeoutMs }) : undefined,
		...extra,
	});
};

const onStop = (stop: () => void) => {
	for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, stop);
};

/**
 * `hum work` as a child process of this one, sharing its terminal, from the file the Program command and the service unit
 * name. bun hands this process its own file as a real path, which under pnpm names one version's folder, so a worker
 * started from it after an update would run the old engine.
 */
const spawnWorker = (cwd: string, workArgs: readonly string[]) => {
	const child = spawn(process.execPath, [installedCli(cwd), "work", ...workArgs], { nodeOptions: { cwd, stdio: "inherit" } });

	return { exited: Promise.resolve(child).then(({ exitCode }) => exitCode ?? 1), kill: () => void child.kill("SIGTERM") };
};

/**
 * Where `hum serve` runs, chosen once at its start. As roundup's Project program it shows hum's status on its row and
 * starts no worker while its entry differs from the one setup printed; roundup starts its program again after any exit,
 * so such a hum serve waits for a stop. A service unit has no entry to differ from.
 */
type ServeHost = {
	readonly differences: readonly string[];
	/** Shows the status file's state where the host reads one, until the returned function stops it. */
	readonly report: (statusPath: string) => () => void;
	readonly close: () => void;
};

const UNIT_HOST: ServeHost = { differences: [], report: () => () => {}, close: () => {} };

const stopped = (stop: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		if (stop.aborted) resolve();
		else stop.addEventListener("abort", () => resolve(), { once: true });
	});

const serveHost = async ({ cwd: repo, env, stdout }: Io, pool: string): Promise<ServeHost> => {
	const program = await readProgram(env);

	if (!program) return UNIT_HOST;

	return {
		differences: programDifferences(program, programEntry(repo, pool, process.execPath)),
		report: (statusPath) => reportStatus(statusPath, stdout),
		close: program.client.close,
	};
};

/** Shows the card for a Program that differs from the one setup printed, else clears it; the status file is written here, as no worker runs to. */
const showProgramCard = (state: Pick<State, "faults"> & StatusPlaces, differences: readonly string[], now: number): Readonly<Card> | undefined => {
	const { faults } = state;

	faults.clear({ code: CARD_CODES.programEntry });

	const card = differences.length > 0 ? faults.raise(CARD_KINDS.programEntry({ differences })) : undefined;

	writeCards(state, ENGINE_VERSION, now);

	return card;
};

/**
 * `hum work`, `hum serve` and `hum wake`'s jobs: the processes a service unit and a CI workflow start. They are not ops:
 * roles and machines never name them, so they stay out of the table `hum help --json` prints. A CI job's git dir dies
 * with it, so gather brings back the state the last wake saved first and saves it for publish, which saves it again.
 */
export const addServiceCommands = (root: Command, io: Io, done: (code: number) => void): void => {
	/** Stops this process when another took its hold on the state folder over. */
	const stopOnLoss = (name: string, abort: AbortController) => (error: Error) => {
		io.stderr(`hum ${name}: another process took the state folder over: ${error.message}\n`);
		abort.abort();
	};

	withWorkOptions(root.command("work").description("Run the worker on this machine until it is stopped or an update arrives; exits 75 for an update."))
		.action(async (flags: WorkFlags) => {
			const abort = new AbortController();

			onStop(() => abort.abort());

			const ended = await alone(await defaultStateDir(io.cwd), "work", stopOnLoss("work", abort), async () => {
				const options = await optionsFor(io, flags, "mac");

				return closingAfter(options, () => new Worker(options).serve(abort.signal));
			});

			io.stderr(`hum work: stopped, ${ended.reason}\n`);
			done(ended.reason === "stopped" ? EXIT_OK : EXIT_UPDATED);
		});

	root
		.command("serve")
		.description(
			"Keep `hum work` running with the arguments after `--`: start it again when it exits, stop starting it after too many crashes, and exit 75 once it exits for an update that installed another engine or another engine is installed after the restarts stopped, so the host starts hum serve on the new one. As roundup's Project program it shows hum's status on its row and starts no worker while its entry differs from the one setup printed. Otherwise it exits only when stopped.",
		)
		.argument("[work-args...]", "options of `hum work`, after `--`")
		.action(async (workArgs: string[]) => {
			const abort = new AbortController();
			const settings = serviceSettings(io.cwd);
			const dir = await defaultStateDir(io.cwd);

			onStop(() => abort.abort());

			const ended = await alone(dir, "serve", stopOnLoss("serve", abort), async () => {
				const state = openState(dir, { now: Date.now });
				const host = await serveHost(io, settings.runSlots.pool);
				const card = showProgramCard(state, host.differences, Date.now());
				const stopReport = host.report(state.statusPath);

				if (card) io.stderr(`hum serve: ${card.cause} ${card.fix}\n`);

				const ended = card
					? "refused"
					: await supervise({
							state,
							spawn: () => spawnWorker(io.cwd, workArgs),
							now: Date.now,
							intervalMs: settings.tickIntervalSeconds * SECOND_MS,
							workerDownTicks: settings.workerDownTicks,
							maxCrashes: settings.maxCrashes,
							crashWindowMs: settings.crashWindowSeconds * SECOND_MS,
							backoffMs: settings.restartBackoff.firstSeconds * SECOND_MS,
							maxBackoffMs: settings.restartBackoff.maxSeconds * SECOND_MS,
							hasNewEngine: () => installedVersion(io.cwd, ENGINE_VERSION) !== ENGINE_VERSION,
							stop: abort.signal,
						});

				io.stderr(`hum serve: ${ended}\n`);

				if (ended === "refused") await stopped(abort.signal);

				stopReport();
				host.close();

				return ended;
			});

			done(ended === "updated" ? EXIT_UPDATED : EXIT_STAY_DOWN);
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

	const wake = root.command("wake").description("One CI wake, as three jobs: gather claims and settles with GitHub's token, work runs with none, and publish checks and applies what work made.");

	withWorkOptions(wake.command("gather").description("Bring back the state the last wake saved, claim each item and settle its answers and kind, save the state, and write the inbox the work job reads; sets the job output `gathered` for publish."))
		.requiredOption("--inbox <folder>", "where to write the inbox")
		.action((flags: WorkFlags & { inbox: string }) => wakeJob(io, done, async () => {
			const dir = await defaultStateDir(io.cwd);
			const timeoutMs = commandTimeoutMs(serviceSettings(io.cwd));
			const where = { repo: io.cwd, remote: "origin", dir, timeoutMs };
			const read = await restoreCiState(where);
			const claimed = new Map<string, Item>();
			const options = await optionsFor(io, flags, "ci", { ciJob: { kind: "gather", gathered: claimed }, judgmentsOnly: true });
			await closingAfter(options, async () => {
				const worker = new Worker(options);

				for (let before = -1; claimed.size > before; ) {
					before = claimed.size;
					await worker.tick();
					await worker.idle();
				}
			});

			const base = options.base ?? DEFAULT_BASE;
			const saved = await saveCiState({ ...where, ...read, identity: options.config.hum.commitIdentity, at: Date.now() });
			const heads = await remoteHeads(gitIn(io.cwd, { timeoutMs }), options.config.hum.runBranchPrefix);
			const baseSha = (await remoteHeads(gitIn(io.cwd, { timeoutMs }), base)).get(base);

			if (baseSha === undefined) throw new Error(`origin has no branch ${base}`);

			heads.delete(base);

			const gathered: Gathered = { holder: options.holder, base, baseSha, signs: await signsCommits({ pulls: options.pulls, base }), heads: Object.fromEntries(heads), claimed: [...claimed.keys()].map((id) => ItemId.parse(id)), stateRead: saved.read };

			writeInbox(flags.inbox, { gathered, items: [...claimed.values()] }, dir);
			core.setOutput("gathered", JSON.stringify(gathered));

			return dir;
		}));

	wake
		.command("work")
		.description("Run each item the inbox holds with no GitHub token: runs clone the base and hum branches gather saw, and each pass leaves what it asks publish to do in the outbox, with hum's state.")
		.requiredOption("--inbox <folder>", "the inbox gather wrote")
		.requiredOption("--outbox <folder>", "where to write the outbox")
		.action((flags: { inbox: string; outbox: string }) => wakeJob(io, done, async () => {
			const dir = await defaultStateDir(io.cwd);
			const timeoutMs = commandTimeoutMs(serviceSettings(io.cwd));
			const inbox = readInbox(flags.inbox, dir);
			const { gathered } = inbox;
			const remote = await workRemote({ checkout: io.cwd, gathered, folder: mkdtempSync(join(io.env.RUNNER_TEMP ?? tmpdir(), "hum-remote-")), timeoutMs });

			const options = await optionsFor(io, { holder: gathered.holder, base: gathered.base }, "ci", {
				remote,
				integrations: inboxIntegrations(inbox, Date.now),
				ciJob: { kind: "work", claimed: new Set(gathered.claimed), signs: gathered.signs, publish: async (pass, worked) => void writePass(flags.outbox, { ...pass, result: worked }) },
			});

			const baseCheck = await checkMergesAt({ ...options, git: gitIn(io.cwd, { timeoutMs }) }, gathered.baseSha);

			if (baseCheck !== undefined) writeBaseCheck(flags.outbox, baseCheck);

			await closingAfter(options, () => wakeUntilQuiet(new Worker(options)));
			writeOutboxState(flags.outbox, dir);

			return dir;
		}));

	wake
		.command("publish")
		.description(`Check and apply the work job's outbox with GitHub's token, from what gather settled in ${WAKE_ENV.gathered}, save the state, and record the tick when --event is schedule.`)
		.requiredOption("--outbox <folder>", "the outbox the work job wrote")
		.option("--event <name>", "the GitHub event that started this wake")
		.action((flags: { outbox: string; event?: string }) => wakeJob(io, done, async () => {
			const started = Date.now();
			const gathered = Gathered.parse(JSON.parse(io.env[WAKE_ENV.gathered] ?? "null"));
			const dir = await defaultStateDir(io.cwd);
			const timeoutMs = commandTimeoutMs(serviceSettings(io.cwd));
			const where = { repo: io.cwd, remote: "origin", dir, timeoutMs };
			const read = await restoreCiState(where);

			if (read.read !== gathered.stateRead) throw new CiStateRaced(`hum's state at ${CI_STATE_REF} is not the one gather saved, so another wake ran since; this wake publishes nothing`);

			const options = await optionsFor(io, { holder: gathered.holder, base: gathered.base }, "ci", { judgmentsOnly: true });
			const { hum } = options.config;
			const outbox = readOutbox(flags.outbox, { maxBytes: hum.ciOutboxMaxMegabytes * MEGABYTE, claimed: new Set(gathered.claimed) });
			const judge = options.judge ?? configuredModelCall(options.runner, hum, (item, tokens) => tallyOf(options.state, item).spend(tokens));
			let saved = read;

			const save = async () => {
				saved = await saveCiState({ ...where, ...saved, identity: hum.commitIdentity, at: Date.now() });
			};

			const publisher = { ...publisherOf({ ...options, workSource: options.adapters.workSource, questions: options.adapters.questions }, judge, started + (APP_TOKEN_MINUTES - hum.ciMergeMarginMinutes) * MINUTE_MS), save };

			await closingAfter(options, () => publishWake({ publisher, gathered, outbox, work: openState(outbox.stateDir, { now: Date.now }) }));

			if (flags.event === SCHEDULE_EVENT) await recordCiTick({ repo: io.cwd, remote: "origin", at: Date.now(), identity: hum.commitIdentity, timeoutMs });

			return dir;
		}));
};

/** Runs one job of a wake, then shows the cards its state holds; the job exits 1 when it fails or shows a card that stops the wake. */
const wakeJob = async (io: Io, done: (code: number) => void, job: () => Promise<string>): Promise<void> => {
	try {
		const cards = openState(await job(), { now: Date.now }).faults.list();

		await reportCards(cards, { hasStepSummary: Boolean(process.env.GITHUB_STEP_SUMMARY) });
		done(cards.some(doesStopWake) ? EXIT_WAKE_STOPPED : EXIT_OK);
	} catch (error) {
		io.stderr(`hum wake: ${error instanceof Error ? error.message : String(error)}\n`);
		done(EXIT_FAILED);
	}
};

/** Each branch on origin under `prefix`, or named `prefix`, at its head. */
const remoteHeads = async (git: Git, prefix: string): Promise<Map<string, string>> =>
	new Map(
		(await git.raw(["ls-remote", "--heads", "origin", `refs/heads/${prefix}*`]))
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [sha = "", ref = ""] = line.split("\t");

				return [ref.slice("refs/heads/".length), sha] as const;
			}),
	);
