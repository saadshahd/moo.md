import * as core from "@actions/core";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { x } from "tinyexec";
import { z } from "zod";
import { listPluginSkills } from "../config/load.ts";
import { HumConfig } from "../config/schema.ts";
import { readSettings } from "../config/settings.ts";
import { commandTimeoutMs, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { CI_STATE_REF, CiStateRaced, restoreCiState, saveCiState } from "../service/ci-state.ts";
import { readCiTick, recordCiTick } from "../service/ci-tick.ts";
import { EXIT_UPDATED, supervise } from "../service/supervise.ts";
import { installPlugins } from "../service/plugins.ts";
import { reportCards, wakeUntilQuiet } from "../service/wake.ts";
import { defaultStateDir, openState, STATUS_FILE } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import { readStatus } from "../status/file.ts";
import { npmLatest, type OpenWorkerOptions, workerOptions } from "../worker/open.ts";
import { Worker, type WorkerOptions } from "../worker/worker.ts";
import { DEFAULT_BASE, publisherOf } from "../worker/thin-path.ts";
import { tallyOf } from "../worker/tally.ts";
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

const EXIT_OK = 0;

/** The start script's exit code when it gave up or was stopped: the unit restarts a script only after a failure. */
const EXIT_STAY_DOWN = EXIT_OK;

const EXIT_CARDS_SHOWN = 1;

const EXIT_FAILED = 1;

const SCHEDULE_EVENT = "schedule";

const MEGABYTE = 1024 * 1024;

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
const optionsFor = async ({ cwd: repo, env }: Io, flags: WorkFlags, where: "mac" | "ci", extra: Partial<OpenWorkerOptions> = {}): Promise<WorkerOptions> => {
	const timeoutMs = commandTimeoutMs(serviceSettings(repo));

	return workerOptions(repo, {
		now: Date.now,
		env,
		newSessionId: randomUUID,
		installedSkills: extra.judgmentsOnly ? undefined : await installedSkills(),
		holder: parseArgument(Holder, flags.holder ?? `${where}@${hostname()}`),
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

/** `hum work` as a child process of this one, sharing its terminal. */
const spawnWorker = (cwd: string, workArgs: readonly string[]) => {
	const child = x(process.execPath, [process.argv[1] ?? "", "work", ...workArgs], { nodeOptions: { cwd, stdio: "inherit" } });

	return { exited: Promise.resolve(child).then(({ exitCode }) => exitCode ?? 1), kill: () => void child.kill("SIGTERM") };
};

/**
 * `hum work`, `hum serve` and `hum wake`'s jobs: the processes a service unit and a CI workflow start. They are not ops:
 * roles and machines never name them, so they stay out of the table `hum help --json` prints. A CI job's git dir dies
 * with it, so gather brings back the state the last wake saved first and saves it for publish, which saves it again.
 */
export const addServiceCommands = (root: Command, io: Io, done: (code: number) => void): void => {
	withWorkOptions(root.command("work").description("Run the worker on this machine until it is stopped or an update arrives; exits 75 for an update."))
		.action(async (flags: WorkFlags) => {
			const abort = new AbortController();

			onStop(() => abort.abort());

			const worker = new Worker(await optionsFor(io, flags, "mac"));
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
			const worker = new Worker(options);

			for (let before = -1; claimed.size > before; ) {
				before = claimed.size;
				await worker.tick();
				await worker.idle();
			}

			const base = options.base ?? DEFAULT_BASE;
			const saved = await saveCiState({ ...where, ...read, identity: options.config.hum.commitIdentity, at: Date.now() });
			const heads = await remoteHeads(gitIn(io.cwd, { timeoutMs }), options.config.hum.runBranchPrefix);
			const baseSha = (await remoteHeads(gitIn(io.cwd, { timeoutMs }), base)).get(base);

			if (baseSha === undefined) throw new Error(`origin has no branch ${base}`);

			heads.delete(base);

			const gathered: Gathered = { holder: options.holder, base, baseSha, heads: Object.fromEntries(heads), claimed: [...claimed.keys()].map((id) => ItemId.parse(id)), stateRead: saved.read };

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
				ciJob: { kind: "work", publish: async (pass, worked) => void writePass(flags.outbox, { ...pass, result: worked }) },
			});

			const baseCheck = await checkMergesAt({ ...options, git: gitIn(io.cwd, { timeoutMs }) }, gathered.baseSha);

			if (baseCheck !== undefined) writeBaseCheck(flags.outbox, baseCheck);

			await wakeUntilQuiet(new Worker(options));
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
			const publisher = publisherOf({ ...options, workSource: options.adapters.workSource, questions: options.adapters.questions }, judge, started + (APP_TOKEN_MINUTES - hum.ciMergeMarginMinutes) * MINUTE_MS);

			let saved = read;

			const save = async () => {
				saved = await saveCiState({ ...where, ...saved, identity: hum.commitIdentity, at: Date.now() });
			};

			await publishWake({ publisher, gathered, outbox, work: openState(outbox.stateDir, { now: Date.now }), save });

			if (flags.event === SCHEDULE_EVENT) await recordCiTick({ repo: io.cwd, remote: "origin", at: Date.now(), identity: hum.commitIdentity, timeoutMs });

			return dir;
		}));
};

/** Runs one job of a wake, then shows the cards its state holds; the job exits 1 when it shows any or fails. */
const wakeJob = async (io: Io, done: (code: number) => void, job: () => Promise<string>): Promise<void> => {
	try {
		const status = readStatus(join(await job(), STATUS_FILE));
		const cards = status.ok ? status.status.cards : [];

		await reportCards(cards, { hasStepSummary: Boolean(process.env.GITHUB_STEP_SUMMARY) });
		done(cards.length > 0 ? EXIT_CARDS_SHOWN : EXIT_OK);
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
