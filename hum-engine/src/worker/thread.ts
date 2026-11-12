import type { ThreadEntry } from "../adapter-api.ts";

type Thread = readonly ThreadEntry[];

/** Whether hum wrote the entry. A source that marks no authors holds only entries hum wrote or applied. */
export const isFromHum = (entry: ThreadEntry): boolean => entry.author !== "person";

const isHumQuestion = (entry: ThreadEntry): boolean => entry.kind === "question" && isFromHum(entry);

/** Where hum's latest question sits on the thread; -1 when it asked none. */
export const latestQuestionAt = (thread: Thread): number => thread.findLastIndex(isHumQuestion);

/** The applied answer to hum's latest question: the first answer after it. */
export const answerToLatest = (thread: Thread): ThreadEntry | undefined => {
	const asked = latestQuestionAt(thread);

	return asked < 0 ? undefined : thread.slice(asked + 1).find((entry) => entry.kind === "answer");
};

/** Hum's latest question, while no applied answer follows it. */
export const openQuestion = (thread: Thread): ThreadEntry | undefined => (answerToLatest(thread) === undefined ? thread[latestQuestionAt(thread)] : undefined);

/** The latest applied answer that picks one of `options`, from `since` on. */
export const pickedAnswer = (thread: Thread, options: readonly string[], since = 0): ThreadEntry | undefined =>
	thread.findLast((entry) => entry.kind === "answer" && entry.at >= since && entry.option !== undefined && options.includes(entry.option));
