import { ADAPTER_API_VERSION, type Item, type ThreadEntry, type WorkSource } from "../adapter-api.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import { optionsIn } from "../adapters/marked.ts";
import { onceCalls } from "../adapters/once.ts";
import { dispose, type Disposition, matchOption, NONE_OF_THESE, replyQuestion, replyStem, replyText, type Resolution, type Stage } from "../decide/answer.ts";
import { visibleText } from "../adapters/marked.ts";
import type { State } from "../state/open.ts";
import { optionOf, type SettledAnswer } from "../state/saved.ts";
import { isFromHum, latestQuestionAt } from "./thread.ts";

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
};

/** A marked answer, or a person's reply typed without a marker. */
const isReply = (entry: ThreadEntry): boolean => entry.kind === "answer" || (entry.kind === "comment" && !isFromHum(entry));

type Reply = { readonly entry: ThreadEntry; readonly ordinal: number; readonly index: number };

/** Every reply on the thread, numbered. Replies from people count only after a question; before one they are remarks. */
const repliesOn = (thread: readonly ThreadEntry[], afterQuestion: number): Reply[] => {
	let ordinal = 0;

	return thread.flatMap((entry, index) => {
		if (!isReply(entry)) return [];

		ordinal++;

		return index > afterQuestion && (afterQuestion >= 0 || entry.kind === "answer") ? [{ entry, ordinal, index }] : [];
	});
};

const resolveReply = async (ctx: AnswerContext, { itemId, question, options, reply: { entry } }: { readonly itemId: string; readonly question: string; readonly options: readonly string[]; readonly reply: Reply }): Promise<Resolution> => {
	const matched = matchOption(entry, options);

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

const resolutionOf = (record: SettledAnswer): Resolution => {
	switch (record.source) {
		case "abstained":
			return { source: record.source, why: record.why };
		case "marker":
			return { source: record.source, option: record.option };
		case "first-word":
		case "model":
			return { source: record.source, option: record.option };
		case "free":
		case "none-of-these":
			return { source: record.source };
	}
};

const isFinal = ({ disposition }: SettledAnswer): boolean => disposition !== "held";

const hasReplyOn = (thread: readonly ThreadEntry[], stem: string): boolean => thread.some((entry) => isFromHum(entry) && entry.kind === "comment" && entry.text.startsWith(stem));

/** The answer as the engine reads it from here on: the option it picked, or no longer an answer at all. */
const normalized = (entry: ThreadEntry, record: SettledAnswer): ThreadEntry =>
	record.disposition === "applied" ? { ...entry, kind: "answer", option: optionOf(record) } : { ...entry, kind: "comment", option: undefined };

const SUPERSEDED: Disposition = { disposition: "dropped", why: "A newer question replaced the one this answered." };

type Settling = { readonly ctx: AnswerContext; readonly item: Item; readonly question: string; readonly options: readonly string[]; readonly stage: Stage };

/** One reply's record: kept once final, else decided again from where the item stands now. */
const settleOne = async ({ ctx, item, question, options, stage }: Settling, { reply, answeredBefore }: { readonly reply: Reply; readonly answeredBefore: boolean }): Promise<{ record: SettledAnswer; resolution: Resolution }> => {
	const saved = ctx.state.answers.get(keyOf(item.id, reply.ordinal));
	const resolution = saved ? resolutionOf(saved) : await resolveReply(ctx, { itemId: item.id, question, options, reply });

	if (saved && isFinal(saved)) return { record: saved, resolution };

	const outcome = dispose({ resolution, answeredBefore, stage });
	const record = saved?.disposition === outcome.disposition ? saved : recordOf(item.id, reply, resolution, outcome, ctx.now());

	if (record !== saved) ctx.state.answers.put(keyOf(item.id, reply.ordinal), record);

	return { record, resolution };
};

/** Answers held for a question that a newer one replaced can no longer take effect. */
const dropSuperseded = async ({ ctx, item }: Settling, current: ReadonlySet<number>): Promise<void> => {
	for (const held of ctx.state.answers.list()) {
		if (held.item !== item.id || held.disposition !== "held" || current.has(held.ordinal)) continue;

		ctx.state.answers.put(keyOf(item.id, held.ordinal), { ...held, disposition: SUPERSEDED.disposition, why: SUPERSEDED.why });
		await onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: ctx.workSource }, ctx.state.ops, { run: "answer-reply", attempt: 0 }).workSource?.comment(item.id, replyText(held.ordinal, SUPERSEDED, resolutionOf(held), [], held.text));
	}
};

/**
 * D4: every answer on the item's thread is saved with what became of it, and gets one reply: applied, held, or
 * dropped and why. An answer's option comes from its marker, else its first word, else the cheap model call.
 * Returns the item with its thread as the engine reads it: an applied reply is an answer carrying its option, any
 * other is a comment.
 */
export const settleAnswers = async (ctx: AnswerContext, item: Item, { stage, options: cardOptions }: AnswerScope): Promise<Item> => {
	const asked = latestQuestionAt(item.thread);
	const questionText = asked < 0 ? "" : (item.thread[asked]?.text ?? "");
	const settling: Settling = { ctx, item, question: visibleText(questionText), options: cardOptions ?? optionsIn(questionText), stage };
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: ctx.workSource }, ctx.state.ops, { run: "answer-reply", attempt: 0 });
	const settled = new Map<number, SettledAnswer>();
	const replies = repliesOn(item.thread, asked);

	for (const reply of replies) {
		const answeredBefore = [...settled.values()].some(({ disposition }) => disposition === "applied");
		const { record, resolution } = await settleOne(settling, { reply, answeredBefore });
		const outcome = { disposition: record.disposition, why: record.why };

		settled.set(reply.index, record);

		if (!hasReplyOn(item.thread, replyStem(reply.ordinal, outcome))) await calls.workSource?.comment(item.id, replyText(reply.ordinal, outcome, resolution, settling.options, reply.entry.text));
	}

	await dropSuperseded(settling, new Set(replies.map(({ ordinal }) => ordinal)));

	const asEngineReads = (entry: ThreadEntry, index: number): ThreadEntry => {
		const record = settled.get(index);

		return record ? normalized(entry, record) : entry;
	};

	return { ...item, thread: item.thread.map(asEngineReads) };
};
