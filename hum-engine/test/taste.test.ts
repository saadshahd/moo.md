import { expect, test } from "bun:test";
import { modelCallOver } from "../src/adapters/model-call.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { isTrusted } from "../src/decide/prose.ts";
import { tasteComment, tasteQuestion } from "../src/decide/taste.ts";
import { finished, runnerOf } from "./fixtures/records.ts";

test("a taste check with no measured rate still reports its pick, says so, and blocks nothing", async () => {
	const call = modelCallOver(runnerOf(async () => finished({ structured: { keeps: false, evidence: "+ let total = 0" } })), { model: "m", timeoutMs: 1000, trusts: () => false });
	const judged = await call(tasteQuestion("No mutation of a local.", "+ let total = 0", SHIPPED_DEFAULTS));

	expect(judged.kind).toBe("picked");

	const measured = isTrusted(["m"], "taste", SHIPPED_DEFAULTS);
	const comment = judged.kind === "picked" ? tasteComment([{ rule: "No mutation of a local.", answer: judged.value }], { measured }) : "";

	expect(measured).toBe(false);
	expect(comment).toContain("- broken: No mutation of a local.\n  > + let total = 0");
	expect(comment).toContain("not measured, so this is a report only. It blocks nothing.");
});
