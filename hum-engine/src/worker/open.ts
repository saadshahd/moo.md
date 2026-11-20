import { join } from "node:path";
import { z } from "zod";
import { ADAPTER_API_VERSION, type Integrations } from "../adapter-api.ts";
import type { WorkIntegrations } from "../publish/handover.ts";
import { type Resolved, resolveAdapters } from "../adapters/registry.ts";
import { startBackgroundRunner } from "../adapters/claude-bg.ts";
import { judgmentRunner, type RunnerOptions, startRunner } from "../adapters/claude-p.ts";
import { railRunner, roundupProgram } from "../adapters/rail-rows.ts";
import type { RoundupClient } from "../adapters/roundup-rpc.ts";
import { gitIn } from "../adapters/git.ts";
import { repoFromRemote } from "../adapters/github.ts";
import { ownerGitHub } from "../adapters/github-client.ts";
import { githubLoopReads } from "../loop/github.ts";
import { gitHubPullRequests } from "../adapters/pull-requests.ts";
import { gitHubCommits } from "../adapters/github-commits.ts";
import { serialized } from "../adapters/serial.ts";
import { SlotPool } from "../slots/pool.ts";
import { loadConfig, readConfigDir } from "../config/load.ts";
import type { HumConfig } from "../config/schema.ts";
import { commandTimeoutMs, type Env, withoutGitHubTokens } from "../exec.ts";
import { defaultStateDir, openState, type State } from "../state/open.ts";
import { type Measurement, measureOn } from "../measure/remeasure.ts";
import { DEFAULT_BASE } from "./thin-path.ts";
import { Worker, type WorkerOptions } from "./worker.ts";

export type OpenWorkerOptions = Omit<WorkerOptions, "repo" | "state" | "config" | "adapters" | "runner" | "remote" | "pulls" | "commits" | "loop" | "checks" | "runnerVariables"> & {
	/** Where saved state lives; default `<git common dir>/hum`. */
	readonly stateDir?: string;
	/** The installed plugins' skills, as a role names them; a role that names another plugin skill is refused. Absent where the worker makes judgment calls alone. */
	readonly installedSkills?: ReadonlySet<string>;
	/**
	 * The worker makes judgment calls alone and runs no role, as a CI job that holds GitHub's token: its runner makes
	 * no start check, which would run a full session with the repo's plugins and hooks, and refuses any other run.
	 */
	readonly judgmentsOnly?: boolean;
	readonly remote?: string;
	readonly binary?: string;
	/** The process environment: runs start with it, and the GitHub login and adapters read it. */
	readonly env: Env;
	/** The work source and questions in place of the ones `hum.json` names, with no GitHub reads: a CI work job's inbox. */
	readonly integrations?: WorkIntegrations;
};

const Latest = z.looseObject({ version: z.string().min(1) });

const NPM_LATEST = "https://registry.npmjs.org/@moo.md/hum/latest";

const NPM_TIMEOUT_MS = 5000;

/** The newest `@moo.md/hum` on npm. */
export const npmLatest = async (): Promise<string | undefined> => {
	const reply = await fetch(NPM_LATEST, { signal: AbortSignal.timeout(NPM_TIMEOUT_MS) });

	return reply.ok ? Latest.safeParse(await reply.json()).data?.version : undefined;
};

/**
 * Where agent runs run: Rail rows where hum runs as its roundup Project's program, background agents where an owner
 * can see agent view (on the Mac, when `hum.json` allows it), and `claude -p` processes elsewhere, as in CI.
 */
type RunPlace = { readonly kind: "rows"; readonly roundup: RoundupClient } | { readonly kind: "background" } | { readonly kind: "headless" };

const runPlaceOf = async ({ backgroundRuns }: Pick<HumConfig, "backgroundRuns">, where: WorkerOptions["where"], env: Env, faults: WorkerOptions["state"]["faults"]): Promise<RunPlace> => {
	if (where === "ci") return { kind: "headless" };

	const roundup = await roundupProgram(env, faults);

	if (roundup) return { kind: "rows", roundup };

	return backgroundRuns ? { kind: "background" } : { kind: "headless" };
};

/** The runner of a run place, its start check made. */
const startAgentRunner = async (place: RunPlace, options: RunnerOptions & { readonly state: State }, config: HumConfig, repo: string) => {
	switch (place.kind) {
		case "rows": {
			const started = await startRunner(options);

			return { ...started, runner: railRunner({ call: place.roundup.call, state: options.state, config, fallback: started.runner, now: options.now }) };
		}

		case "background":
			return startBackgroundRunner({ ...options, config, repo });

		case "headless":
			return startRunner(options);
	}
};

/**
 * Wires a worker for the owner's repo: state in the git common dir, the config in `.hum/`, the adapters
 * `hum.json` names (guarded, with the last ready list saved, and one call at a time), a started runner, and for a
 * remote on GitHub its pull requests and branch rules, so landing follows what the target branch requires.
 * Throws when the config is refused or the repo has no `origin`; the service unit shows that as a card.
 */
/** Runs `use`, then ends what the worker's integrations hold open, however `use` ended, so the process can exit. */
export const closingAfter = async <T>({ adapters }: Pick<WorkerOptions, "adapters">, use: () => Promise<T>): Promise<T> => {
	try {
		return await use();
	} finally {
		await adapters.close?.();
	}
};

/** Ends what the adapters hold open, and roundup's connection where runs are Rail rows. */
const closeAll =
	(close: () => Promise<void>, place: RunPlace) =>
	async (): Promise<void> => {
		if (place.kind === "rows") place.roundup.close();

		await close();
	};

/** A worker on `repo`, as `workerOptions` opens it. */
export const openWorker = async (repo: string, options: OpenWorkerOptions): Promise<Worker> => new Worker(await workerOptions(repo, options));

/** Everything a worker on `repo` works with: its state, its config, its integrations, its runner and its remote. */
export const workerOptions = async (repo: string, options: OpenWorkerOptions): Promise<WorkerOptions> => {
	const { stateDir, installedSkills, judgmentsOnly, binary, env, ...rest } = options;
	const { now } = rest;
	const state = openState(stateDir ?? (await defaultStateDir(repo)), { now });
	const loaded = loadConfig(readConfigDir(join(repo, ".hum")), { env: { installedSkills } });

	if (!loaded.ok) throw new Error(loaded.refusal.message);

	const timeoutMs = commandTimeoutMs(loaded.value.hum);
	const remote = options.remote ?? (await gitIn(repo, { timeoutMs }).raw(["remote", "get-url", "origin"])).trim();

	if (!remote) throw new Error(`${repo} has no origin remote, and none was given`);

	const config = loaded.value;

	if (config.hum.checks.length === 0) throw new Error("hum.json names no checks: set \"checks\" to the commands a change must pass, or run /hum");

	const resolved: Resolved = options.integrations
		? { slots: { "work-source": { apiVersion: ADAPTER_API_VERSION, ...options.integrations }, questions: { apiVersion: ADAPTER_API_VERSION, ...options.integrations } }, close: async () => {} }
		: await resolveAdapters(repo, {
				faults: state.faults,
				guard: { lastReady: { load: () => state.ready.get("work-source")?.ids ?? [], save: (ids) => state.ready.put("work-source", { ids }) } },
				context: { report: (fault) => void state.faults.raise(fault), now, env },
			});

	const adapters = resolved.slots;

	// One adapter serves several slots; its calls go one at a time whichever slot they come through.
	const ordered = new Map<Integrations, Integrations>();

	const inOrder = (adapter: Integrations | undefined): Integrations | undefined => {
		if (adapter && !ordered.has(adapter)) ordered.set(adapter, serialized(adapter));

		return adapter && ordered.get(adapter);
	};

	const workSource = inOrder(adapters["work-source"])?.workSource;
	const questions = inOrder(adapters.questions)?.questions;
	const answers = inOrder(adapters.answers)?.answers;

	if (!workSource || !questions) throw new Error("hum.json names no work source or no questions integration");

	const runnerOptions = { state, model: config.hum.models.light, binary, env, now, timeoutMs };
	const place: RunPlace = judgmentsOnly ? { kind: "headless" } : await runPlaceOf(config.hum, rest.where, env, state.faults);

	if (place.kind === "rows" && !config.hum.runSlots.enabled) throw new Error("hum runs as this roundup Project's program, where every run is a Rail row in a run slot: set runSlots.enabled to true in .hum/hum.json");

	const runner = judgmentsOnly ? judgmentRunner(runnerOptions) : (await startAgentRunner(place, runnerOptions, config.hum, repo)).runner;

	// A slot is a worktree a background run or a Rail row starts in, so the pool stands only where runs are agents.
	const slots = config.hum.runSlots.enabled && place.kind !== "headless" ? new SlotPool({ repo, state, config: config.hum, base: rest.base ?? DEFAULT_BASE, liveRuns: runner.liveRuns, now }) : undefined;
	const github = options.integrations ? undefined : repoFromRemote(remote);
	const pulls = github === undefined ? undefined : gitHubPullRequests(github, { timeoutMs, env });
	const commits = github === undefined ? undefined : gitHubCommits(github, { timeoutMs, env });
	const loop = github === undefined ? undefined : githubLoopReads(github, rest.base ?? DEFAULT_BASE, config.hum.measureWindow, () => ownerGitHub(timeoutMs, env));

	/** A measurement writes the owner's `.hum/hum.json`, which a CI checkout throws away. */
	const remeasure = rest.where === "ci" ? undefined : (measurement: Measurement, signal: AbortSignal) => measureOn(repo, measurement, { inherit: false, signal });

	return { ...rest, remeasure, checks: config.hum.checks, checkout: rest.checkout ?? slots?.checkout, slots, repo, state, config, adapters: { workSource, questions, answers, close: closeAll(resolved.close, place) }, runner, remote, pulls, commits, loop, runnerVariables: new Set(Object.entries(withoutGitHubTokens(env)).flatMap(([name, value]) => (value === undefined ? [] : [name]))) };
};
