import { expect, test } from "bun:test";
import { dispose, matchOption, replyText } from "../src/decide/answer.ts";
import { type AskFacts, askDecision, composeQuestion, PLAIN_QUESTIONS, priorityOf, questionIssues, questionOrder, roomToAsk } from "../src/decide/question.ts";
import { DAY_MS } from "../src/time.ts";

const LIMITS = { cells: 80, wordCells: 40 };

test("a question is at most 80 cells, ends in a question mark, names no item and holds no word over 40 cells", () => {
	expect(questionIssues({ text: "Which title should the note carry?", item: "seed-1", limits: LIMITS })).toEqual([]);
	expect(questionIssues({ text: `${"a ".repeat(41)}?`, item: "seed-1", limits: LIMITS })).toEqual(["too-wide"]);
	expect(questionIssues({ text: "Which title", item: "seed-1", limits: LIMITS })).toEqual(["no-question-mark"]);
	expect(questionIssues({ text: "Should seed-1 go on?", item: "seed-1", limits: LIMITS })).toEqual(["names-item"]);
	expect(questionIssues({ text: "Should _seed-1_ go on?", item: "seed-1", limits: LIMITS })).toEqual(["names-item"]);
	expect(questionIssues({ text: `Is ${"x".repeat(41)} right?`, item: "seed-1", limits: LIMITS })).toEqual(["long-word"]);
	// Full-width characters take two cells each.
	expect(questionIssues({ text: `${"日".repeat(41)}?`, item: "seed-1", limits: LIMITS })).toContain("too-wide");
});

test("a question that breaks the rules is asked in its plain form with its own words folded", () => {
	const draft = { text: "Should seed-1 use the long form of the title", options: ["yes", "no"] };
	const composed = composeQuestion(draft, "unsure", "seed-1", LIMITS);

	expect(composed.text).toBe(PLAIN_QUESTIONS.unsure);
	expect(composed.options).toEqual(["yes", "no"]);
	expect(composed.detail).toContain(draft.text);
	expect(questionIssues({ text: composed.text, item: "seed-1", limits: LIMITS })).toEqual([]);
	expect(composeQuestion({ text: "Which title?" }, "unsure", "seed-1", LIMITS)).toEqual({ text: "Which title?" });
});

const FACTS: AskFacts = { runnerVariables: new Set(["PATH"]), changedPaths: ["docs/a.md"], level: "low", undoableLevels: ["low", "medium"] };

test("a missing secret must name a variable the runner lacks, and a step past undoing must name its command", () => {
	expect(askDecision({ kind: "missing-secret", variable: "NPM_TOKEN" }, FACTS)).toEqual({ action: "ask", reason: "missing-secret", confirmed: true });
	expect(askDecision({ kind: "missing-secret", variable: "PATH" }, FACTS)).toMatchObject({ action: "ask", confirmed: false });
	expect(askDecision({ kind: "missing-secret" }, FACTS)).toMatchObject({ confirmed: false });
	expect(askDecision({ kind: "past-undoing", command: "npm publish" }, FACTS)).toMatchObject({ action: "ask", confirmed: true });
	expect(askDecision({ kind: "past-undoing" }, FACTS)).toMatchObject({ confirmed: false });
});

test("a choice that is cheap to undo is made without the owner; any other choice asks", () => {
	const options = [{ word: "short", paths: ["docs/a.md"] }, { word: "long", paths: ["docs/a.md"] }];

	expect(askDecision({ kind: "choice", options, default: "short" }, FACTS)).toEqual({ action: "decide", choice: "short", over: ["short", "long"] });
	expect(askDecision({ kind: "choice", options, default: "short" }, { ...FACTS, level: "high" })).toMatchObject({ action: "ask" });
	expect(askDecision({ kind: "choice", options: [{ word: "short", paths: ["src/b.ts"] }], default: "short" }, FACTS)).toMatchObject({ action: "ask" });
	expect(askDecision({ kind: "choice", options, default: "missing" }, FACTS)).toMatchObject({ action: "ask" });
});

test("under a cap, the questions that ask first are the priority label's, then those most items wait on, then the oldest", () => {
	const at = (item: string, priority: number, behind: number, since: number) => ({ item, priority, behind, since });
	const order = [at("old", 1, 0, 1), at("blocking", 1, 3, 9), at("labelled", 0, 0, 9), at("new", 1, 0, 5)].sort(questionOrder).map(({ item }) => item);

	expect(order).toEqual(["labelled", "blocking", "old", "new"]);
	expect(priorityOf({ labels: ["bug", "priority:high"], priorityLabels: ["priority:high"] })).toBe(0);
	expect(priorityOf({ labels: ["bug"], priorityLabels: ["priority:high"] })).toBe(1);
});

test("the cap counts the questions asked in the last day; no cap leaves no limit", () => {
	const now = 10 * DAY_MS;

	expect(roomToAsk({ askedAt: [now - 1, now - DAY_MS + 1, now - DAY_MS - 1], cap: 3, now })).toBe(1);
	expect(roomToAsk({ askedAt: [], cap: undefined, now })).toBe(Number.POSITIVE_INFINITY);
	expect(roomToAsk({ askedAt: [now, now, now, now], cap: 3, now })).toBe(0);
});

const OPTIONS = ["approve", "change"];

test("an answer picks its option by marker, else by its exact first word; free text on a question with no options is free", () => {
	expect(matchOption({ text: "x", option: "change" }, OPTIONS)).toEqual({ source: "marker", option: "change" });
	expect(matchOption({ text: "Approve, thanks" }, OPTIONS)).toEqual({ source: "first-word", option: "approve" });
	expect(matchOption({ text: "approved." }, OPTIONS)).toBeUndefined();
	expect(matchOption({ text: "anything" }, [])).toEqual({ source: "free" });
});

test("every answer is applied, held or dropped, and a model's pick never approves a change", () => {
	const base = { answeredBefore: false, stage: "waiting" } as const;
	const picked = { source: "model", option: "approve" } as const;

	expect(dispose({ ...base, resolution: { source: "marker", option: "change" } }).disposition).toBe("applied");
	expect(dispose({ ...base, stage: "running", resolution: { source: "marker", option: "change" } }).disposition).toBe("held");
	expect(dispose({ ...base, stage: "ended", resolution: { source: "marker", option: "change" } }).disposition).toBe("dropped");
	expect(dispose({ ...base, answeredBefore: true, resolution: { source: "marker", option: "change" } })).toMatchObject({ disposition: "dropped", why: expect.stringContaining("already") });
	expect(dispose({ ...base, resolution: { source: "none-of-these" } }).disposition).toBe("dropped");
	expect(dispose({ ...base, resolution: { source: "abstained", why: "no call" } }).disposition).toBe("dropped");
	expect(dispose({ ...base, stage: "approval", resolution: picked })).toMatchObject({ disposition: "dropped", why: expect.stringContaining("reply with the word approve") });
	expect(dispose({ ...base, resolution: picked }).disposition).toBe("applied");
	expect(dispose({ ...base, stage: "approval", resolution: { source: "marker", option: "approve" } }).disposition).toBe("applied");
});

test("a dropped reply gives its reason and the options to answer with", () => {
	const dropped = dispose({ resolution: { source: "none-of-these" }, answeredBefore: false, stage: "waiting" });

	expect(replyText(2, dropped, { source: "none-of-these" }, OPTIONS, "hm")).toBe(`Answer 2 dropped: ${dropped.why} Options: approve, change.`);
});

test("an applied reply names the pick", () => {
	const applied = dispose({ resolution: { source: "first-word", option: "change" }, answeredBefore: false, stage: "waiting" });

	expect(replyText(1, applied, { source: "first-word", option: "change" }, OPTIONS, "change it")).toStartWith("Answer 1 applied: change.");
});
