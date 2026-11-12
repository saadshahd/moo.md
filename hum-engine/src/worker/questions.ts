import { ADAPTER_API_VERSION, type Item, type Question, type Questions, type ThreadEntry, type WorkSource } from "../adapter-api.ts";
import { visibleText } from "../adapters/marked.ts";
import { onceCalls } from "../adapters/once.ts";
import type { Config } from "../config/load.ts";
import { composeQuestion, type PlainQuestion, priorityOf, questionOrder, roomToAsk, type Waiting } from "../decide/question.ts";
import type { State } from "../state/open.ts";
import type { QueuedQuestion } from "../state/saved.ts";
import { DAY_MS, HOUR_MS } from "../time.ts";
import { footprintOf, overlaps } from "./scheduler.ts";

export type QuestionContext = {
	readonly state: State;
	readonly config: Config;
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly now: () => number;
};

const isOpenQuestion = (thread: readonly ThreadEntry[], text: string): boolean => {
	const last = thread.findLastIndex((entry) => entry.kind === "question" && entry.author !== "person");
	const reply = thread.findIndex((entry, index) => index > last && (entry.kind === "answer" || (entry.kind === "comment" && entry.author === "person")));

	return last >= 0 && reply < 0 && visibleText(thread[last]?.text ?? "") === text;
};

const keyOf = ({ item, queuedAt }: Pick<QueuedQuestion, "item" | "queuedAt">): string => `${item}@${queuedAt}`;

/** How long an asked question is kept: long enough to count the day, and to read late answers to it. */
const keptFor = ({ hum }: Config): number => Math.max(DAY_MS, hum.questionTimeoutHours * HOUR_MS);

/** Whether a question asked at `askedAt` is recent enough that an answer may still come for it. */
const isKept = (askedAt: number, config: Config, now: number): boolean => now - askedAt <= keptFor(config);

const isWaiting = ({ askedAt }: QueuedQuestion): boolean => askedAt === undefined;

/** A question to the owner, checked against the question rules and queued for room under the daily cap. One already open, or already queued, is not asked twice. */
export const queueQuestion = (ctx: QuestionContext, item: Item, draft: Question, plain: PlainQuestion): void => {
	const { state, config, now } = ctx;
	const question = composeQuestion(draft, plain, item.id, config.hum.questionLimits);
	const known = state.questions.list().some((queued) => queued.item === item.id && isWaiting(queued) && queued.text === question.text);

	if (known || isOpenQuestion(item.thread, question.text)) return;

	const queued: QueuedQuestion = {
		item: item.id,
		text: question.text,
		options: question.options && [...question.options],
		detail: question.detail,
		priority: priorityOf(item.labels ?? [], config.hum.priorityLabels),
		footprint: footprintOf(item) && [...(footprintOf(item) ?? [])],
		queuedAt: now(),
	};

	state.questions.put(keyOf(queued), queued);
};

const waitingOrder = (queue: readonly QueuedQuestion[]): QueuedQuestion[] => {
	const ranked = queue.map((queued): Waiting & { queued: QueuedQuestion } => ({
		item: queued.item,
		priority: queued.priority,
		behind: queue.filter((other) => other !== queued && overlaps(queued.footprint, other.footprint)).length,
		since: queued.queuedAt,
		queued,
	}));

	return ranked.sort(questionOrder).map(({ queued }) => queued);
};

/** Asks the queued questions the daily cap has room for, first by the owner's priority label, then by how many items wait on it, then by age. */
export const releaseQuestions = async (ctx: QuestionContext): Promise<string[]> => {
	const { state, config, workSource, questions, now } = ctx;
	const all = state.questions.list();

	for (const old of all) if (old.askedAt !== undefined && !isKept(old.askedAt, config, now())) state.questions.remove(keyOf(old));

	const room = roomToAsk(all.flatMap(({ askedAt }) => (askedAt === undefined ? [] : [askedAt])), config.hum.dailyQuestionCap, now());
	const released: string[] = [];

	for (const queued of waitingOrder(all.filter(isWaiting)).slice(0, room)) {
		const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource, questions }, state.ops, { run: "ask", attempt: queued.queuedAt });

		await calls.questions?.ask(queued.item, { text: queued.text, options: queued.options, detail: queued.detail });
		state.questions.put(keyOf(queued), { ...queued, askedAt: now() });
		released.push(queued.item);
	}

	return released;
};

/** Items whose question was asked recently enough that an answer may still come for it. */
export const recentlyAsked = ({ state, config, now }: Pick<QuestionContext, "state" | "config" | "now">): string[] =>
	state.questions.list().flatMap(({ item, askedAt }) => (askedAt !== undefined && isKept(askedAt, config, now()) ? [item] : []));
