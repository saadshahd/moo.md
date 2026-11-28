import { ADAPTER_API_VERSION, type Item, type ThreadEntry, type WorkSource } from "../adapter-api.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import { optionsIn } from "../adapters/marked.ts";
import { onceCalls } from "../adapters/once.ts";
import { dispose, type Disposition, matchOption, NONE_OF_THESE, replyQuestion, replyStem, replyText, type Resolution, STAGE_ACTIONS, type Stage } from "../decide/answer.ts";
import type { QuestionAnswer } from "../decide/talk.ts";
import { visibleText } from "../adapters/marked.ts";
import type { KeptAnswer, Wait } from "../state/events.ts";
import type { State } from "../state/open.ts";
import { changesPlan, type SettledAnswer } from "../state/saved.ts";
import { answerKey, givenAt, keepAnswer, keptAnswer, type Reading } from "./owner-answers.ts";
import { hasReplyOn, isFromHum, isHumQuestion, latestCloseAt, latestQuestionAt } from "./thread.ts";

export type AnswerContext = {
	readonly state: State;
	readonly workSource: WorkSource;
	readonly judge: ModelCall;
	readonly now: () => number;
};

/** What the reader knows about the item that the thread does not say. */
export type AnswerScope = {
	readonly stage: Stage;
	/** The options a card offers when no question does, such as the parked item's actions. */
	readonly options?: readonly string[];
	/** When the card was raised: an answer applied before it never drops a reply to the card. */
	readonly since?: number;
	/** The wait the item is in: its saved step, or its card where it is parked. An answer counts only for the wait it was given at. */
	readonly wait?: Wait;
};

/** A marked answer, or a person's reply typed without a marker. */
const isReply = (entry: ThreadEntry): boolean => entry.kind === "answer" || (entry.kind === "comment" && !isFromHum(entry));

type Reply = { readonly entry: ThreadEntry; readonly ordinal: number; readonly index: number };

/** Every reply on the thread, numbered from 1 in thread order. */
const numberedReplies = (thread: readonly ThreadEntry[]): Reply[] => {
	let ordinal = 0;

	return thread.flatMap((entry, index) => (isReply(entry) ? [{ entry, ordinal: ++ordinal, index }] : []));
};

/** The replies after the question at `afterQuestion`. Replies from people count only after a question; before one they are remarks. */
const repliesOn = (thread: readonly ThreadEntry[], afterQuestion: number): Reply[] =>
	numberedReplies(thread).filter(({ entry, index }) => index > afterQuestion && (afterQuestion >= 0 || entry.kind === "answer"));

const resolveReply = async (ctx: AnswerContext, { itemId, question, options, stage, reply: { entry } }: { readonly itemId: string; readonly question: string; readonly options: readonly string[]; readonly stage: Stage; readonly reply: Reply }): Promise<Resolution> => {
	const matched = matchOption(entry, options, STAGE_ACTIONS[stage]);

	if (matched) return matched;

	const judged = await ctx.judge({ ...replyQuestion({ question, options, reply: entry.text }), item: itemId });

	if (judged.kind === "abstained") return { source: "abstained", why: judged.why };

	return judged.value.option === NONE_OF_THESE ? { source: "none-of-these" } : { source: "model", option: judged.value.option };
};

const keyOf = (item: string, ordinal: number): string => `${item}#${ordinal}`;

/** A resolution as its settled answer saves it; an abstention's own why gives way to the disposition's. */
const savedResolution = (resolution: Resolution) => (resolution.source === "abstained" ? { source: resolution.source } : resolution);

const recordOf = (item: string, { entry, ordinal }: Reply, resolution: Resolution, outcome: Disposition, at: number): SettledAnswer => ({
	item,
	ordinal,
	text: entry.text,
	disposition: outcome.disposition,
	why: outcome.why,
	at,
	...savedResolution(resolution),
});

/** How a resolution reads the owner's answer: the option it picked, empty where it picked none, and how. */
const readingOf = (resolution: { readonly source: Resolution["source"]; readonly option?: string }): Pick<Reading, "choice" | "read"> => ({ choice: resolution.option ?? "", read: resolution.source });

/** The resolution a kept answer was read as. */
const resolutionOf = ({ read, choice }: Pick<KeptAnswer, "read" | "choice">): Resolution => {
	switch (read) {
		case "abstained":
			return { source: read, why: "" };
		case "marker":
			return choice === "" ? { source: read } : { source: read, option: choice };
		case "first-word":
		case "model":
			return { source: read, option: choice };
		case "free":
		case "none-of-these":
			return { source: read };
	}
};

const isFinal = ({ disposition }: SettledAnswer): boolean => disposition !== "held";

/** The answer as the engine reads it from here on: the choice its kept answer picked, keyed to that answer, or no longer an answer at all. */
const normalized = (entry: ThreadEntry, record: SettledAnswer, kept: KeptAnswer | undefined): ThreadEntry =>
	record.disposition === "applied" && kept !== undefined ? { ...entry, kind: "answer", option: kept.choice === "" ? undefined : kept.choice, id: answerKey(entry) } : { ...entry, kind: "comment", option: undefined };

const SUPERSEDED: Disposition = { disposition: "dropped", why: "A newer question replaced the one this answered." };

type Settling = { readonly ctx: AnswerContext; readonly item: Item; readonly question: string; readonly options: readonly string[]; readonly stage: Stage; readonly wait: Wait | undefined };

const CLOSED: Disposition = { disposition: "dropped", why: "hum closed the question before this answer, as its wait ended without one." };

/**
 * One reply's record: kept once final, else decided again from where the item stands now; a reply to a question hum
 * closed is dropped. The reply is read once, into the owner's answer the item's log keeps, and decided from that.
 */
const settleOne = async ({ ctx, item, question, options, stage, wait }: Settling, { reply, answeredBefore, closed }: { readonly reply: Reply; readonly answeredBefore: boolean; readonly closed: boolean }): Promise<{ record: SettledAnswer; resolution: Resolution }> => {
	const saved = ctx.state.answers.get(keyOf(item.id, reply.ordinal));

	const kept = await keepAnswer(ctx.state.events, item.id, reply.entry, async () => ({
		wait: givenAt(wait, reply.entry.at),
		...readingOf(saved ?? (await resolveReply(ctx, { itemId: item.id, question, options, stage, reply }))),
	}));

	const resolution = resolutionOf(kept);

	if (saved && isFinal(saved)) return { record: saved, resolution };

	const outcome = closed ? CLOSED : dispose({ resolution, answeredBefore, stage, question });
	const record = saved?.disposition === outcome.disposition ? saved : recordOf(item.id, reply, resolution, outcome, ctx.now());

	if (record !== saved) ctx.state.answers.put(keyOf(item.id, reply.ordinal), record);

	return { record, resolution };
};

/** Answers held for a question that a newer one replaced can no longer take effect. */
const dropSuperseded = async ({ ctx, item }: Settling, current: ReadonlySet<number>): Promise<void> => {
	for (const held of ctx.state.answers.list()) {
		if (held.item !== item.id || held.disposition !== "held" || current.has(held.ordinal)) continue;

		ctx.state.answers.put(keyOf(item.id, held.ordinal), { ...held, disposition: SUPERSEDED.disposition, why: SUPERSEDED.why });
		await onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: ctx.workSource }, ctx.state.ops, { run: "answer-reply", attempt: 0 }).workSource?.comment(item.id, replyText(held.ordinal, SUPERSEDED, resolutionOf(readingOf(held)), [], held.text));
	}
};

/**
 * D4: every answer on the item's thread is saved with what became of it, and gets one reply: applied, held, or
 * dropped and why. A reply after hum closed its question answers nothing, unless a card asks for one. An answer's option comes from its marker, else its first word, else the cheap model call.
 * Returns the item with its thread as the engine reads it: an applied reply is an answer carrying its option, any
 * other is a comment.
 */
export const settleAnswers = async (ctx: AnswerContext, item: Item, { stage, options: cardOptions, since, wait }: AnswerScope): Promise<Item> => {
	const asked = latestQuestionAt(item.thread);
	const questionText = asked < 0 ? "" : (item.thread[asked]?.text ?? "");
	const settling: Settling = { ctx, item, question: visibleText(questionText), options: cardOptions ?? optionsIn(questionText), stage, wait };
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: ctx.workSource }, ctx.state.ops, { run: "answer-reply", attempt: 0 });
	const settled = new Map<number, SettledAnswer>();
	const replies = repliesOn(item.thread, asked);
	const closedAt = latestCloseAt(item.thread);

	for (const reply of replies) {
		const answeredBefore = [...settled].some(([index, { disposition }]) => disposition === "applied" && (since === undefined || (item.thread[index]?.at ?? since) > since));
		const toClosed = cardOptions === undefined && closedAt >= 0 && reply.index > closedAt;
		const reading = toClosed ? { ...settling, options: [] } : settling;
		const { record, resolution } = await settleOne(reading, { reply, answeredBefore, closed: toClosed });
		const outcome = { disposition: record.disposition, why: record.why };

		settled.set(reply.index, record);

		if (!hasReplyOn(item.thread, replyStem(reply.ordinal, outcome))) await calls.workSource?.comment(item.id, replyText(reply.ordinal, outcome, resolution, reading.options, reply.entry.text));
	}

	await dropSuperseded(settling, new Set(replies.map(({ ordinal }) => ordinal)));

	return withSettledAnswers(ctx.state, item);
};

/** One of hum's questions on an item's thread, the owner's answer to it, and when the owner gave it. */
export type OwnerAnswer = QuestionAnswer & { readonly at: number };

/** A reply on the item's thread that hum settled, with the owner's answer its log keeps for it and what became of it. */
type KeptReply = { readonly reply: Reply; readonly kept: KeptAnswer; readonly record: SettledAnswer };

/** Every reply on the item's thread that hum settled, oldest first, read from the owner's answers its log keeps. */
const keptReplies = (state: Pick<State, "answers" | "events">, item: Item): KeptReply[] =>
	numberedReplies(item.thread).flatMap((reply) => {
		const record = state.answers.get(keyOf(item.id, reply.ordinal));
		const kept = keptAnswer(state.events, item.id, reply.entry);

		return record && kept ? [{ reply, kept, record }] : [];
	});

/** The latest of the owner's answers that took effect picking one of `choices`, given from `since` on, as the item's log keeps it. */
export const pickedChoice = (state: Pick<State, "answers" | "events">, item: Item, choices: readonly string[], since = 0): KeptAnswer | undefined =>
	keptReplies(state, item).findLast(({ kept, record }) => record.disposition === "applied" && kept.at >= since && choices.includes(kept.choice))?.kept;

/**
 * The owner's answers that changed the plan, oldest first, in their words as the item's log keeps them, each with
 * hum's question before it on the thread. Picks of `steering`, hum's own options, are not among them.
 */
export const planChangingAnswers = (state: Pick<State, "answers" | "events">, item: Item, steering: ReadonlySet<string>): OwnerAnswer[] =>
	keptReplies(state, item).flatMap(({ reply: { index }, kept, record }) => {
		const asked = item.thread.slice(0, index).findLast(isHumQuestion);

		return asked && changesPlan({ disposition: record.disposition, option: kept.choice === "" ? undefined : kept.choice }, steering) ? [{ question: asked.text, answer: kept.text, at: kept.at }] : [];
	});

/**
 * The item with its thread as the engine reads it, from the answers `state` saved and with no call: a reply to hum's
 * latest question whose saved answer applied is an answer carrying the choice of the owner's answer its log keeps,
 * one whose saved answer did not is a comment, and one with no saved answer stays as the source gave it.
 */
export const withSettledAnswers = (state: Pick<State, "answers" | "events">, item: Item): Item => {
	const saved = new Map(
		repliesOn(item.thread, latestQuestionAt(item.thread)).flatMap(({ ordinal, index }) => {
			const record = state.answers.get(keyOf(item.id, ordinal));

			return record ? [[index, record] as const] : [];
		}),
	);

	const asEngineReads = (entry: ThreadEntry, index: number): ThreadEntry => {
		const record = saved.get(index);

		return record ? normalized(entry, record, keptAnswer(state.events, item.id, entry)) : entry;
	};

	return { ...item, thread: item.thread.map(asEngineReads) };
};
