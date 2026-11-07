import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRunner, succeeded } from "../src/adapters/claude-p.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { openState } from "../src/state/open.ts";

const live = process.env.HUM_LIVE === "1";

if (!live) console.log("skip live start check: set HUM_LIVE=1 to call the real claude binary on Haiku (two calls)");

test.skipIf(!live)("live: the start check passes on Haiku, and a run reports the session id it was given", async () => {
	const state = openState(mkdtempSync(join(tmpdir(), "hum-live-")));
	const model = SHIPPED_DEFAULTS.models.light;
	const { check: started, runner } = await startRunner({ state, model });

	expect(state.faults.list()).toEqual([]);
	expect(started.kind).toBe("finished");

	if (started.kind !== "finished") return;

	expect(succeeded(started)).toBe(true);
	expect(started.plugins).toContain("hope");
	expect(started.structured).toEqual({ ok: true });

	const sessionId = crypto.randomUUID();
	const run = await runner.run({ prompt: 'Reply with the JSON {"ok":true}.', cwd: tmpdir(), model, effort: "low", schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] }, sessionId });

	expect(run.kind).toBe("finished");
	expect(run.kind === "finished" && run.sessionId).toBe(sessionId);
}, 180_000);
