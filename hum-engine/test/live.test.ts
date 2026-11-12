import { randomUUID } from "node:crypto";
import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { startRunner, hasSucceeded } from "../src/adapters/claude-p.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { markdownAdapter } from "../src/adapters/markdown.ts";
import { openState } from "../src/state/open.ts";
import { runThinPath } from "../src/worker/thin-path.ts";
import { configWith } from "./fixtures/config.ts";
import { markdownSettings, WorkRepo } from "./fixtures/work-repo.ts";
import { tempDir } from "./fixtures/temp.ts";

const live = process.env.HUM_LIVE === "1";

if (!live) console.log("skip live start check: set HUM_LIVE=1 to call the real claude binary on Haiku (two calls)");

test.skipIf(!live)("live: the start check passes on Haiku, and a run reports the session id it was given", async () => {
	const state = openState(tempDir("live"), { now: Date.now });
	const model = SHIPPED_DEFAULTS.models.light;
	const { check: started, runner } = await startRunner({ state, model, now: Date.now, env: process.env });

	expect(state.faults.list()).toEqual([]);
	expect(started.kind).toBe("finished");

	if (started.kind !== "finished") return;

	expect(hasSucceeded(started)).toBe(true);
	expect(started.plugins).toContain("hope");
	expect(started.structured).toEqual({ ok: true });

	const sessionId = crypto.randomUUID();
	const run = await runner.run({ prompt: 'Reply with the JSON {"ok":true}.', cwd: tmpdir(), model, effort: "low", schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] }, sessionId });

	expect(run.kind).toBe("finished");
	expect(run.kind === "finished" && run.sessionId).toBe(sessionId);
}, 180_000);

if (!live) console.log("skip live plan and review: set HUM_LIVE=1 to run a feature item's plan, build and review runs and its cheap calls on Haiku (about six calls)");

test.skipIf(!live)("live: a feature item runs its plan and review states on Haiku, and the change lands or waits by the review's pick", async () => {
	const config = configWith((raw) => void (raw.hum.models = { light: SHIPPED_DEFAULTS.models.light, standard: SHIPPED_DEFAULTS.models.light, top: SHIPPED_DEFAULTS.models.light }));
	const repo = new WorkRepo();
	const state = openState(tempDir("live-thin"), { now: Date.now });
	const adapter = markdownAdapter({ ...markdownSettings, repo: repo.worker("w") }, { report: () => {}, now: Date.now, env: process.env });
	const { runner } = await startRunner({ state, model: config.hum.models.light, now: Date.now, env: process.env });
	const id = repo.add("live-1", `---\ntitle: Write the note\nstate: ready\nkind: feature\n---\n\nCreate docs/note.md holding one line: hello.\n`);

	const result = await runThinPath({ workSource: adapter.workSource!, questions: adapter.questions!, state, runner, config, remote: repo.remote, checks: ["test -f docs/note.md"], holder: "live", workDir: tempDir("live-work"), now: Date.now, newSessionId: randomUUID, runnerVariables: new Set(Object.keys(process.env)) });
	const runs = state.runs.list(id).map((record) => record.run);

	expect(runs).toContain("plan");
	expect(runs).toContain("build");
	expect(runs).toContain("review");
	expect(["merged", "review"]).toContain(result.outcome);
	console.log(`live plan and review: ${result.outcome}, runs ${runs.join(", ")}`);
}, 900_000);
