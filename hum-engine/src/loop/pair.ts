import { z } from "zod";
import type { Question } from "../adapters/model-call.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import type { HumConfig } from "../config/schema.ts";
import { DATA_RULE, fenced } from "../decide/prose.ts";
import { LOOP_SPEND_PREFIX } from "../measure/inputs.ts";
import type { Proposer } from "./groups.ts";
import { noteKey, type ReviewNote } from "./records.ts";

const SamePair = z.strictObject({ same: z.boolean() });

const described = (label: string, { text, file }: ReviewNote): string => fenced(label, file === undefined ? text : `${file}\n${text}`);

/** The cheap model call that says whether two review notes state one rule. */
export const pairQuestion = (a: ReviewNote, b: ReviewNote): Question<z.infer<typeof SamePair>> => ({
	boundary: "repeat-pair",
	prompt: [
		"Two review notes follow. Say whether they ask for the same thing: the same behaviour to do or to avoid, whatever the wording. One may be a terse complaint and the other a formal rule. Notes about the same area that ask for different things are not the same.",
		DATA_RULE,
		described("note-a", a),
		described("note-b", b),
		'Answer with JSON {"same": true} or {"same": false}.',
	].join("\n\n"),
	answer: SamePair,
	item: `${LOOP_SPEND_PREFIX}${noteKey(b)}`,
});

/** Row 14's model call as a proposer; an abstention is no proposal. */
export const modelProposer =
	(call: ModelCall): Proposer =>
	async (a, b) => {
		const judged = await call(pairQuestion(a, b));

		return judged.kind === "picked" ? { same: judged.value.same, models: judged.models } : undefined;
	};

/** Whether every model id behind a proposal reached the owner's precision bar on labelled pairs. */
export const doesTrustRepeats = (models: readonly string[], { measuredModels, repeatPrecision }: Pick<HumConfig, "measuredModels" | "repeatPrecision">): boolean =>
	models.length > 0 && models.every((model) => (measuredModels["repeat-pair"]?.[model] ?? 0) >= repeatPrecision);
