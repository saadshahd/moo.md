import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ClaudeRunner } from "../../src/adapters/claude-p.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { markdownAdapter } from "../../src/adapters/markdown.ts";
import { serialized } from "../../src/adapters/serial.ts";
import type { Config } from "../../src/config/load.ts";
import { openState } from "../../src/state/open.ts";
import { Worker, type WorkerOptions } from "../../src/worker/worker.ts";
import { configWith } from "./config.ts";
import { makeShim, type ShimSpec } from "./shim.ts";
import { itemFile, WorkRepo } from "./work-repo.ts";

export const NOW = 1_800_000_000_000;
export const TTL = 15 * 60_000;

export type WorldOptions = {
	readonly config?: Config;
	readonly checks?: readonly string[];
	readonly runners?: number;
	readonly claimTtlMs?: number;
	readonly worker?: Partial<WorkerOptions>;
};

/** A temp bare remote, a markdown work source on it, a shim for `claude`, and one worker; nothing leaves the temp folders. */
export const workerWorld = async (spec: ShimSpec, options: WorldOptions = {}) => {
	const repo = new WorkRepo();
	const clock = { at: NOW };
	const now = () => clock.at;
	const shim = makeShim(spec);
	const state = openState(mkdtempSync(join(tmpdir(), "hum-worker-")), { now });
	const reports: string[] = [];
	const markdown = markdownAdapter({ claimPrefix: SHIPPED_DEFAULTS.claimPrefix, repo: repo.worker("w") }, { report: (f) => reports.push(f.code), now });
	const adapter = serialized(markdown);
	const config = options.config ?? configWith();
	const results: { outcome: string; item?: string; detail?: string }[] = [];

	const runnerFor = () => new ClaudeRunner({ state, binary: shim.binary, env: shim.env, now, sleep: async () => {} });
	const runner = runnerFor();

	const cleanups = [() => rmSync(repo.root, { recursive: true, force: true }), () => rmSync(state.dir, { recursive: true, force: true })];

	await runner.start();

	const workerWith = (over: Partial<WorkerOptions> = {}): Worker =>
		new Worker({
			repo: repo.owner,
			state,
			config,
			adapters: { workSource: adapter.workSource!, questions: adapter.questions!, answers: adapter.answers },
			runner,
			kind: () => "docs",
			remote: repo.remote,
			checks: options.checks ?? ["true"],
			holder: "worker-1",
			claimTtlMs: options.claimTtlMs ?? TTL,
			workDir: mkdtempSync(join(tmpdir(), "hum-worker-work-")),
			runners: options.runners ?? 3,
			intervalMs: 60_000,
			now,
			onResult: (result) => results.push(result),
			...options.worker,
			...over,
		});

	return {
		repo,
		clock,
		shim,
		state,
		adapter,
		markdown,
		config,
		reports,
		results,
		runnerFor,
		workerWith,
		worker: workerWith(),
		/** An item that declares what it touches. */
		item: (id: string, touches?: string) => repo.add(id, itemFile(id, "ready", touches ? `touches: ${touches}\n\nDo the work.` : "Do the work.")),
		/** A file in the owner's checkout, which the update check watches. */
		ownerFile: (path: string, content: string) => {
			mkdirSync(dirname(join(repo.owner, path)), { recursive: true });
			writeFileSync(join(repo.owner, path), content);
		},
		clean: () => {
			for (const clean of cleanups) clean();
		},
	};
};

export type WorkerWorld = Awaited<ReturnType<typeof workerWorld>>;
