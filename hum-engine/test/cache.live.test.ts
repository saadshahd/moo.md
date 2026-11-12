import { expect, test } from "bun:test";
import { type RunOutcome, startRunner } from "../src/adapters/claude-p.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { openState } from "../src/state/open.ts";
import { PrefixGate } from "../src/worker/scheduler.ts";
import { tempDir } from "./fixtures/temp.ts";

const live = process.env.HUM_LIVE === "1";

if (!live) console.log("skip live prompt-cache check: set HUM_LIVE=1 to make four real claude calls on Haiku (one start check, three runs)");

const SCHEMA = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };

test.skipIf(!live)("live: the runs that wait for the first token read the shared prefix from the cache", async () => {
	const state = openState(tempDir("cache"));
	const model = SHIPPED_DEFAULTS.models.light;
	const { runner } = await startRunner({ state, model });
	expect(state.faults.list()).toEqual([]);

	const gate = new PrefixGate({ now: Date.now });
	const prompt = `Reply with the JSON {"ok":true}. Say nothing else.`;

	const go = async (): Promise<RunOutcome> => {
		const lease = await gate.enter("role");

		try {
			return await runner.run({ prompt, cwd: tempDir("cache-run"), model, effort: "low", schema: SCHEMA, onFirstToken: lease.opened });
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
