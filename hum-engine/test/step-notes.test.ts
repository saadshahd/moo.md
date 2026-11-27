import { expect, test } from "bun:test";
import shippedDocs from "../defaults/kinds/docs.json" with { type: "json" };
import type { ThreadEntry } from "../src/adapter-api.ts";
import { KindFile } from "../src/config/kind-file.ts";
import { decideNote, droppedNote, type NoteStand, noteFrom, noteReach, notesOn } from "../src/decide/note.ts";
import { configWith } from "./fixtures/config.ts";

const config = configWith();
const { feature, docs } = config.kinds;
const reachOf = (kind: NonNullable<typeof feature>, edited = config) => noteReach(kind, edited.hum.roles);
const sorted = (steps: ReadonlySet<string>): string[] => [...steps].toSorted();

test("a note reaches each step ahead whose run reads a prompt hum builds, and the step it goes on from only where a loop leads back or its run has yet to launch", () => {
	if (feature === undefined || docs === undefined) throw new Error("the shipped config lacks feature or docs");

	const featureReach = reachOf(feature);
	const docsReach = reachOf(docs);

	const straight = structuredClone(shippedDocs);

	straight.machine.states.building.invoke.onDone = { target: "merging" };
	straight.machine.states.building.on["token-cap"] = { target: "stuck" };

	const straightReach = noteReach(KindFile.parse(straight), config.hum.roles);

	expect(sorted(straightReach({ from: "building", launched: true, parked: false }))).toEqual([]);
	expect(sorted(straightReach({ from: "building", launched: false, parked: false }))).toEqual(["building"]);
	expect(sorted(featureReach({ from: "planning", launched: true, parked: false }))).toEqual(["building", "fixing", "planning", "reviewing"]);
	expect(sorted(featureReach({ from: "opening", launched: false, parked: false }))).toEqual(["building", "fixing", "ideating", "planning", "planning-after-talk", "reviewing", "shaping"]);
	expect(sorted(docsReach({ from: "fixing", launched: true, parked: false }))).toEqual(["building", "fixing"]);
	expect(sorted(docsReach({ from: "asking", launched: false, parked: false }))).toEqual(["building", "fixing"]);
	expect(sorted(docsReach({ from: "merging", launched: true, parked: false }))).toEqual([]);
});

test("a step that invokes a pick role takes no note: its row runs only for a choice a shape run named", () => {
	const edited = configWith((raw) => void (raw.kinds.feature.machine.states.shaping.invoke.src = "find"));
	const kind = edited.kinds.feature;

	if (kind === undefined) throw new Error("the shipped config lacks feature");

	expect(reachOf(kind, edited)({ from: kind.machine.initial, launched: false, parked: false }).has("shaping")).toBe(false);
	expect(reachOf(kind, edited)({ from: kind.machine.initial, launched: false, parked: false }).has("ideating")).toBe(true);
});

test("an item goes on from its step while a pass runs or its saved change lands, from the owner's wait it sleeps at, and else from its kind's first step; a parked one reaches no step", () => {
	if (docs === undefined) throw new Error("the shipped config lacks docs");

	const between = { running: false, landing: false, parked: false };

	expect(noteFrom(docs, "fixing", { ...between, running: true })).toEqual({ from: "fixing", launched: true, parked: false });
	expect(noteFrom(docs, "merging", { ...between, landing: true })).toEqual({ from: "merging", launched: true, parked: false });
	expect(noteFrom(docs, "asking", between)).toEqual({ from: "asking", launched: false, parked: false });
	expect(noteFrom(docs, "fixing", between)).toEqual({ from: docs.machine.initial, launched: false, parked: false });
	expect(noteFrom(docs, undefined, between)).toEqual({ from: docs.machine.initial, launched: false, parked: false });
	expect(reachOf(docs)(noteFrom(docs, "asking", { ...between, parked: true })).size).toBe(0);
});

const note = (step: string | undefined, at = 1): ThreadEntry => ({ kind: "note", text: `fix ${step}`, at, step, author: "hum" });

const atAsking: NoteStand = { at: "asking", reach: new Set(["building", "fixing"]), parked: false };

test("notes are numbered among the thread's notes alone, in the order sent", () => {
	const thread: ThreadEntry[] = [note("building"), { kind: "skip", text: "Skip asking.", at: 2, step: "asking" }, { kind: "comment", text: "a remark", at: 3 }, note("fixing", 4)];

	expect(notesOn(thread).map(({ ordinal, entry }) => [ordinal, entry.step])).toEqual([
		[1, "building"],
		[2, "fixing"],
	]);
});

test("hum keeps a note to a step the item can reach, and refuses, with why, one that names no step, one to a parked item and one whose step lies behind", () => {
	const decided = (entry: ThreadEntry, stand = atAsking) => {
		const [found] = notesOn([entry]);

		if (found === undefined) throw new Error("the entry is no note");

		return decideNote(found, stand);
	};

	expect(decided(note("fixing"))).toEqual({ disposition: "kept", why: "hum gives it to the next run of fixing" });
	expect(decided(note(undefined))).toEqual({ disposition: "refused", why: "it names no step" });
	expect(decided(note("fixing"), { ...atAsking, parked: true })).toEqual({ disposition: "refused", why: "the item is parked: act on its card first" });
	expect(decided(note("merging"))).toEqual({ disposition: "refused", why: "no run of merging lies ahead of the item at asking" });
});

test("a kept note is dropped once the item can no longer reach its step, and a parked item keeps it", () => {
	const past: NoteStand = { at: "merging", reach: new Set(), parked: false };

	expect(droppedNote("fixing", atAsking)).toBeUndefined();
	expect(droppedNote("fixing", past)).toEqual({ disposition: "dropped", why: "the item passed fixing with no way back from merging" });
	expect(droppedNote("fixing", { ...past, parked: true })).toBeUndefined();
});
