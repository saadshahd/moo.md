import { askOf } from "../adapters/model-call.ts";
import { hashJson } from "../config/hash.ts";
import { asJson } from "../config/json.ts";
import { BOUNDARIES, type Boundary, type HumConfig, type Score } from "../config/schema.ts";
import { alignmentQuestion } from "../decide/alignment.ts";
import { replyQuestion } from "../decide/answer.ts";
import { kindQuestion } from "../decide/kind.ts";
import { type ModelAsk, PROSE_STATES } from "../decide/prose.ts";
import { tasteQuestion } from "../decide/taste.ts";
import { pairQuestion } from "../loop/pair.ts";
import type { ReviewNote } from "../loop/records.ts";
import { proseAsk } from "../worker/prose-run.ts";
import { PROSE_PROMPTS, type RunConfig } from "../worker/thin-path.ts";

const BLANK_ITEM = { id: "", title: "", body: "" };

const BLANK_NOTE: ReviewNote = { source: "review-comment", sourceId: "", change: "", hunk: "", text: "", at: 0 };

/** What each judge is sent around an empty case: its prompt, with the role text and skills of a plan or review run, and the answer form. */
const JUDGE_ASKS = {
	kind: ({ hum }) => askOf(kindQuestion(BLANK_ITEM, hum)),
	alignment: ({ hum }) => askOf(alignmentQuestion(BLANK_ITEM, "", hum)),
	"plan-outcome": (config) => proseAsk(PROSE_PROMPTS.plan(config, BLANK_ITEM), PROSE_STATES.plan.events),
	"review-verdict": (config) => proseAsk(PROSE_PROMPTS.review(config, BLANK_ITEM, ""), PROSE_STATES.review.events),
	"reply-option": () => askOf(replyQuestion({ question: "", options: [], reply: "" })),
	"repeat-pair": () => askOf(pairQuestion(BLANK_NOTE, BLANK_NOTE)),
	taste: ({ hum }) => askOf(tasteQuestion("", "", hum)),
} as const satisfies Record<Boundary, (config: RunConfig) => ModelAsk>;

/** The hash of what a judge reads besides its case: a change to its prompt, role text, skills or answer form changes it. */
export const judgeHash = (boundary: Boundary, config: RunConfig): string => hashJson(asJson(JUDGE_ASKS[boundary](config)));

/** The boundaries measured on the labelled sets hum ships; taste is measured on cases only the owner can label. */
export const SHIPPED_SETS: readonly Boundary[] = BOUNDARIES.filter((boundary) => boundary !== "taste");

/** The model ids hum runs: each tier's and the cheap call's. */
export const runModels = ({ models, decisionModel }: Pick<HumConfig, "models" | "decisionModel">): string[] => [...new Set([...Object.values(models), decisionModel])];

/** A model's score at a boundary whose judge no longer reads what it read when the score was measured. Its rate gates until a new measurement replaces it. */
export type StaleScore = { readonly boundary: Boundary; readonly model: string; readonly score: Score };

/** Each score of a model hum runs, at a boundary measured on hum's own sets, whose judge has changed since, or whose judge was never recorded. */
export const staleScores = (config: RunConfig): StaleScore[] =>
	SHIPPED_SETS.flatMap((boundary) => {
		const now = judgeHash(boundary, config);

		return runModels(config.hum).flatMap((model) => {
			const score = config.hum.measuredModels[boundary]?.[model];

			return score !== undefined && score.judgeHash !== now ? [{ boundary, model, score }] : [];
		});
	});
