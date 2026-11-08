import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { x } from "tinyexec";
import { z } from "zod";
import { startBackgroundRunner } from "../src/adapters/claude-bg.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SlotPool } from "../src/slots/pool.ts";
import { openState } from "../src/state/open.ts";
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

const stamp = String(Date.now());
const remote = join(tmpdir(), `hum-live-slot-remote-${stamp}`);
const pool = mkdtempSync(join(tmpdir(), "hum-live-slot-pool-"));
const stateDir = mkdtempSync(join(tmpdir(), "hum-live-slot-state-"));
const state = openState(stateDir);

beforeAll(async () => {
	if (!live || !repo) return;

	await sh(repo, "git", ["clone", "-q", "--bare", repo, remote]);
	await sh(repo, "git", ["remote", "add", "origin", remote]);
	await sh(repo, "git", ["fetch", "-q", "origin"]);
});

afterAll(async () => {
	if (!live || !repo) return;

	const leftOver = Listed.parse(JSON.parse((await x("claude", ["agents", "--json"])).stdout)).filter(({ kind, name }) => kind === "background" && name?.startsWith(NAMED));

	await sh(repo, "git", ["remote", "remove", "origin"]).catch(() => undefined);

	for (const folder of [remote, pool, stateDir]) rmSync(folder, { recursive: true, force: true });
	await sh(repo, "git", ["worktree", "prune"]);

	expect(leftOver).toEqual([]);
	expect(await sh(repo, "git", ["worktree", "list", "--porcelain"])).not.toContain(pool);
}, 120_000);

test.skipIf(!live)("live: a background run in a slot starts in the slot's folder with the slot's environment, and the slot comes back free", async () => {
	if (!repo) return;

	const slots = new SlotPool({ repo, state, config: poolConfig(pool, { runners: 1 }), base: "main" });
	const { runner } = await startBackgroundRunner({ state, model: MODEL, config: { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.5 }, repo });
	const taken = await slots.checkout({ remote, base: "main", item: "live", signal: undefined });

	try {
		const outcome = await runner.run({
			name: `${NAMED} where`,
			prompt: 'Run `pwd` and `echo $HUM_SLOT` as two Bash calls, then reply {"folder": <the pwd output>, "slot": <the echo output>}.',
			cwd: taken.folder,
			env: taken.env,
			model: MODEL,
			effort: "low",
			schema: WHERE,
		});

		expect(outcome).toMatchObject({ kind: "finished", structured: { slot: taken.env.HUM_SLOT } });
		expect(realpathSync(Reported.parse(outcome).structured.folder)).toBe(realpathSync(taken.folder));
	} finally {
		await taken.giveBack();
		await slots.idle();
	}

	expect(slots.list()).toMatchObject([{ status: "free" }]);
}, 300_000);
