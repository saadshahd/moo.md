import { expect, test } from "bun:test";
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
