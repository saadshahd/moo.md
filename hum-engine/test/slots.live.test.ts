import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { x } from "tinyexec";
import { z } from "zod";
import { startBackgroundRunner } from "../src/adapters/claude-bg.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SlotPool } from "../src/slots/pool.ts";
import { markdownAdapter } from "../src/adapters/markdown.ts";
import { openState } from "../src/state/open.ts";
import { runThinPath } from "../src/worker/thin-path.ts";
import { configWith } from "./fixtures/config.ts";
import { markdownSettings, WorkRepo } from "./fixtures/work-repo.ts";
import { poolConfig } from "./fixtures/slot-world.ts";

const repo = process.env.HUM_SLOT_REPO;
const live = process.env.HUM_LIVE === "1" && repo !== undefined;

if (!live) console.log("skip live run slots: set HUM_LIVE=1 and HUM_SLOT_REPO (a checkout whose trust the owner accepted, on main); one Haiku background run");

const MODEL = SHIPPED_DEFAULTS.models.light;

const NAMED = "hum live slot";

const WHERE = {
	type: "object",
	properties: { folder: { type: "string" }, slot: { type: "string" } },
	required: ["folder", "slot"],
};

const Reported = z.object({ structured: z.object({ folder: z.string() }) });
const Listed = z.array(z.looseObject({ kind: z.string(), name: z.string().nullish() }));

const sh = async (cwd: string, cmd: string, args: string[]) => (await x(cmd, args, { nodeOptions: { cwd } })).stdout.trim();

const work = new WorkRepo();
const remote = work.remote;
const pool = mkdtempSync(join(tmpdir(), "hum-live-slot-pool-"));
const stateDir = mkdtempSync(join(tmpdir(), "hum-live-slot-state-"));
const state = openState(stateDir);

beforeAll(async () => {
	if (!live || !repo) return;

	await sh(repo, "git", ["remote", "add", "origin", remote]);
	await sh(repo, "git", ["fetch", "-q", "origin"]);
});

afterAll(async () => {
	if (!live || !repo) return;

	const leftOver = Listed.parse(JSON.parse((await x("claude", ["agents", "--json"])).stdout)).filter(({ kind, name }) => kind === "background" && name?.startsWith(NAMED));

	await sh(repo, "git", ["remote", "remove", "origin"]).catch(() => undefined);

	for (const folder of [work.root, pool, stateDir]) rmSync(folder, { recursive: true, force: true });
	await sh(repo, "git", ["worktree", "prune"]);

	expect(leftOver).toEqual([]);
	expect(await sh(repo, "git", ["worktree", "list", "--porcelain"])).not.toContain(pool);
}, 120_000);

test.skipIf(!live)("live: a background run in a slot starts in the slot's folder with the slot's environment, and the slot comes back free", async () => {
	if (!repo) return;

	const slots = new SlotPool({ repo, state, config: poolConfig(pool, { runners: 1 }), base: "main" });
	const { runner } = await startBackgroundRunner({ state, model: MODEL, config: { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.5 }, repo });
	const taken = await slots.checkout({ remote, base: "main", item: "live", signal: undefined });

	const firstToken: number[] = [];

	const timed = () => {
		const at = Date.now();

		return () => void firstToken.push(Date.now() - at);
	};

	try {
		const outcome = await runner.run({
			name: `${NAMED} where`,
			prompt: 'Run `pwd` and `echo $HUM_SLOT` as two Bash calls, then reply {"folder": <the pwd output>, "slot": <the echo output>}.',
			cwd: taken.folder,
			env: taken.env,
			model: MODEL,
			effort: "low",
			schema: WHERE,
			onFirstToken: timed(),
		});

		expect(outcome).toMatchObject({ kind: "finished", structured: { slot: taken.env.HUM_SLOT } });
		console.log(`live slot: start sample 1 ${firstToken[0]} ms`);
		expect(realpathSync(Reported.parse(outcome).structured.folder)).toBe(realpathSync(taken.folder));

		// A second sample, and an edit in the slot (the edit guard accepts a slot's folder).
		const second = await runner.run({ name: `${NAMED} edit`, prompt: 'Use the Write tool to create probe.txt in the current folder holding one line: hi. Then reply {"folder": "x", "slot": "x"}.', cwd: taken.folder, env: taken.env, model: MODEL, effort: "low", schema: WHERE, onFirstToken: timed() });

		expect(second.kind).toBe("finished");
		expect(existsSync(join(taken.folder, "probe.txt"))).toBe(true);
		console.log(`live slot: start sample 2 ${firstToken[1]} ms; edit guard accepted the slot`);

		// Both runs were stopped and removed by the runner; the slot's worktree stays.
		expect(existsSync(taken.folder)).toBe(true);
		expect(await sh(repo, "git", ["worktree", "list", "--porcelain"])).toContain(realpathSync(taken.folder));
		expect(Listed.parse(JSON.parse((await x("claude", ["agents", "--json"])).stdout)).filter(({ name }) => name?.startsWith(NAMED))).toEqual([]);
		console.log("live slot: claude rm left the slot worktree in place");
	} finally {
		await taken.giveBack();
		await slots.idle();
	}

	expect(slots.list()).toMatchObject([{ status: "free" }]);
}, 300_000);

test.skipIf(!live)("live: a feature item runs its plan, build and review in a slot on Haiku, and the slot comes back free", async () => {
	if (!repo) return;

	const config = configWith((raw) => void (raw.hum.models = { light: MODEL, standard: MODEL, top: MODEL }));
	const slots = new SlotPool({ repo, state, config: poolConfig(pool, { runners: 1 }), base: "main" });
	const { runner } = await startBackgroundRunner({ state, model: MODEL, config: { ...config.hum, backgroundPollSeconds: 0.5 }, repo });
	const adapter = markdownAdapter({ ...markdownSettings, repo: work.worker("w") }, { report: () => {}, now: Date.now });
	const id = work.add("live-slot-1", "---\ntitle: Write the note\nstate: ready\nkind: feature\n---\n\nCreate docs/note.md holding one line: hello.\n");

	const result = await runThinPath({ workSource: adapter.workSource!, questions: adapter.questions!, state, runner, config, remote, checks: ["test -f docs/note.md"], holder: "live", workDir: mkdtempSync(join(tmpdir(), "hum-live-slot-work-")), checkout: slots.checkout });
	const runs = state.runs.list(id).map((record) => record.run);

	await slots.idle();
	console.log(`live slot thin path: ${result.outcome}, runs ${runs.join(", ")}`);

	expect(runs).toEqual(expect.arrayContaining(["plan", "build", "review"]));
	expect(["merged", "review", "stuck"]).toContain(result.outcome);
	expect(slots.list()).toMatchObject([{ status: "free" }]);
}, 900_000);
