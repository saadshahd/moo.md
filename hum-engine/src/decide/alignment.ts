import { z } from "zod";
import type { Item } from "../adapter-api.ts";
import { GRADED, type HumConfig } from "../config/schema.ts";
import { DATA_RULE, fenced } from "./prose.ts";
import type { Placement } from "./risk.ts";

const Grade = z.enum(["sound", "partial", "concern"]);

/** A category's grade: 1 sound, 2 worth a look, 3 a concern. */
export const GRADES = { sound: 1, partial: 2, concern: 3 } as const satisfies Record<z.infer<typeof Grade>, number>;

/** Whether the diff does what the item asked, and whether its proof shows it. */
export const AlignmentAnswer = z.strictObject({ alignment: Grade, verification: Grade });

export type AlignmentAnswer = z.infer<typeof AlignmentAnswer>;

/** The cheap model call that grades a change against the item it answers. */
export const alignmentQuestion = (item: Pick<Item, "title" | "body">, diff: string, { diffLimit }: Pick<HumConfig, "diffLimit">) => ({
	boundary: "alignment" as const,
	prompt: [
		"Grade this change against the item it answers. alignment: does the diff do what the item asked, no more and no less? verification: do the tests or proof in the diff show it works? Grade each sound, partial or concern.",
		DATA_RULE,
		fenced("item", `${item.title}\n\n${item.body}`),
		fenced("diff", diff.slice(0, diffLimit)),
	].join("\n\n"),
	answer: AlignmentAnswer,
});

type Grades = Readonly<Record<(typeof GRADED)[number], number>>;

const scoreOf = (grades: Grades, weights: Grades): number => {
	const weighed = GRADED.map((category) => grades[category] * weights[category]);
	const total = GRADED.map((category) => weights[category]);

	return weighed.reduce((sum, value) => sum + value, 0) / total.reduce((sum, value) => sum + value, 0);
};

const bandOf = (score: number, cuts: readonly number[]): number => cuts.filter((cut) => score >= cut).length;

/** The grade code gives impact, rollback and error detection: the level's place among the levels, spread from sound to a concern. */
const gradeOfRank = (rank: number, levels: number): number => (levels < 2 ? GRADES.sound : GRADES.sound + ((GRADES.concern - GRADES.sound) * rank) / (levels - 1));

/**
 * Whether the alignment call's grades raise the level one step: they put the merge-risk score in a higher band than
 * sound grades would at the same level. The call never lowers a level.
 */
export const raisesLevel = (rank: number, levels: number, answer: AlignmentAnswer, { mergeRisk }: Pick<HumConfig, "mergeRisk">): boolean => {
	const fromLevel = gradeOfRank(rank, levels);

	const scored = (alignment: number, verification: number): number =>
		bandOf(scoreOf({ impact: fromLevel, rollback: fromLevel, errorDetection: fromLevel, alignment, verification }, mergeRisk.weights), mergeRisk.cuts);

	return scored(GRADES[answer.alignment], GRADES[answer.verification]) > scored(GRADES.sound, GRADES.sound);
};

/** The placement after the alignment call: one step up when its grades raise the level, else as it was. */
export const alignedPlacement = (placement: Placement, answer: AlignmentAnswer, config: Pick<HumConfig, "levels" | "mergeRisk">): Placement => {
	const rank = config.levels.findIndex(({ name }) => name === placement.level.name);
	const above = config.levels[Math.min(rank + 1, config.levels.length - 1)];

	return above && raisesLevel(rank, config.levels.length, answer, config) ? { ...placement, level: above, steps: [...placement.steps, { step: "alignment" }] } : placement;
};
