import { randomUUID } from "node:crypto";
import { docsJudge } from "./judge.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { startBackgroundRunner } from "../../src/adapters/claude-bg.ts";
import { startRunner } from "../../src/adapters/claude-p.ts";
import { type HumConfig, SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { markdownAdapter } from "../../src/adapters/markdown.ts";
import { guarded, guardTimings } from "../../src/adapters/guard.ts";
import { serialized } from "../../src/adapters/serial.ts";
import type { Config } from "../../src/config/load.ts";
import { openState } from "../../src/state/open.ts";
import type { ThinPathOptions } from "../../src/worker/thin-path.ts";
import { Worker, type WorkerOptions } from "../../src/worker/worker.ts";
import { configWith } from "./config.ts";
import { makeShim, type ShimSpec } from "./shim.ts";
import { WorkRepo, itemFile, markdownSettings } from "./work-repo.ts";
import { settleAtTestEnd, tempDir } from "./temp.ts";
import { Holder } from "../../src/adapter-api.ts";

export const NOW = 1_800_000_000_000;
export const TTL = SHIPPED_DEFAULTS.claimExpirySeconds * 1000;

export type WorldOptions = {
	readonly config?: Config;
	/** hum.json keys over the config's own. */
	readonly settings?: Partial<HumConfig>;
	readonly checks?: readonly string[];
	readonly worker?: Partial<WorkerOptions>;
	/** Runs go to Claude Code's background service instead of `claude -p`. */
	readonly background?: boolean;
};

/** A temp bare remote, a markdown work source on it, a shim for `claude`, one worker, and the options of one thin-path pass. */
export const workerWorld = async (spec: ShimSpec, options: WorldOptions = {}) => {
	const repo = new WorkRepo();
	const clock = { at: NOW };
	const now = () => clock.at;
	const shim = makeShim(spec);
	const state = openState(tempDir("worker"), { now });
	const reports: string[] = [];
	const clone = repo.worker("w");
	const base = options.config ?? configWith();
	const config: Config = { ...base, hum: { ...base.hum, ...options.settings } };
	const markdown = guarded(markdownAdapter({ ...markdownSettings, repo: clone }, { report: (f) => reports.push(f.code), now, env: process.env }), { provider: "markdown", faults: state.faults, ...guardTimings(config.hum) });
	const adapter = serialized(markdown);
	const results: { outcome: string; item?: string; detail?: string }[] = [];

	const runnerOptions = { state, model: config.hum.models.light, binary: shim.binary, env: shim.env, now, lockBackoffMs: 1 };
	const started = () => (options.background ? startBackgroundRunner({ ...runnerOptions, config: { ...config.hum, backgroundPollSeconds: 0.05 }, repo: repo.owner }) : startRunner(runnerOptions));
	const startedRunner = async () => (await started()).runner;
	const { check: startCheck, runner } = await started();
	const checks = options.checks ?? ["true"];

	const workerWith = (over: Partial<WorkerOptions> = {}): Worker => {
		const worker = new Worker({
			repo: repo.owner,
			state,
			config,
			adapters: { workSource: adapter.workSource!, questions: adapter.questions!, answers: adapter.answers },
			runner,
			judge: docsJudge,
			remote: repo.remote,
			checks,
			holder: Holder.parse("worker-1"),
			workDir: tempDir("worker-work"),
			now,
			runnerVariables: new Set(Object.keys(process.env)),
			newSessionId: randomUUID,
			onResult: (result) => results.push(result),
			...options.worker,
			...over,
		});

		settleAtTestEnd(() => worker.idle());

		return worker;
	};

	return {
		repo,
		/** The work source's clone of the remote. */
		clone,
		clock,
		shim,
		state,
		adapter,
		markdown,
		config,
		reports,
		results,
		startCheck,
		startedRunner,
		workerWith,
		worker: workerWith(),
		/** An item that declares what it touches. */
		item: (id: string, touches?: string) => repo.add(id, itemFile(id, { state: "ready", body: touches ? `touches: ${touches}\n\nDo the work.` : "Do the work." })),
		/** A file in the owner's checkout, which the update check watches. */
		ownerFile: (path: string, content: string) => {
			mkdirSync(dirname(join(repo.owner, path)), { recursive: true });
			writeFileSync(join(repo.owner, path), content);
		},
		/** One pass of the thin path over the unserialized work source, in a work folder of its own. */
		thinPath: (over: Partial<ThinPathOptions> = {}): ThinPathOptions => ({
			workSource: markdown.workSource!,
			questions: markdown.questions!,
			state,
			runner,
			config,
			judge: docsJudge,
			remote: repo.remote,
			checks,
			holder: Holder.parse("worker-1"),
			workDir: tempDir("thin-work"),
			now: Date.now,
			runnerVariables: new Set(Object.keys(process.env)),
			newSessionId: randomUUID,
			...over,
		}),
	};
};

export type WorkerWorld = Awaited<ReturnType<typeof workerWorld>>;
