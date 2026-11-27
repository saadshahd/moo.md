import { expect, test } from "bun:test";
import type { Json } from "../src/config/json.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { installedCli } from "../src/engine.ts";
import { startRow } from "../src/adapters/rail-rows.ts";
import type { RoundupCall } from "../src/adapters/roundup-rpc.ts";
import { keepSchema, runFolder, runFolders, runKey, saveAnswer, takeAnswer } from "../src/adapters/run-answer.ts";
import { RUN_SCHEMA } from "../src/worker/thin-path.ts";
import { tempDir } from "./fixtures/temp.ts";

const RUN = "hum 7 build #1";

test("a saved answer counts only under its own run's key", () => {
	const stateDir = tempDir("run-answer");
	const folder = runFolder(stateDir, RUN);

	keepSchema(folder, { schema: RUN_SCHEMA });
	saveAnswer(folder, runKey(stateDir, "hum 7 build #2"), RUN, JSON.stringify({ status: "needs-owner", question: "forged" }));

	expect(takeAnswer(folder, runKey(stateDir, RUN), RUN)).toBeUndefined();

	saveAnswer(folder, runKey(stateDir, RUN), RUN, JSON.stringify({ status: "done" }));

	expect(takeAnswer(folder, runKey(stateDir, RUN), RUN)).toEqual({ status: "done" });
});

test("the run folders under hum's state are the runs' own: the secret beside them is no run", () => {
	const stateDir = tempDir("run-answer");
	const folder = runFolder(stateDir, RUN);

	keepSchema(folder, { schema: RUN_SCHEMA });
	runKey(stateDir, RUN);

	expect(runFolders(stateDir)).toEqual([folder]);
});

test("a row's brief pipes its answer to the engine the repo installs, so a row that outlives an update answers the new engine", async () => {
	const repo = tempDir("owner");
	const stateDir = tempDir("run-answer");
	const pads: Json[] = [];

	const replies = new Map<string, Json>([
		["project.get", { models: { roles: [] } }],
		["agent.spawn", { id: "9", name: RUN, kind: "agent" }],
	]);

	const call: RoundupCall = async (method, params = {}) => {
		if (method === "pad.create") pads.push(params.text ?? null);

		return replies.get(method) ?? {};
	};

	await startRow(call, { repo, stateDir, config: SHIPPED_DEFAULTS }, { name: RUN, folder: runFolder(stateDir, RUN), request: { prompt: "work", cwd: repo, model: "m", effort: "low" }, answer: { by: "pipe", schema: RUN_SCHEMA }, workstream: "1" });

	expect(String(pads[0])).toContain(`'${installedCli(repo)}'`);
});
