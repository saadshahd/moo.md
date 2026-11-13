import { ADAPTER_API_VERSION, type Item, ItemId, type Question, type Questions, type ThreadEntry, type WorkSource } from "../adapter-api.ts";
import { visibleText } from "../adapters/marked.ts";
import { onceCalls } from "../adapters/once.ts";
import type { Config } from "../config/load.ts";
import { composeQuestion, type PlainQuestion, priorityOf, questionOrder, roomToAsk, type Waiting } from "../decide/question.ts";
import type { State } from "../state/open.ts";
import type { QueuedQuestion } from "../state/saved.ts";
import { DAY_MS, HOUR_MS } from "../time.ts";
import { footprintOf, doOverlap } from "./scheduler.ts";
import { openQuestion } from "./thread.ts";

export type QuestionContext = {
	readonly state: State;
	readonly config: Config;
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly now: () => number;
};

const isOpenQuestion = (thread: readonly ThreadEntry[], text: string): boolean => {
	const open = openQuestion(thread);

	return open !== undefined && visibleText(open.text) === text;
};

export const queuedKey = ({ item, queuedAt }: Pick<QueuedQuestion, "item" | "queuedAt">): string => `${item}@${queuedAt}`;

/** How long an asked question is kept: long enough to count the day, and to read late answers to it. */
const keptFor = ({ hum }: Config): number => Math.max(DAY_MS, hum.questionTimeoutHours * HOUR_MS);

/** Whether a question asked at `askedAt` is recent enough that an answer may still come for it. */
const isKept = (askedAt: number, config: Config, now: number): boolean => now - askedAt <= keptFor(config);

const isWaiting = ({ askedAt }: QueuedQuestion): boolean => askedAt === undefined;

/** A question to the owner, checked against the question rules and queued for room under the daily cap. One already open, or already queued, is not asked twice. */
export const queueQuestion = (ctx: Pick<QuestionContext, "state" | "config" | "now">, item: Item, draft: Question, plain: PlainQuestion): void => {
	const { state, config, now } = ctx;
	const question = composeQuestion(draft, plain, item.id, config.hum.questionLimits);
	const known = state.questions.list().some((queued) => queued.item === item.id && isWaiting(queued) && queued.text === question.text);

	if (known || isOpenQuestion(item.thread, question.text)) return;

	const queued: QueuedQuestion = {
		item: item.id,
		text: question.text,
		options: question.options && [...question.options],
		detail: question.detail,
		priority: priorityOf({ labels: item.labels ?? [], priorityLabels: config.hum.priorityLabels }),
		footprint: footprintOf(item) && [...(footprintOf(item) ?? [])],
		queuedAt: now(),
	};

	state.questions.put(queuedKey(queued), queued);
};

const waitingOrder = (queue: readonly QueuedQuestion[]): QueuedQuestion[] => {
	const ranked = queue.map((queued): Waiting & { queued: QueuedQuestion } => ({
		item: queued.item,
		priority: queued.priority,
		behind: queue.filter((other) => other !== queued && doOverlap(queued.footprint, other.footprint)).length,
		since: queued.queuedAt,
		queued,
	}));

	return ranked.sort(questionOrder).map(({ queued }) => queued);
};

/** What the daily question cap has room for now: the questions asked and the follow-ups filed within the day take theirs, and older ones are dropped. */
export const roomToday = ({ state, config, now }: Pick<QuestionContext, "state" | "config" | "now">): number => {
	for (const old of state.questions.list()) if (old.askedAt !== undefined && !isKept(old.askedAt, config, now())) state.questions.remove(queuedKey(old));

	for (const old of state.followUps.list()) if (!isKept(old.at, config, now())) state.followUps.remove(old.item);

	const asked = state.questions.list().flatMap(({ askedAt }) => (askedAt === undefined ? [] : [askedAt]));

	return roomToAsk({ askedAt: [...asked, ...state.followUps.list().map(({ at }) => at)], cap: config.hum.dailyQuestionCap, now: now() });
};

/** Asks the queued questions the daily cap has room for, first by the owner's priority label, then by how many items wait on it, then by age. */
export const releaseQuestions = async (ctx: QuestionContext): Promise<string[]> => {
	const { state, workSource, questions, now } = ctx;
	const room = roomToday(ctx);
	const all = state.questions.list();
	const released: string[] = [];

	for (const queued of waitingOrder(all.filter(isWaiting)).slice(0, room)) {
		const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource, questions }, state.ops, { run: "ask", attempt: queued.queuedAt });

		await calls.questions?.ask(ItemId.parse(queued.item), { text: queued.text, options: queued.options, detail: queued.detail });
		state.questions.put(queuedKey(queued), { ...queued, askedAt: now() });
		released.push(queued.item);
	}

	return released;
};

/** Items whose question was asked recently enough that an answer may still come for it. */
export const recentlyAsked = ({ state, config, now }: Pick<QuestionContext, "state" | "config" | "now">): string[] =>
	state.questions.list().flatMap(({ item, askedAt }) => (askedAt !== undefined && isKept(askedAt, config, now()) ? [item] : []));
