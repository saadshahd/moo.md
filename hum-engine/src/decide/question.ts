import { z } from "zod";
import type { Question } from "../adapter-api.ts";
import type { HumConfig } from "../config/schema.ts";
import { DAY_MS } from "../time.ts";

/** The reasons a run gives for needing the owner, each with the facts code checks it against. */
export const ASK_REASONS = ["missing-secret", "past-undoing", "spends-money", "publishes", "choice", "unsure"] as const;

export type AskReason = (typeof ASK_REASONS)[number];

const ChoiceOption = z.strictObject({ word: z.string().min(1), paths: z.array(z.string().min(1)) });

/** Why a run needs the owner, in the fields code can check. */
export const RunReason = z.strictObject({
	kind: z.enum(ASK_REASONS),
	/** The name of the secret the run lacks. */
	variable: z.string().min(1).optional(),
	/** The command that cannot be taken back. */
	command: z.string().min(1).optional(),
	options: z.array(ChoiceOption).optional(),
	default: z.string().min(1).optional(),
});

export type RunReason = z.infer<typeof RunReason>;

/** What code knows that a run's reason is checked against. */
export type AskFacts = {
	/** The names, never the values, of the variables the runner has. */
	readonly runnerVariables: ReadonlySet<string>;
	/** The files the change holds so far. */
	readonly changedPaths: readonly string[];
	readonly level: string;
	readonly undoableLevels: readonly string[];
};

export type AskDecision =
	/** `confirmed`: the facts bear the reason out, so its own question is asked; otherwise the owner gets the plain one. */
	| { readonly action: "ask"; readonly reason: AskReason; readonly confirmed: boolean }
	| { readonly action: "decide"; readonly choice: string; readonly over: readonly string[] };

/** A choice is cheap to undo when every option touches only the change's own files, on a level where that is safe. */
const isCheapChoice = ({ options = [], default: chosen }: RunReason, { changedPaths, level, undoableLevels }: AskFacts): boolean =>
	options.some(({ word }) => word === chosen) && undoableLevels.includes(level) && options.every(({ paths }) => paths.every((path) => changedPaths.includes(path)));

const CONFIRMS: Readonly<Record<AskReason, (reason: RunReason, facts: AskFacts) => boolean>> = {
	"missing-secret": ({ variable }, { runnerVariables }) => variable !== undefined && !runnerVariables.has(variable),
	"past-undoing": ({ command }) => command !== undefined,
	"spends-money": () => true,
	publishes: () => true,
	choice: () => false,
	unsure: () => true,
};

/** Whether the owner is asked: a reason the facts cannot confirm still asks, and a cheap choice is made without them. */
export const askDecision = (reason: RunReason, facts: AskFacts): AskDecision => {
	if (reason.kind === "choice" && isCheapChoice(reason, facts)) {
		return { action: "decide", choice: reason.default ?? "", over: (reason.options ?? []).map(({ word }) => word) };
	}

	return { action: "ask", reason: reason.kind, confirmed: CONFIRMS[reason.kind](reason, facts) };
};

/** The plain question each reason falls back to when the run's own text fails the rules; each passes them. */
export const PLAIN_QUESTIONS = {
	"missing-secret": "Can you set the secret the run lacks?",
	"past-undoing": "May the run take a step it cannot undo?",
	"spends-money": "May the run spend money?",
	publishes: "May the run publish this?",
	choice: "Which option should the run take?",
	unsure: "How should the run go on?",
	"over-cap": "Keep working past the token cap?",
	"owner-review": "Approve this change?",
	kind: "Which kind of work is this?",
	level: "Which level do these paths belong to?",
} as const satisfies Record<string, string>;

export type PlainQuestion = keyof typeof PLAIN_QUESTIONS;

/** The question each confirmed reason asks, from the facts the run named. */
const ASKED = {
	"missing-secret": ({ variable }) => `Can you set ${variable} for the runner?`,
	"past-undoing": ({ command }) => `May the run take ${command}?`,
	"spends-money": () => PLAIN_QUESTIONS["spends-money"],
	publishes: () => PLAIN_QUESTIONS.publishes,
	choice: () => PLAIN_QUESTIONS.choice,
	unsure: () => PLAIN_QUESTIONS.unsure,
} as const satisfies Record<AskReason, (reason: RunReason) => string>;

export type AskedQuestion = { readonly question: Question; readonly plain: PlainQuestion };

/** The question a run's need becomes. A reason the facts bear out asks its own question with the run's words folded; any other asks in the run's words. */
export const askedQuestion = (reason: RunReason, confirmed: boolean, runsWords: string | undefined): AskedQuestion => {
	const kind = confirmed ? reason.kind : "unsure";
	const options = reason.options?.map(({ word }) => word);

	return kind === "unsure"
		? { question: { text: runsWords ?? ASKED.unsure(), options }, plain: kind }
		: { question: { text: ASKED[kind](reason), options, detail: runsWords }, plain: kind };
};

/** Questions that settle a side matter while the item goes on; no run waits on them. */
const SIDE_QUESTIONS: readonly string[] = [PLAIN_QUESTIONS.kind, PLAIN_QUESTIONS.level];

/** Whether a question is one an item waits on, rather than a side question. */
export const isWaitQuestion = (text: string): boolean => !SIDE_QUESTIONS.includes(text);

/** Why a question text is refused. */
export type QuestionIssue = "too-wide" | "no-question-mark" | "names-item" | "long-word";

const QUESTION_MARK = "?";

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

const cellsOf = (text: string): number => Bun.stringWidth(text);

const WORD_EDGES = /^\W+|\W+$/g;

/** The question text rules: at most `cells` wide, ends in "?", names no item id, and no word over `wordCells`. */
export const questionIssues = (text: string, item: string, { cells, wordCells }: HumConfig["questionLimits"]): QuestionIssue[] => {
	const mentionsItem = words(text).some((word) => word.replaceAll(WORD_EDGES, "") === item);

	return [
		...(cellsOf(text) > cells ? (["too-wide"] as const) : []),
		...(text.trimEnd().endsWith(QUESTION_MARK) ? [] : (["no-question-mark"] as const)),
		...(mentionsItem ? (["names-item"] as const) : []),
		...(words(text).some((word) => cellsOf(word) > wordCells) ? (["long-word"] as const) : []),
	];
};

/** A question to put on the thread: the run's own text when it passes the rules, else the plain one with the run's text folded. */
export const composeQuestion = (draft: Question, plain: PlainQuestion, item: string, limits: HumConfig["questionLimits"]): Question => {
	if (questionIssues(draft.text, item, limits).length === 0) return draft;

	return { ...draft, text: PLAIN_QUESTIONS[plain], detail: [draft.text, draft.detail].filter(Boolean).join("\n\n") };
};

/** A question that waits for room under the daily cap. */
export type Waiting = {
	readonly item: string;
	/** The index of its best priority label; larger is later, and no label is last. */
	readonly priority: number;
	/** How many other waiting items clash with it, and so wait on its item. */
	readonly behind: number;
	readonly since: number;
};

/** Row 4's order: the owner's priority label, then how many items wait on it, then age. */
export const questionOrder = (a: Waiting, b: Waiting): number => a.priority - b.priority || b.behind - a.behind || a.since - b.since;

/** The priority of an item: the index of its first label in the owner's list, or past the end when it has none. */
export const priorityOf = (labels: readonly string[], priorityLabels: readonly string[]): number => {
	const found = priorityLabels.findIndex((label) => labels.includes(label));

	return found < 0 ? priorityLabels.length : found;
};

/** How many more questions the owner can be asked now: the cap less those asked within the last day. No cap leaves no limit. */
export const roomToAsk = (askedAt: readonly number[], cap: number | undefined, now: number): number =>
	cap === undefined ? Number.POSITIVE_INFINITY : Math.max(0, cap - askedAt.filter((at) => now - at < DAY_MS).length);
