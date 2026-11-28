import type { ThreadEntry } from "../adapter-api.ts";

type Thread = readonly ThreadEntry[];

/** Whether hum wrote the entry. A source that marks no authors holds only entries hum wrote or applied. */
export const isFromHum = (entry: ThreadEntry): boolean => entry.author !== "person";

/** Whether the entry is a question hum asked. */
export const isHumQuestion = (entry: ThreadEntry): boolean => entry.kind === "question" && isFromHum(entry);

/** Whether hum already replied on the thread with a comment that opens with `stem`. */
export const hasReplyOn = (thread: Thread, stem: string): boolean => thread.some((entry) => isFromHum(entry) && entry.kind === "comment" && entry.text.startsWith(stem));

/** Where hum's latest question sits on the thread; -1 when it asked none. */
export const latestQuestionAt = (thread: Thread): number => thread.findLastIndex(isHumQuestion);

/** Where hum closed its latest question, as the wait it asked about ended without the owner's answer; -1 while it stands open, or when hum asked none. */
export const latestCloseAt = (thread: Thread): number => {
	const asked = latestQuestionAt(thread);

	return asked < 0 ? -1 : thread.findIndex((entry, index) => index > asked && entry.kind === "close" && isFromHum(entry));
};

/** The applied answer to hum's latest question: the first answer after it, before hum closed it. */
export const answerToLatest = (thread: Thread): ThreadEntry | undefined => {
	const asked = latestQuestionAt(thread);
	const closed = latestCloseAt(thread);

	return asked < 0 ? undefined : thread.slice(asked + 1, closed < 0 ? undefined : closed).find((entry) => entry.kind === "answer");
};

/** Hum's latest question, while neither an applied answer nor hum's close follows it. */
export const openQuestion = (thread: Thread): ThreadEntry | undefined => (answerToLatest(thread) === undefined && latestCloseAt(thread) < 0 ? thread[latestQuestionAt(thread)] : undefined);
