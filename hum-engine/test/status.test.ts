import { expect, test } from "bun:test";
import { newestChoices, openQuestions } from "../src/status/sections.ts";
import type { QueuedQuestion, SettledAnswer } from "../src/state/saved.ts";

const asked = (item: string, askedAt?: number, options?: string[]): QueuedQuestion => ({ item, text: `Which for ${item}?`, options, priority: 0, queuedAt: 1, askedAt });
const answer = (item: string, at: number, disposition: SettledAnswer["disposition"]): SettledAnswer => ({ item, ordinal: 1, text: "yes", source: "free", disposition, why: "ok", at });

test("a question is open from the time it is asked until an answer to its item is applied", () => {
	const queued = [asked("a", 30), asked("b", 10, ["keep", "drop"]), asked("c", 20), asked("d"), asked("e", 50)];
	const answers = [answer("a", 40, "applied"), answer("c", 25, "held"), answer("e", 40, "applied")];

	expect(openQuestions(queued, answers)).toEqual([
		{ item: "b", text: "Which for b?", options: ["keep", "drop"], since: 10 },
		{ item: "c", text: "Which for c?", options: [], since: 20 },
		{ item: "e", text: "Which for e?", options: [], since: 50 },
	]);
});

test("the newest choices come first and no more than the shown count", () => {
	const choices = [1, 3, 2].map((at) => ({ item: "a", text: `t${at}`, at }));

	expect(newestChoices(choices, 2).map(({ at }) => at)).toEqual([3, 2]);
});
