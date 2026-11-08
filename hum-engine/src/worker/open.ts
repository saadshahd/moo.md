import { join } from "node:path";
import { z } from "zod";
import type { Adapter } from "../adapter-api.ts";
import { resolveAdapters } from "../adapters/registry.ts";
import { startBackgroundRunner } from "../adapters/claude-bg.ts";
import { startRunner } from "../adapters/claude-p.ts";
import { gitIn } from "../adapters/git.ts";
import { gitHubClient, ownerToken, repoFromRemote } from "../adapters/github.ts";
import { githubLoopReads } from "../loop/github.ts";
import { gitHubPullRequests } from "../adapters/pull-requests.ts";
import { serialized } from "../adapters/serial.ts";
import { SlotPool } from "../slots/pool.ts";
import { loadConfig, readConfigDir } from "../config/load.ts";
import type { HumConfig } from "../config/schema.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import { DEFAULT_BASE } from "./thin-path.ts";
import { Worker, type WorkerOptions } from "./worker.ts";

export type OpenWorkerOptions = Omit<WorkerOptions, "repo" | "state" | "config" | "adapters" | "runner" | "remote" | "pulls" | "loop" | "checks"> & {
	/** Where saved state lives; default `<git common dir>/hum`. */
	readonly stateDir?: string;
	/** The skill names of hope's installed copy; a role that names another is refused. */
	readonly hopeSkills: ReadonlySet<string>;
	readonly remote?: string;
	readonly binary?: string;
	readonly env?: Readonly<Record<string, string>>;
};

const Latest = z.looseObject({ version: z.string().min(1) });

const NPM_LATEST = "https://registry.npmjs.org/@moo.md/hum/latest";

const NPM_TIMEOUT_MS = 5000;

/** The newest `@moo.md/hum` on npm. */
export const npmLatest = async (): Promise<string | undefined> => {
	const reply = await fetch(NPM_LATEST, { signal: AbortSignal.timeout(NPM_TIMEOUT_MS) });

	return reply.ok ? Latest.safeParse(await reply.json()).data?.version : undefined;
};

/** Runs are background agents where an owner can see agent view: on the Mac, and only when `hum.json` allows it. */
const isInBackground = ({ backgroundRuns }: Pick<HumConfig, "backgroundRuns">, where: WorkerOptions["where"]): boolean => backgroundRuns && where !== "ci";

/**
 * Wires a worker for the owner's repo: state in the git common dir, the config in `.hum/`, the adapters
 * `hum.json` names (guarded, with the last ready list saved, and one call at a time), a started runner, and for a
 * remote on GitHub its pull requests and branch rules, so landing follows what the target branch requires.
 * Throws when the config is refused or the repo has no `origin`; the service unit shows that as a card.
 */
export const openWorker = async (repo: string, options: OpenWorkerOptions): Promise<Worker> => {
	const { stateDir, hopeSkills, binary, env, ...rest } = options;
	const now = rest.now ?? Date.now;
	const state = openState(stateDir ?? (await defaultStateDir(repo)), { now });
	const loaded = loadConfig(readConfigDir(join(repo, ".hum")), { env: { hopeSkills } });

	if (!loaded.ok) throw new Error(loaded.refusal.message);

	const remote = options.remote ?? (await gitIn(repo).raw(["remote", "get-url", "origin"])).trim();

	if (!remote) throw new Error(`${repo} has no origin remote, and none was given`);

	const config = loaded.value;

	if (config.hum.checks.length === 0) throw new Error("hum.json names no checks: set \"checks\" to the commands a change must pass, or run /hum");

	const adapters = await resolveAdapters(repo, {
		faults: state.faults,
		guard: { lastReady: { load: () => state.ready.get("work-source")?.ids ?? [], save: (ids) => state.ready.put("work-source", { ids }) } },
		context: { report: (fault) => void state.faults.raise(fault), now },
	});

	// One adapter serves several slots; its calls go one at a time whichever slot they come through.
	const ordered = new Map<Adapter, Adapter>();

	const inOrder = (adapter: Adapter | undefined): Adapter | undefined => {
		if (adapter && !ordered.has(adapter)) ordered.set(adapter, serialized(adapter));

		return adapter && ordered.get(adapter);
	};

	const workSource = inOrder(adapters["work-source"])?.workSource;
	const questions = inOrder(adapters.questions)?.questions;
	const answers = inOrder(adapters.answers)?.answers;

	if (!workSource || !questions) throw new Error("hum.json names no work source or no questions integration");

	const runnerOptions = { state, model: config.hum.models.light, binary, env, now };
	const { runner } = isInBackground(config.hum, rest.where) ? await startBackgroundRunner({ ...runnerOptions, config: config.hum, repo }) : await startRunner(runnerOptions);

	// A slot is a worktree a background run starts in, so the pool stands only where runs are background agents.
	const slots = config.hum.runSlots.enabled && isInBackground(config.hum, rest.where) ? new SlotPool({ repo, state, config: config.hum, base: rest.base ?? DEFAULT_BASE, liveRuns: runner.liveRuns, now }) : undefined;
	const github = repoFromRemote(remote);
	const pulls = github === undefined ? undefined : gitHubPullRequests(github);
	const loop = github === undefined ? undefined : githubLoopReads(github, rest.base ?? DEFAULT_BASE, config.hum.measureWindow, async () => gitHubClient({ token: await ownerToken() }));

	return new Worker({ ...rest, checks: config.hum.checks, checkout: rest.checkout ?? slots?.checkout, slots, repo, state, config, adapters: { workSource, questions, answers }, runner, remote, pulls, loop });
};
