import { describe, expect, test } from "bun:test";
import { adjacencyMapToArray, getAdjacencyMap } from "xstate/graph";
import { answerOf } from "../../../hum/mod/answer/fill.ts";
import { buttonWords, FREE_ANSWER } from "../../../hum/mod/item.ts";
import {
	ANSWER_EVENTS,
	ANSWER_STATES,
	type AnswerEvent,
	type AnswerSnapshot,
	type Answering,
	SAY,
	answerMachine,
} from "../../../hum/mod/answer/machine.ts";

const OPEN: Answering = {
	item: "68",
	label: "#68",
	opener: "#68: ",
	filled: "#68: change the plan so that ",
	isOpen: true,
	option: "change",
};

const WHOLE: Answering = {
	item: "68",
	label: "#68",
	opener: "#68: ",
	filled: "#68: approve",
	isOpen: false,
	option: "approve",
};

const WRITTEN = `${OPEN.filled}README stays`;

const OWNER_ORIGINS = ["composer", "bridge"] as const;

const OTHER_ORIGINS = [
	"sdk",
	"task-notification",
	"scheduled-trigger",
	"peer",
	"peer-send-message",
	"projects-relay",
	"channel",
	"coordinator",
	"observer",
	"observer-activity",
	"auto-continuation",
	"unclassified",
	"slack-ping",
	"plugin",
] as const;

const BOX_ORIGINS = [
	"clear",
	"history",
	"undo",
	"plugin",
	"app",
	"engine",
] as const;

const BOXES = ["", OPEN.filled, WRITTEN, "#11: what is this?", "a draft"];

/** At least one sample per event, as the graph walk requires. */
const someOf = <T,>(items: readonly T[]): [T, ...T[]] => {
	const [first, ...rest] = items;

	if (first === undefined) throw new Error("an event needs at least one sample");

	return [first, ...rest];
};

/** Samples for every event, chosen so each guard in the machine meets both of its answers. */
const SAMPLES = {
	filled: someOf([OPEN, WHOLE].flatMap((answer) => ["", "a draft"].map((box) => ({ answer, box })))),
	edited: someOf(BOXES.map((box) => ({ box }))),
	changed: someOf(BOX_ORIGINS.flatMap((origin) => [WRITTEN, ""].map((box) => ({ origin, box })))),
	submitted: someOf(["composer", "peer"].flatMap((origin) => [OPEN.filled, WRITTEN, WHOLE.filled, "#11: what is this?"].map((text) => ({ origin, text })))),
	posted: someOf([WRITTEN, ""].map((box) => ({ box }))),
	postFailed: someOf([WRITTEN, "", "something else"].map((box) => ({ cause: "GitHub 502", box }))),
	postUnconfirmed: someOf([WRITTEN, "", "something else"].map((box) => ({ cause: "timed out", box }))),
	restarted: someOf([{}]),
};

const step = (snapshot: AnswerSnapshot, event: AnswerEvent): AnswerSnapshot =>
	answerMachine.transition(snapshot, event)[0];

const run = (events: readonly AnswerEvent[]): AnswerSnapshot =>
	events.reduce(step, answerMachine.initialState);

test("every event has a transition in every state, so none is ignored undecided", () => {
	const undecided = ANSWER_STATES.flatMap((state) =>
		ANSWER_EVENTS.filter(
			(event) => answerMachine.config.states[state]?.on?.[event] === undefined,
		).map((event) => `${state} × ${event}`),
	);

	expect(undecided).toEqual([]);
});

describe("every event from every reachable state", () => {
	const steps = adjacencyMapToArray(
		getAdjacencyMap(answerMachine, {
		events: SAMPLES,
		serializeState: (s) =>
			`${s.value}|${s.context.answering?.filled ?? ""}|${s.value === "posting" ? s.context.answering.posted : ""}`,
		}),
	).map(({ state, event, nextState }) => ({ before: state, event, after: nextState }));

	test("the walk takes every event in every state", () => {
		const taken = new Set(steps.map(({ before, event }) => `${before.value} × ${event.type}`));
		const every = ANSWER_STATES.flatMap((state) => ANSWER_EVENTS.map((event) => `${state} × ${event}`));

		expect(every.filter((pair) => !taken.has(pair))).toEqual([]);
	});

	test("Enter reaches the thread only in answer mode, from the owner, with words after the opener", () => {
		for (const { before, event, after } of steps.filter(
			({ after }) => after.context.enter === "thread",
		)) {
			expect(before.value).toBe("on");
			expect(
				event.type === "submitted" &&
					new Set<string>(OWNER_ORIGINS).has(event.origin),
			).toBe(true);
			expect(after.value).toBe("posting");
		}
	});

	test("someone else's prompt always reaches Claude", () => {
		for (const { after } of steps.filter(
			({ event }) => event.type === "submitted" && event.origin === "peer",
		))
			expect(after.context.enter).toBe("claude");
	});

	test("an Enter while posting posts nothing twice", () => {
		for (const { after } of steps.filter(
			({ before, event }) =>
				before.value === "posting" &&
				event.type === "submitted" &&
				event.origin === "composer",
		)) {
			expect(after.context.enter).toBe("nowhere");
			expect(after.value).toBe("posting");
		}
	});

	test("a post's end always leaves posting", () => {
		for (const { event, after } of steps.filter(
			({ before }) => before.value === "posting",
		))
			if (event.type === "posted" || event.type === "postFailed" || event.type === "postUnconfirmed")
				expect(after.value).not.toBe("posting");
	});

	test("a restart always ends answer mode", () => {
		for (const { after } of steps.filter(
			({ event }) => event.type === "restarted",
		))
			expect(after.value).toBe("off");
	});
});

describe("the six cases found live", () => {
	test("a fill into a box holding a draft is refused and the draft kept", () => {
		const after = run([{ type: "filled", answer: OPEN, box: "a draft" }]);

		expect(after.value).toBe("off");
		expect(after.context).toMatchObject({
			box: { kind: "keep" },
			say: SAY.draft,
		});
	});

	test("an opener typed by the owner goes to Claude", () => {
		const after = run([
			{ type: "edited", box: "#68: change it" },
			{ type: "submitted", origin: "composer", text: "#68: change it" },
		]);

		expect(after.context.enter).toBe("claude");
	});

	test("a fill, a cleared box and a typed opener go to Claude", () => {
		const after = run([
			{ type: "filled", answer: OPEN, box: "" },
			{ type: "edited", box: "" },
			{ type: "edited", box: "#11: what is this?" },
			{ type: "submitted", origin: "composer", text: "#11: what is this?" },
		]);

		expect(after.value).toBe("off");
		expect(after.context.enter).toBe("claude");
	});

	test("the box clear that Enter raises keeps answer mode, so the answer posts", () => {
		const after = run([
			{ type: "filled", answer: OPEN, box: "" },
			{ type: "edited", box: WRITTEN },
			{ type: "changed", origin: "clear", box: "" },
			{ type: "submitted", origin: "composer", text: WRITTEN },
		]);

		expect(after.value).toBe("posting");
		expect(after.context.enter).toBe("thread");
	});

	test("a post that lands empties the box the engine refilled and ends answer mode", () => {
		const after = run([
			{ type: "filled", answer: OPEN, box: "" },
			{ type: "submitted", origin: "composer", text: WRITTEN },
			{ type: "posted", box: WRITTEN },
		]);

		expect(after.value).toBe("off");
		expect(after.context).toMatchObject({
			box: { kind: "set", text: "" },
			say: SAY.posted("#68"),
		});
	});

	test("a post that fails puts the words back and keeps answer mode", () => {
		const after = run([
			{ type: "filled", answer: OPEN, box: "" },
			{ type: "submitted", origin: "composer", text: WRITTEN },
			{ type: "postFailed", cause: "404", box: "" },
		]);

		expect(after.value).toBe("on");
		expect(after.context).toMatchObject({
			box: { kind: "set", text: WRITTEN },
			say: SAY.failed("#68", "404"),
		});
	});
});

test("a post that may have landed leaves the box empty, so Enter cannot post it twice, and ends answer mode", () => {
	const after = run([
		{ type: "filled", answer: OPEN, box: "" },
		{ type: "submitted", origin: "composer", text: WRITTEN },
		{ type: "postUnconfirmed", cause: "timed out", box: "" },
	]);

	expect(after.value).toBe("off");
	expect(after.context).toMatchObject({
		box: { kind: "keep" },
		say: SAY.unconfirmed("#68", "timed out"),
	});
});

describe("whose Enter posts", () => {
	const armed = run([{ type: "filled", answer: OPEN, box: "" }]);

	test.each([...OWNER_ORIGINS])("%s posts in answer mode", (origin) => {
		expect(
			step(armed, { type: "submitted", origin, text: WRITTEN }).context.enter,
		).toBe("thread");
	});

	test.each([...OTHER_ORIGINS])(
		"%s passes to Claude and answer mode stays on",
		(origin) => {
			const after = step(armed, { type: "submitted", origin, text: WRITTEN });

			expect(after.context.enter).toBe("claude");
			expect(after.value).toBe("on");
		},
	);
});

test("Enter on the bare open sentence posts nothing and says so", () => {
	const after = run([
		{ type: "filled", answer: OPEN, box: "" },
		{ type: "submitted", origin: "composer", text: OPEN.filled },
	]);

	expect(after.value).toBe("on");
	expect(after.context).toMatchObject({
		enter: "nowhere",
		say: SAY.empty("#68"),
	});
});

test("a question with no options has one button, for a free answer", () => {
	expect(buttonWords({ options: [] })).toEqual([FREE_ANSWER]);
});

test.each([
	["an open sentence", "68", "change", { filled: "#68: change the plan so that ", isOpen: true, option: "change" }],
	["a whole answer", "68", "approve", { filled: "#68: approve", isOpen: false, option: "approve" }],
	["a free answer", "seed-2", FREE_ANSWER, { filled: "seed-2: ", isOpen: true, option: undefined }],
])("a question's button fills %s", (_, item, word, answer) => {
	expect(answerOf({ item, word })).toMatchObject(answer);
});
