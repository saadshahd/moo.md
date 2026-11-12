import type { ModelCall } from "../../src/adapters/model-call.ts";
import type { AlignmentAnswer } from "../../src/decide/alignment.ts";

/** Sound grades: the alignment call raises nothing. */
export const SOUND: AlignmentAnswer = { alignment: "sound", verification: "sound" };

/** What a scripted cheap model call answers; a boundary left out abstains. */
export type Scripted = { readonly kind?: { readonly kind: string }; readonly alignment?: AlignmentAnswer };

/** A cheap model call that answers each boundary from a script, read through the question's own schema. */
export const scriptedJudge =
	(answers: Scripted, asked: string[] = []): ModelCall =>
	async (question) => {
		asked.push(question.boundary);

		const parsed = question.answer.safeParse(new Map(Object.entries(answers)).get(question.boundary));

		return parsed.success ? { kind: "picked", value: parsed.data, models: ["fake-model"] } : { kind: "abstained", why: "no scripted answer fits" };
	};

/** The judge most tests run with: every item is docs, and every change is sound. */
export const docsJudge = scriptedJudge({ kind: { kind: "docs" }, alignment: SOUND });
