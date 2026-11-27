import { expect, test } from "bun:test";
import { fullStatus, linkedStatus, NOW } from "../../../hum/fixtures/status.ts";
import { flowRows } from "../../../hum/mod/view/flow.ts";
import { openingRows, paneRows } from "../../../hum/mod/view/pane.ts";
import type { Press, Row } from "../../../hum/mod/view/row.ts";
import type { OpenItem, Question } from "../../src/status/format.ts";

const WIDTH = 88;

const textOf = (row: Row): string => row.map(({ text }) => text).join("").trimEnd();

const itemOf = (id: string, status = fullStatus): OpenItem => {
	const found = status.open.find(({ item }) => item === id);

	if (found === undefined) throw new Error(`the fixture holds no open item ${id}`);

	return found;
};

const ITEM_74 = itemOf("74");

const drawn = (item: OpenItem, { question, unfolded = [] }: { readonly question?: Question; readonly unfolded?: readonly string[] } = {}): Row[] =>
	flowRows(item, { now: NOW, width: WIDTH, unfolded: new Set(unfolded), question });

const lines = (rows: readonly Row[]): string[] => rows.map(textOf);

/** The buttons of a drawing, in order: each one's label and what it presses. */
const buttonsOf = (rows: readonly Row[]): { readonly label: string; readonly press: Press; readonly isMain: boolean }[] =>
	rows.flatMap((row) => row.flatMap(({ text, tone, press }) => (press === undefined || press.kind === "fold" ? [] : [{ label: text.replace(/[▐▌]/g, "").trim(), press, isMain: tone === "filled" }])));

test("an item's rail draws its steps and its end in the flow's order: the passed ones folded into one line, the step now as a card, then the ones ahead; routes and conditions are never rows", () => {
	expect(lines(drawn(ITEM_74)).map((line) => line.replace(/(?<=\S)\s{2,}.*$/, ""))).toEqual([
		"#74",
		"  ✓ planning · building · checking · reviewing ▾",
		expect.stringMatching(/^ {2}╭─ ● owner-review$/),
		"  │ note to: reviewing ▾",
		expect.stringMatching(/^ {2}╰─+╯$/),
		"  ○ merging",
		"  ○ done",
	]);
});

test("in a condition the card stands at the last step the item passed and says it: asking you where the item waits on the owner, else the condition's own name", () => {
	const at = (state: string) => lines(drawn({ ...ITEM_74, at: state, controls: { ...ITEM_74.controls, choices: [], noteTo: [] } }));

	expect(at("asking")).toContainEqual(expect.stringMatching(/╭─ ● reviewing · asking you {2}10 m ─+╮$/));
	expect(at("stuck")).toContainEqual(expect.stringMatching(/╭─ ● reviewing · stuck {2}10 m ─+╮$/));
	expect(at("asking").filter((line) => line.includes("reviewing"))).toHaveLength(1);
	expect(at("asking")).toContain("  ○ owner-review  waits on you");
});

test("an item in a condition before it passed any step draws the card alone, saying the condition, and no step ahead", () => {
	const rows = lines(drawn({ ...ITEM_74, at: "stuck", passed: undefined, controls: { ...ITEM_74.controls, choices: [], noteTo: [] } }));

	expect(rows).toContainEqual(expect.stringMatching(/╭─ ● stuck {2}10 m ─+╮$/));
	expect(rows.filter((line) => line.includes("○"))).toEqual([]);
});

test("a press on the passed line unfolds it into a line per step, and a press on any of them folds it back", () => {
	const unfolded = drawn(ITEM_74, { unfolded: ["passed:74"] });
	const passedLines = unfolded.filter((row) => row.some(({ text }) => text.startsWith("✓")));

	expect(passedLines.map(textOf)).toEqual(["  ✓ planning", "  ✓ building", "  ✓ checking", "  ✓ reviewing ▴"]);
	expect(passedLines.map((row) => row.find(({ press }) => press !== undefined)?.press)).toEqual(Array(4).fill({ kind: "fold", id: "passed:74" }));
});

test("the card's buttons: each choice the engine gives an answer word, then a written answer, then run now and skip where the step allows them; the first is the main one", () => {
	const item: OpenItem = { ...ITEM_74, controls: { choices: [{ label: "Approve", event: "owner-approved", answer: "approve" }, { label: "Park", event: "parked" }], answer: true, skip: true, runNow: true, noteTo: [] } };

	expect(buttonsOf(drawn(item))).toEqual([
		{ label: "Approve", press: { kind: "fill", item: "74", word: "approve" }, isMain: true },
		{ label: "answer", press: { kind: "fill", item: "74", word: "answer" }, isMain: false },
		{ label: "run now", press: { kind: "request", request: "run-now", item: "74", step: "owner-review" }, isMain: false },
		{ label: "skip", press: { kind: "request", request: "skip", item: "74", step: "owner-review" }, isMain: false },
	]);
});

test("an open question puts its text on the card and its options, where it has some, in place of the step's choices, then a written answer; a question asked in a roundup row keeps its one open button", () => {
	const question: Question = { item: "74", text: "Approve this change?", options: ["approve", "retry"], since: NOW };
	const inRow = linkedStatus.questions.find(({ row }) => row !== undefined);
	const labels = (asked?: Question) => buttonsOf(drawn(ITEM_74, { question: asked })).map(({ label }) => label);

	expect(lines(drawn(ITEM_74, { question }))).toContainEqual(expect.stringMatching(/│ Approve this change\? +│$/));
	expect(labels(question)).toEqual(["approve", "retry", "answer"]);
	expect(labels({ ...question, options: [] })).toEqual(["Approve", "answer"]);
	expect(buttonsOf(drawn(ITEM_74, { question: inRow })).map(({ label, press }) => [label, press.kind])).toEqual([["open ↗", "link"]]);
});

test("the note picker offers the steps a note may go to, and the card leaves it out where none is", () => {
	const pickOf = (item: OpenItem) => drawn(item).flatMap((row) => row.flatMap(({ pick }) => (pick === undefined ? [] : [pick])));

	expect(pickOf(ITEM_74)).toEqual([{ label: "note to", item: "74", steps: ["fixing", "reviewing"] }]);
	expect(pickOf({ ...ITEM_74, controls: { ...ITEM_74.controls, noteTo: [] } })).toEqual([]);
});

test("an open item's question shows on its card in the item's flow, not among the cards above it; a question of an item hum holds no open row for stays a card", () => {
	const question: Question = { item: "74", text: "Ship the exam export?", options: [], since: NOW };
	const text = lines(paneRows({ read: { kind: "status", status: { ...fullStatus, questions: [...fullStatus.questions, question] } }, now: NOW, amberAfterSeconds: 300, width: WIDTH, dismissed: [], unfolded: new Set() }));
	const flowStart = text.findIndex((line) => line.startsWith(" #74"));

	expect(text.findIndex((line) => line.includes("Ship the exam export?"))).toBeGreaterThan(flowStart);
	expect(text.findIndex((line) => line.includes("Which title should the release note carry?"))).toBeLessThan(flowStart);
});

const paneOf = (status: typeof fullStatus): string[] => lines(paneRows({ read: { kind: "status", status }, now: NOW, amberAfterSeconds: 300, width: WIDTH, dismissed: [], unfolded: new Set() }));

test("an item with two open questions asks its newest on its card, and the older stays a card above", () => {
	const older: Question = { item: "74", text: "Which export format?", options: [], since: NOW - 2000 };
	const newer: Question = { item: "74", text: "Ship the exam export?", options: [], since: NOW - 1000 };
	const text = paneOf({ ...fullStatus, questions: [older, newer] });
	const flowStart = text.findIndex((line) => line.startsWith(" #74"));

	expect(text.findIndex((line) => line.includes("Which export format?"))).toBeLessThan(flowStart);
	expect(text.findIndex((line) => line.includes("Ship the exam export?"))).toBeGreaterThan(flowStart);
});

test("an inline pane with no card opens as tall as its header and the first item's rail", () => {
	const status = { ...fullStatus, questions: [], cards: [] };
	const input = { read: { kind: "status", status }, now: NOW, amberAfterSeconds: 300, width: WIDTH, dismissed: [] } as const;
	const text = paneOf(status);

	expect(openingRows(input)).toBe(text.findIndex((line) => line.startsWith(" seed-3")) - 1);
});
