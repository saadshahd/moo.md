import { expect, test } from "bun:test";
import type { Item, ThreadEntry } from "../src/adapter-api.ts";
import { FakeProvider } from "../src/adapters/fake.ts";
import type { ModelCall } from "../src/adapters/model-call.ts";
import { OWNER_APPROVAL } from "../src/decide/merge.ts";
import type { Wait } from "../src/state/events.ts";
import { openState } from "../src/state/open.ts";
import { pickedChoice, planChangingAnswers, settleAnswers, withSettledAnswers } from "../src/worker/answers.ts";
import { kindAnswered } from "../src/worker/kind.ts";
import { settleRequests } from "../src/worker/requests.ts";
import { settleNotes } from "../src/worker/step-notes.ts";
import { answerTo } from "../src/worker/thin-path.ts";
import { scriptedJudge } from "./fixtures/judge.ts";
import { tempDir } from "./fixtures/temp.ts";

const VISIT: Wait = { step: "approving", since: 100 };

const question = (options: readonly string[]): ThreadEntry => ({ kind: "question", text: `Approve this change?\n\nOptions: ${options.join(", ")}`, at: 110, author: "hum" });

const reply = (text: string, at = 120, id = "IC_1"): ThreadEntry => ({ kind: "comment", text, at, author: "person", id });

const NO_MODEL: ModelCall = async () => {
	throw new Error("no model call reads an answer hum already read");
};

/** A store, a work source that takes hum's replies, and an item whose thread is what each test gives. */
const world = () => {
	const provider = new FakeProvider();
	const adapter = provider.adapter();
	const workSource = adapter.workSource!;
	const id = provider.seed("Ship the export");
	const state = openState(tempDir("owner-answers"), { now: provider.now });
	const itemOf = (thread: readonly ThreadEntry[]): Item => ({ id, title: "Ship the export", body: "", ready: true, thread: [...thread] });

	const settle = (thread: readonly ThreadEntry[], { judge = NO_MODEL, stage = "approval", wait = VISIT }: { readonly judge?: ModelCall; readonly stage?: "approval" | "running" | "waiting"; readonly wait?: Wait } = {}) =>
		settleAnswers({ state, workSource, judge, now: provider.now }, itemOf(thread), { stage, wait });

	const kept = () => state.events.list(id).flatMap((event) => (event.type === "answered" ? [event.payload] : []));
	const replies = async () => (await workSource.read(id)).thread.filter(({ text }) => /^(Answer|Request|Note) \d+ /.test(text)).map(({ text }) => text);

	return { id, state, workSource, questions: adapter.questions!, itemOf, settle, kept, replies, now: provider.now };
};

test("every owner answer, request and note is kept once in the item's log as the wait, the choice and the owner's words, however often hum reads the thread", async () => {
	const w = world();
	const thread = [question(["approve", "object"]), reply("approve, and ship it"), { kind: "skip", text: "Skip approving.", at: 130, step: "approving", author: "person", id: "IC_2" }, { kind: "note", text: "Keep the old flag.", at: 140, step: "fixing", author: "person", id: "IC_3" }] satisfies ThreadEntry[];
	const stand = { at: "approving", savedAt: VISIT.since, controls: { skip: true, runNow: false }, answered: false, parked: false };
	const noteStand = { at: "approving", reach: new Set(["fixing"]), parked: false };

	for (let reads = 0; reads < 2; reads++) {
		await w.settle(thread);
		await settleRequests({ state: w.state, workSource: w.workSource, questions: w.questions, now: w.now }, w.itemOf(thread), stand);
		await settleNotes({ state: w.state, writes: { comment: w.workSource.comment }, now: w.now }, w.itemOf(thread), noteStand);
	}

	expect(w.kept()).toEqual([
		{ wait: VISIT, choice: OWNER_APPROVAL, text: "approve, and ship it", at: 120, read: "first-word" },
		{ wait: VISIT, choice: "skip", text: "Skip approving.", at: 130, read: "marker" },
		{ wait: { step: "approving" }, choice: "note:fixing", text: "Keep the old flag.", at: 140, read: "marker" },
	]);
});

test("a reply hum read once keeps its reading: the same comment edited later still picks what hum read first", async () => {
	const w = world();

	await w.settle([question(["approve", "object"]), reply("object: the export drops rows")]);

	const edited = [question(["approve", "object"]), reply("approve")];
	const item = await w.settle(edited);

	expect(item.thread.at(-1)).toMatchObject({ kind: "answer", option: "object" });
	expect(answerTo(w.state.events, withSettledAnswers(w.state, w.itemOf(edited)), VISIT)?.option).toBe("object");
});

test("an answer counts only for the wait it was given at: not for a later visit to the same step, and not for the visit it came before", async () => {
	const w = world();
	const given = await w.settle([question(["approve", "object"]), reply("approve")]);

	expect(answerTo(w.state.events, given, VISIT)?.option).toBe(OWNER_APPROVAL);
	expect(answerTo(w.state.events, given, { ...VISIT, since: 200 })).toBeUndefined();

	const early = world();
	const before = await early.settle([question(["approve", "object"]), reply("approve", 90)]);

	expect(early.kept()[0]?.wait).toEqual({ step: VISIT.step });
	expect(answerTo(early.state.events, before, VISIT)).toBeUndefined();
});

test("a model's reading of a reply held while a run goes is kept as the model's, so it never approves once the change waits on the owner's approval", async () => {
	const w = world();
	const thread = [question(["approve", "object"]), reply("looks fine to me")];

	await w.settle(thread, { judge: scriptedJudge({ "reply-option": { option: OWNER_APPROVAL } }), stage: "running" });

	const item = await w.settle(thread);

	expect(w.kept()).toEqual([expect.objectContaining({ choice: OWNER_APPROVAL, read: "model" })]);
	expect(answerTo(w.state.events, item, VISIT)).toBeUndefined();
	expect((await w.replies()).at(-1)).toStartWith(`Answer 1 dropped: a model cannot approve it; reply with the word ${OWNER_APPROVAL}`);
});

test("an answer hum 0.33 settled before it kept answers in the log is kept from its saved reading, with no model call and no second reply", async () => {
	const w = world();
	const thread = [question(["approve", "object"]), reply("ship it"), { kind: "comment", text: "Answer 1 applied: approve. The run goes on with your answer.", at: 125, author: "hum" }] satisfies ThreadEntry[];

	w.state.answers.put(`${w.id}#1`, { item: w.id, ordinal: 1, text: "ship it", disposition: "applied", why: "The run goes on with your answer.", at: 125, source: "model", option: "object" });

	const item = await w.settle(thread);

	expect(w.kept()).toEqual([{ wait: VISIT, choice: "object", text: "ship it", at: 120, read: "model" }]);
	expect(answerTo(w.state.events, item, VISIT)?.option).toBe("object");
	expect(await w.replies()).toEqual([]);
});

test("a pick at landing is the choice the kept answer holds, given since the change was saved: an edited comment keeps what hum read, and an answer from before the change counts for none", async () => {
	const w = world();

	await w.settle([question(["approve", "object"]), reply("approve")]);

	const edited = w.itemOf([question(["approve", "object"]), reply("object")]);

	expect(pickedChoice(w.state, edited, [OWNER_APPROVAL], 120)?.choice).toBe(OWNER_APPROVAL);
	expect(pickedChoice(w.state, edited, ["object"], 120)).toBeUndefined();
	expect(pickedChoice(w.state, edited, [OWNER_APPROVAL], 121)).toBeUndefined();
});

test("the kind the owner named for an item on its fallback kind is the kept answer's choice, though the comment is edited after", async () => {
	const w = world();
	const asked: ThreadEntry = { kind: "question", text: "Which kind of work is this?\n\nOptions: docs, fix", at: 110, author: "hum" };

	await w.settle([asked, reply("fix")], { stage: "waiting" });

	expect(kindAnswered(w.state, { item: w.id, kind: "feature", from: "fallback", why: "unsure" }, w.itemOf([asked, reply("docs")]), ["docs", "fix"])).toEqual({ item: w.id, kind: "fix", from: "source" });
});

test("an answer that changed the plan reaches the next run in the words hum kept, though the comment is edited after", async () => {
	const w = world();
	const asked: ThreadEntry = { kind: "question", text: "How should the export go on?", at: 110, author: "hum" };

	await w.settle([asked, reply("Write one file per day.")], { stage: "waiting" });

	expect(planChangingAnswers(w.state, w.itemOf([asked, reply("never mind")]), new Set())).toEqual([{ question: asked.text, answer: "Write one file per day.", at: 120 }]);
});
