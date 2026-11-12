import { z } from "zod";
import type { HumConfig } from "../config/schema.ts";
import { DATA_RULE, fenced } from "./prose.ts";

/** Whether the diff keeps one taste rule, and the line of the diff that shows it. */
const TasteAnswer = z.strictObject({ keeps: z.boolean(), evidence: z.string() });

type TasteAnswer = z.infer<typeof TasteAnswer>;

/** The cheap model call that checks a diff against one taste rule. Its pick is for a report and decides nothing. */
export const tasteQuestion = (rule: string, diff: string, { diffLimit }: Pick<HumConfig, "diffLimit">) => ({
	boundary: "taste" as const,
	reportOnly: true as const,
	prompt: [
		"Check this change against the owner's rule. keeps: true when the diff keeps the rule or does not touch it, false when it breaks it. evidence: the line of the diff that shows it, or an empty string.",
		DATA_RULE,
		fenced("rule", rule),
		fenced("diff", diff.slice(0, diffLimit)),
	].join("\n\n"),
	answer: TasteAnswer,
});

/** One rule's result: its answer, or why the call gave none. */
export type TasteResult = { readonly rule: string; readonly answer: TasteAnswer | { readonly abstained: string } };

/** The pull request comment. It only reports; `measured` says whether the model's rate at this boundary meets the bar. */
export const tasteComment = (results: readonly TasteResult[], { measured }: { readonly measured: boolean }): string => {
	const lines = results.map(({ rule, answer }) => {
		if ("abstained" in answer) return `- ? ${rule} (not checked: ${answer.abstained})`;

		return answer.keeps ? `- kept: ${rule}` : `- broken: ${rule}${answer.evidence === "" ? "" : `\n  > ${answer.evidence}`}`;
	});

	const status = measured ? "The model's rate on the owner's past violations meets the bar." : "The model's rate on the owner's past violations is not measured, so this is a report only.";

	return ["hum checked this change against the owner's taste rules.", lines.join("\n"), `${status} It blocks nothing.`].join("\n\n");
};
