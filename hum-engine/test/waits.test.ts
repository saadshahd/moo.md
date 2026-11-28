import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { OWNER_SOURCE } from "../src/state/events.ts";
import { openState } from "../src/state/open.ts";
import type { Parked } from "../src/state/saved.ts";
import { emptyStatus, publishStatus, readStatus, WAITS_CODE } from "../src/status/file.ts";
import type { Card, Controls, OpenItem, Question } from "../src/status/format.ts";
import { type WaitFacts, Waits, waitsOf } from "../src/status/waits.ts";
import { tempDir } from "./fixtures/temp.ts";

const NONE: Controls = { choices: [], answer: false, skip: false, runNow: false, noteTo: [] };

const ROW = { name: "hum #1 build", agent: "41", state: "idle", link: "roundup://agent/41?project=p" };
const PAD = { name: "hum #1 handoff", link: "roundup://pad/hum-1?project=p" };

const openAt = (item: string, at: string, since: number, controls: Partial<Controls> = {}, waitsOnOwner = true): OpenItem => ({
	item,
	title: `Title of ${item}`,
	kind: "fix",
	flowVersion: "1",
	steps: [{ name: at, part: "step", waitsOnOwner }],
	at,
	since,
	running: false,
	controls: { ...NONE, ...controls },
});

const card = (fields: Partial<Card> & Pick<Card, "code" | "since">): Card => ({ kind: "fault", key: fields.item === undefined ? fields.code : `${fields.code}:${fields.item}`, cause: `${fields.code} happened`, fix: `Fix ${fields.code}.`, ...fields });

const asked = (item: string, since: number, options: string[] = []): Question => ({ item, text: `What of ${item}?`, options, since });

const NO_FACTS: WaitFacts = { parked: [], landings: [], merges: [], looked: undefined, answered: undefined };

test("an item at a step that waits on the owner offers each option, each choice with an answer word, words, skip, run now and a note to each step it can reach, each named by the choice its answer records, at the wait it was saved at", () => {
	const item = {
		...openAt("#1", "owner-review", 100, {
			choices: [
				{ label: "Approve", event: "owner-approved", answer: "approve" },
				{ label: "Object", event: "owner-rejected" },
			],
			answer: true,
			skip: true,
			runNow: true,
			noteTo: ["building", "reviewing"],
		}),
		rows: [ROW],
		handoff: PAD,
	};

	const { waits } = waitsOf({ open: [item], questions: [asked("#1", 120, ["approve", "retry"])], cards: [] }, { ...NO_FACTS, landings: [{ item: "#1", since: 90, pullRequest: "https://github.com/o/r/pull/7" }] }, 500);

	expect(waits).toEqual([
		{
			from: "step",
			item: "#1",
			title: "Title of #1",
			kind: "fix",
			step: "owner-review",
			since: 100,
			wait: { step: "owner-review", since: 100 },
			question: "What of #1?",
			actions: [
				{ label: "approve", choice: "approve", words: false },
				{ label: "retry", choice: "retry", words: false },
				{ label: "reply", choice: "", words: true },
				{ label: "skip", choice: "skip", words: false },
				{ label: "run now", choice: "run-now", words: false },
				{ label: "note to building", choice: "note:building", words: true },
				{ label: "note to reviewing", choice: "note:reviewing", words: true },
			],
			rows: [ROW],
			pullRequest: "https://github.com/o/r/pull/7",
			handoff: PAD,
		},
	]);
});

test("a step without a question offers its choices that have an answer word, and words only where it takes them", () => {
	const item = openAt("#1", "owner-review", 100, { choices: [{ label: "Approve", event: "owner-approved", answer: "approve" }, { label: "Object", event: "owner-rejected" }] });

	expect(waitsOf({ open: [item], questions: [], cards: [] }, NO_FACTS, 500).waits.flatMap((entry) => ("actions" in entry ? entry.actions : []))).toEqual([{ label: "Approve", choice: "approve", words: false }]);
});

test("an item a pass runs on, or at a step that waits on no one, is no wait", () => {
	const open = [{ ...openAt("#1", "owner-review", 100), running: true }, openAt("#2", "building", 100, {}, false)];

	expect(waitsOf({ open, questions: [], cards: [] }, NO_FACTS, 500).waits).toEqual([]);
});

test("a parked item's only wait is its card: the answers that release it, its own action under the card's label, at the wait its park began; another card on it offers nothing", () => {
	const parked: Parked = { item: "#3", why: "review", cause: "its change waits for a review", since: 200 };
	const parkCard = card({ code: "item-review", item: "#3", since: 201, action: { label: "Approve", answer: "approve" } });
	const runCard = card({ code: "run-error", item: "#3", since: 300 });
	const { waits } = waitsOf({ open: [openAt("#3", "owner-review", 150, { skip: true, noteTo: ["building"] })], questions: [asked("#3", 205, ["approve", "retry"])], cards: [parkCard, runCard] }, { ...NO_FACTS, parked: [parked] }, 500);

	expect(waits).toEqual([
		{
			from: "card",
			item: "#3",
			title: "Title of #3",
			key: "item-review:#3",
			code: "item-review",
			cause: "item-review happened",
			fix: "Fix item-review.",
			since: 200,
			wait: { step: "parked:review", since: 200 },
			question: "What of #3?",
			actions: [
				{ label: "Approve", choice: "approve", words: false },
				{ label: "retry", choice: "retry", words: false },
			],
		},
		{ from: "card", item: "#3", title: "Title of #3", key: "run-error:#3", code: "run-error", cause: "run-error happened", fix: "Fix run-error.", since: 300, actions: [] },
	]);
});

test("a change whose pull request waits for the owner's approval offers approve and the open question's options, from when the change was saved, while no pass runs on it and it is not parked", () => {
	const landings = [
		{ item: "#7", since: 250, pullRequest: "https://github.com/o/r/pull/12", awaitsOwner: "its level waits for the owner's review" },
		{ item: "#8", since: 260, pullRequest: "https://github.com/o/r/pull/13" },
		{ item: "#9", since: 270, pullRequest: "https://github.com/o/r/pull/14", awaitsOwner: "its level waits for the owner's review" },
		{ item: "#10", since: 280, pullRequest: "https://github.com/o/r/pull/15", awaitsOwner: "its level waits for the owner's review" },
	];

	const parked: Parked[] = [{ item: "#10", why: "review", cause: "its pull request was closed unmerged", since: 290 }];

	const open = [openAt("#7", "merging", 240, {}, false), { ...openAt("#9", "merging", 240, {}, false), running: true }];
	const { waits } = waitsOf({ open, questions: [asked("#7", 280, ["low", "high"])], cards: [] }, { ...NO_FACTS, landings, parked }, 500);

	expect(waits).toEqual([
		{
			from: "landing",
			item: "#7",
			title: "Title of #7",
			why: "its level waits for the owner's review",
			since: 250,
			wait: { step: "merging", since: 240 },
			question: "What of #7?",
			actions: [
				{ label: "approve", choice: "approve", words: false },
				{ label: "low", choice: "low", words: false },
				{ label: "high", choice: "high", words: false },
			],
			pullRequest: "https://github.com/o/r/pull/12",
		},
	]);
});

test("a card about one item that parked nothing and a card about hum itself offer no action", () => {
	const cards = [card({ code: "run-error", item: "#4", since: 300 }), card({ code: "config-invalid", since: 310 })];
	const { waits } = waitsOf({ open: [], questions: [], cards }, NO_FACTS, 500);

	expect(waits).toEqual([
		{ from: "card", item: "#4", key: "run-error:#4", code: "run-error", cause: "run-error happened", fix: "Fix run-error.", since: 300, actions: [] },
		{ from: "hum", key: "config-invalid", code: "config-invalid", cause: "config-invalid happened", fix: "Fix config-invalid.", since: 310 },
	]);
});

test("a question to an item no step or park names is a wait of its own: its options, else words, at the step its item is saved at", () => {
	const questions = [asked("#5", 400, ["fix", "feature"]), asked("#6", 410)];
	const { waits } = waitsOf({ open: [openAt("#6", "landing", 90, {}, false)], questions, cards: [] }, NO_FACTS, 500);

	expect(waits).toEqual([
		{ from: "question", item: "#5", question: "What of #5?", since: 400, actions: [{ label: "fix", choice: "fix", words: false }, { label: "feature", choice: "feature", words: false }] },
		{ from: "question", item: "#6", title: "Title of #6", question: "What of #6?", since: 410, wait: { step: "landing", since: 90 }, actions: [{ label: "reply", choice: "", words: true }] },
	]);
});

test("the waits come oldest first, whatever they come from", () => {
	const parked: Parked = { item: "#3", why: "stuck", cause: "a run failed", since: 50 };

	const status = {
		open: [openAt("#1", "objecting", 300)],
		questions: [asked("#2", 100)],
		cards: [card({ code: "worker-down", since: 200 }), card({ code: "item-stuck", item: "#3", since: 400, action: { label: "Run it again", answer: "retry" } })],
	};

	expect(waitsOf(status, { ...NO_FACTS, parked: [parked] }, 500).waits.map((entry) => ("item" in entry ? entry.item : entry.key))).toEqual(["#3", "#2", "worker-down", "#1"]);
});

test("the changes merged without the owner count from their last look, else from their newest answer, else every one, and a look marks them seen", () => {
	const merges = [
		{ at: 50, doneBy: undefined },
		{ at: 100, doneBy: "checks" },
		{ at: 200, doneBy: "owner" },
		{ at: 300, doneBy: "review" },
	] as const;

	const mergedWith = (looked?: number, answered?: number) => waitsOf({ open: [], questions: [], cards: [] }, { ...NO_FACTS, merges, looked, answered }, 500).merged;
	const look = [{ label: "open the list", choice: "looked", words: false }];

	expect(mergedWith(150, 75)).toEqual({ count: 1, since: { by: "looked", at: 150 }, actions: look });
	expect(mergedWith(undefined, 75)).toEqual({ count: 2, since: { by: "answered", at: 75 }, actions: look });
	expect(mergedWith()).toEqual({ count: 3, actions: look });
});

test("each write of the status writes the waits built from it beside it, with the parks, pull request links, merges, the owner's last look and newest answer hum saved", () => {
	const state = openState(tempDir("waits"), { now: () => 0 });
	const answered = (itemId: string, at: number) => state.events.add({ itemId, source: OWNER_SOURCE, sourceId: `c${at}`, type: "answered", payload: { choice: "", text: "ok", at, read: "free" } });
	const merged = () => Waits.parse(JSON.parse(readFileSync(state.waitsPath, "utf8"))).merged.since;
	const parked: Parked = { item: "#3", why: "review", cause: "its change waits for a review", since: 200 };

	state.parked.put("#3", parked);
	state.landings.put("#3", { item: "#3", branch: "hum/3", since: 150, change: { paths: ["docs/a.md"], size: 1, loosened: false, pinChanged: false }, head: "abc", pullRequest: "https://github.com/o/r/pull/9" });
	state.faults.raise({ code: "item-review", item: "#3", cause: "item-review happened", fix: "Fix item-review.", action: { label: "Approve", answer: "approve" } });
	state.merges.put("#8", { item: "#8", sha: "m8", at: 400, paths: [] });
	answered("#1", 90);
	answered("#2", 120);
	state.events.add({ itemId: "#2", source: "judge", type: "picked", payload: { judge: "alignment", head: "abc", alignment: { abstained: "no diff" } } });

	const status = emptyStatus("0.0.0", 500);

	publishStatus(state, status);
	expect(Waits.parse(JSON.parse(readFileSync(state.waitsPath, "utf8")))).toMatchObject({
		writtenAt: 500,
		waits: [{ from: "card", item: "#3", wait: { step: "parked:review", since: 200 }, pullRequest: "https://github.com/o/r/pull/9" }],
		merged: { count: 1, since: { by: "answered", at: 120 } },
	});

	writeFileSync(state.lookedPath, JSON.stringify({ at: 450 }));
	publishStatus(state, status);
	expect(merged()).toEqual({ by: "looked", at: 450 });
});

test("waits hum cannot build raise one card in the status it still writes, the waits file keeps its last good list, and the card goes once they build", () => {
	const state = openState(tempDir("waits"), { now: () => 0 });

	const codes = () => {
		const read = readStatus(state.statusPath);

		return read.ok ? read.status.cards.map(({ code }) => code) : read.message;
	};

	publishStatus(state, emptyStatus("0.0.0", 100));
	writeFileSync(state.lookedPath, "{ not json");
	publishStatus(state, emptyStatus("0.0.0", 200));

	expect(codes()).toEqual([WAITS_CODE]);
	expect(Waits.parse(JSON.parse(readFileSync(state.waitsPath, "utf8"))).writtenAt).toBe(100);

	writeFileSync(state.lookedPath, JSON.stringify({ at: 150 }));
	publishStatus(state, emptyStatus("0.0.0", 300));

	expect(codes()).toEqual([]);
	expect(Waits.parse(JSON.parse(readFileSync(state.waitsPath, "utf8"))).writtenAt).toBe(300);
});
