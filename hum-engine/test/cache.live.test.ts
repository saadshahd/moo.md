import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeRunner, type RunOutcome, TIER_MODELS } from "../src/adapters/claude-p.ts";
import { openState } from "../src/state/open.ts";
import { PrefixGate } from "../src/worker/scheduler.ts";

const live = process.env.HUM_LIVE === "1";

if (!live) console.log("skip live E4: set HUM_LIVE=1 to make four real claude calls on Haiku (one start check, three runs)");

const SCHEMA = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };

test.skipIf(!live)("live E4: the runs that wait for the first token read the shared prefix from the cache", async () => {
	const state = openState(mkdtempSync(join(tmpdir(), "hum-cache-")));
	const runner = new ClaudeRunner({ state });

	await runner.start(TIER_MODELS.light);
	expect(state.faults.list()).toEqual([]);

	const gate = new PrefixGate();
	const prompt = `Reply with the JSON {"ok":true}. Say nothing else.`;

	const go = async (): Promise<RunOutcome> => {
		const lease = await gate.enter("role");

		try {
			return await runner.run({ prompt, cwd: mkdtempSync(join(tmpdir(), "hum-cache-run-")), model: TIER_MODELS.light, effort: "low", schema: SCHEMA, onFirstToken: lease.opened });
		} finally {
			lease.release();
		}
	};

	const first = await go();
	const [second, third] = await Promise.all([go(), go()]);

	const reads = [first, second, third].map((outcome) => (outcome.kind === "finished" ? outcome.cacheReadTokens : -1));

	console.log("cache read tokens, per run:", reads);
	expect(reads[1]).toBeGreaterThan(0);
	expect(reads[2]).toBeGreaterThan(0);
}, 300_000);
