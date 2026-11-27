import type { Choice, Question } from "./format.ts";
import type { QueuedQuestion, SettledAnswer, SettledRequest } from "../state/saved.ts";

/** What the owner sent an item that hum applied: an answer, or a request that moved it on from its wait. */
type Applied = Pick<SettledAnswer | SettledRequest, "item" | "disposition" | "at">;

const hasAppliedAfter = (applied: readonly Applied[], item: string, asked: number): boolean => applied.some((sent) => sent.item === item && sent.disposition === "applied" && sent.at >= asked);

/** A question stays open from the moment it is asked until an answer or a request to its item is applied, or hum closes it. */
export const openQuestions = (queued: readonly QueuedQuestion[], applied: readonly Applied[]): Question[] =>
	queued
		.flatMap(({ item, text, options = [], askedAt, closedAt }) => (askedAt !== undefined && closedAt === undefined && !hasAppliedAfter(applied, item, askedAt) ? [{ item, text, options, since: askedAt }] : []))
		.sort((a, b) => a.since - b.since);

/** The newest `shown` choices, newest first. */
export const newestChoices = (choices: readonly Choice[], shown: number): Choice[] => [...choices].sort((a, b) => b.at - a.at).slice(0, shown);
