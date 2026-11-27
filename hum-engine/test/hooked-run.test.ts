import { expect, test } from "bun:test";
import { answerHooks, ownerAnswers } from "../src/adapters/hooked-run.ts";
import { answeredHook } from "./fixtures/ask-hook.ts";
import { tempDir } from "./fixtures/temp.ts";

test("the answer hook reports the owner's answer and ends the run's turn; only an AskUserQuestion answer counts, and one of another shape reads as none", () => {
	const hooks = tempDir("hooks");
	const [hook] = answerHooks(hooks).PostToolUse;
	const fire = (input: string) => Bun.spawnSync(["sh", "-c", hook?.hooks[0]?.command ?? "false"], { stdin: Buffer.from(input) });

	const answered = fire(JSON.stringify(answeredHook("approve, but rename the flag to --out")));

	fire(JSON.stringify({ ...answeredHook("approve"), tool_name: "Bash" }));
	fire(JSON.stringify({ ...answeredHook("approve"), tool_response: {} }));

	expect(JSON.parse(answered.stdout.toString())).toEqual({ continue: false, stopReason: "hum has your answer" });
	expect(ownerAnswers(hooks).map(({ answers }) => answers)).toEqual([{ "Approve this change?": "approve, but rename the flag to --out" }, undefined]);
});
