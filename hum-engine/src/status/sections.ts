import type { Choice, Question } from "./format.ts";
import type { QueuedQuestion, SettledAnswer } from "../state/saved.ts";

const answersAfter = (answers: readonly SettledAnswer[], item: string, asked: number): boolean =>
	answers.some((answer) => answer.item === item && answer.disposition === "applied" && answer.at >= asked);

/** A question stays open from the moment it is asked until an answer to its item is applied. */
export const openQuestions = (queued: readonly QueuedQuestion[], answers: readonly SettledAnswer[]): Question[] =>
	queued
		.flatMap(({ item, text, options = [], askedAt }) => (askedAt !== undefined && !answersAfter(answers, item, askedAt) ? [{ item, text, options, since: askedAt }] : []))
		.sort((a, b) => a.since - b.since);

/** The newest `shown` choices, newest first. */
export const newestChoices = (choices: readonly Choice[], shown: number): Choice[] => [...choices].sort((a, b) => b.at - a.at).slice(0, shown);
