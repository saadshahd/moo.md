import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FollowUp, ItemRef, WorkSource } from "../src/adapter-api.ts";
import { modelCallOver } from "../src/adapters/model-call.ts";
import type { Finished, Runner } from "../src/adapters/claude-p.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { checkNameOf, fileChecks, filedFrom } from "../src/loop/check-item.ts";
import { groupNotes } from "../src/loop/groups.ts";
import { addEntry, MemoryFormatError, MemoryFull, parseMemory, renderMemory, unusedEntries, withoutCovered } from "../src/loop/memory.ts";
import { breakNotes, ownerNotes, planChangingNotes, type RawComment, saveNotes } from "../src/loop/notes.ts";
import { closeLoop, confirmChecks } from "../src/loop/pass.ts";
import { trustsRepeats } from "../src/loop/pair.ts";
import { noteKey, type ReviewNote } from "../src/loop/records.ts";
import { pairing, prepare } from "../src/loop/signals.ts";
import { openState } from "../src/state/open.ts";
import { z } from "zod";
import type { PastChange } from "../src/decide/labels.ts";

const folders: string[] = [];

const freshState = () => {
	const dir = mkdtempSync(join(tmpdir(), "hum-loop-"));

	folders.push(dir);

	return openState(dir);
};

afterEach(() => {
	for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const note = (over: Partial<ReviewNote> = {}): ReviewNote => ({ source: "review-comment", sourceId: "1", change: "c1", hunk: "", text: "Use a lookup table.", at: 1, ...over });

const hunk = (...lines: string[]): string => ["@@ -1,2 +1,2 @@", ...lines].join("\n");

const signalOf = (a: ReviewNote, b: ReviewNote): string | undefined => pairing(prepare(a), prepare(b)).signal;

const comment = (over: Partial<RawComment>): RawComment => ({ kind: "comment", id: "c", author: "owner", isBot: false, body: "Rename this.", commit: "abc", at: 1, ...over });

test("only the owner's comments and review bodies are notes: another person, a bot and an empty body are not", () => {
	const notes = ownerNotes(
		[comment({ id: "1" }), comment({ id: "2", author: "reviewer" }), comment({ id: "3", isBot: true }), comment({ id: "4", kind: "review", body: "Too wide." }), comment({ id: "5", body: "  " })],
		["owner"],
	);

	expect(notes.map(({ source, sourceId }) => `${source}:${sourceId}`)).toEqual(["review-comment:1", "review-body:4"]);
});

test("an applied answer other than an approval is a note; an approval and a dropped answer are not", () => {
	const answer = (ordinal: number, over: { option?: string; disposition?: "dropped" }) => ({ item: "a", ordinal, text: "Use Plain", source: "free" as const, disposition: "applied" as const, why: "w", at: 1, ...over });

	const notes = planChangingNotes([answer(1, { option: "Plain" }), answer(2, { option: "approve" }), answer(3, { disposition: "dropped" }), answer(4, {})]);

	expect(notes.map(({ sourceId }) => sourceId)).toEqual(["a:1", "a:4"]);
});

test("a revert and a fix are notes about the change they break, with the hunk they made", async () => {
	const change = (sha: string, subject: string, files: string[], extra: Partial<PastChange> = {}): PastChange => ({ sha, subject, body: "", files, size: 1, blamed: [], ...extra });

	const notes = await breakNotes(
		[change("aaaaaaa", "feat: a", ["src/a.ts"]), change("bbbbbbb", 'Revert "feat: a"', ["src/a.ts"], { committedAt: 5 }), change("ccccccc", "feat: c", ["src/c.ts"])],
		SHIPPED_DEFAULTS.changeLabels,
		async (sha) => `hunk of ${sha}`,
	);

	expect(notes).toEqual([{ source: "revert", sourceId: "bbbbbbb", change: "aaaaaaa", file: "src/a.ts", hunk: "hunk of bbbbbbb", text: 'Revert "feat: a"', at: 5 }]);
});

test("a note is saved once: reading the same source id again adds nothing", () => {
	const state = freshState();

	expect(saveNotes(state, [note({ sourceId: "1" }), note({ sourceId: "2" })])).toHaveLength(2);
	expect(saveNotes(state, [note({ sourceId: "1" }), note({ sourceId: "3" })]).map(({ sourceId }) => sourceId)).toEqual(["3"]);
});

test("each signal pairs the notes it should, and names itself", () => {
	const user = hunk("-const user = fetchUser(id);", "+const user = await fetchUser(id);");
	const declare = hunk("+export const parseThing = (text: string) => text.trim();");

	expect(signalOf(note({ text: "Use a lookup table." }), note({ text: "use a  lookup-table" }))).toBe("same-text");
	expect(signalOf(note({ text: "Prefer `isReady` here" }), note({ text: "Same: `isReady`, not a flag" }))).toBe("same-code");
	expect(signalOf(note({ text: "Wrap fetchUser in a retry.", file: "src/a.ts", hunk: user }), note({ sourceId: "2", change: "c2", text: "fetchUser needs a timeout.", file: "src/b.ts", hunk: user }))).toBe("shared-identifier");
	expect(signalOf(note({ text: "Name this better.", file: "src/a.ts", hunk: declare }), note({ sourceId: "2", change: "c2", text: "Too clever.", file: "src/b.ts", hunk: declare }))).toBe("same-glob-symbol");
	expect(
		signalOf(
			note({ source: "fix", text: "fix: a", file: "src/a.ts", hunk: hunk("-const a = load(1);", "+const a = load(2);") }),
			note({ source: "revert", sourceId: "2", text: "undo that", file: "src/b.ts", hunk: hunk("-const b = read(3);", "+const b = read(4);") }),
		),
	).toBe("same-code-pattern");
});

test("different notes on the same file pair under no signal", () => {
	const same = { file: "src/a.ts", hunk: hunk("+const total = add(a, b);") };

	expect(signalOf(note({ ...same, text: "Add a test for add." }), note({ ...same, sourceId: "2", text: "This name hides what it does." }))).toBeUndefined();
});

test("a hunk in a language the parser cannot read leaves the signals that need a parse visibly unapplied", () => {
	const found = pairing(prepare(note({ file: "README.md", hunk: hunk("+text"), text: "One." })), prepare(note({ file: "README.md", hunk: hunk("+text"), text: "Two." })));

	expect(found.unapplied).toEqual(["shared-identifier", "same-glob-symbol"]);
});

const proposer = (answer: { same: boolean; models: string[] } | undefined) => {
	const asked: string[] = [];

	return { asked, propose: async (a: ReviewNote, b: ReviewNote) => (asked.push(`${a.sourceId}~${b.sourceId}`), answer) };
};

const group = async (notes: ReviewNote[], answer: Parameters<typeof proposer>[0], trusted: boolean) => {
	const state = freshState();
	const { asked, propose } = proposer(answer);

	saveNotes(state, notes);
	await groupNotes({ state, propose, trusts: () => trusted, onUnapplied: () => {} }, notes);

	return { state, asked };
};

test("the model sees only notes no signal pairs; a trusted proposal joins the group", async () => {
	const { state, asked } = await group([note({ sourceId: "1", at: 1, text: "Use a lookup table." }), note({ sourceId: "2", at: 2, text: "use a lookup-table" }), note({ sourceId: "3", at: 3, text: "Cache the result." })], { same: true, models: ["m"] }, true);

	expect(asked).toEqual(["1~3"]);
	expect(state.repeats.list().map(({ notes }) => notes.length)).toEqual([3]);
});

test("a proposal from a model below the owner's bar waits as a possible repeat and files nothing", async () => {
	const { state } = await group([note({ sourceId: "1", at: 1, text: "Use a lookup table." }), note({ sourceId: "2", at: 2, text: "Cache the result." })], { same: true, models: ["m"] }, false);

	expect(state.repeats.list()).toHaveLength(2);
	expect(state.possibleRepeats.list()).toHaveLength(1);
});

test("a model that abstains proposes nothing", async () => {
	const { state } = await group([note({ sourceId: "1", at: 1 }), note({ sourceId: "2", at: 2, text: "Cache the result." })], undefined, true);

	expect(state.possibleRepeats.list()).toHaveLength(0);
	expect(state.repeats.list()).toHaveLength(2);
});

test("a model id counts for repeats only at the owner's precision bar", () => {
	const config = { ...SHIPPED_DEFAULTS, measuredModels: { ...SHIPPED_DEFAULTS.measuredModels, "repeat-pair": { good: 0.95, weak: 0.7 } } };

	expect([trustsRepeats(["good"], config), trustsRepeats(["good", "weak"], config), trustsRepeats(["unmeasured"], config), trustsRepeats([], config)]).toEqual([true, false, false, false]);
});

const fakeSource = () => {
	const filed: { from: string; followUp: FollowUp }[] = [];
	const commented: { id: string; text: string }[] = [];

	const workSource = {
		fileFollowUp: async (from: string, followUp: FollowUp): Promise<ItemRef> => {
			if (!filed.some((found) => found.from === from && found.followUp.title === followUp.title)) filed.push({ from, followUp });

			return { id: `${from}-item`, title: followUp.title };
		},
		comment: async (id: string, text: string) => void commented.push({ id, text }),
	} satisfies Pick<WorkSource, "fileFollowUp" | "comment">;

	return { workSource, filed, commented };
};

const filing = { repeatAt: 2, checkKind: "check" };

test("two matching notes file one check item, a third joins it as a comment, and a rerun files nothing", async () => {
	const state = freshState();
	const { workSource, filed, commented } = fakeSource();
	const notes = [note({ sourceId: "1", at: 1 }), note({ sourceId: "2", at: 2 })];

	saveNotes(state, notes);
	await groupNotes({ state, propose: async () => undefined, trusts: () => true, onUnapplied: () => {} }, notes);
	await fileChecks({ state, workSource, ...filing });
	await fileChecks({ state, workSource, ...filing });

	expect(filed).toHaveLength(1);
	expect(filed[0]?.followUp.body).toContain("Kind: check");
	expect(filed[0]?.followUp.body).toContain(checkNameOf(noteKey(note({ sourceId: "1" }))));

	const third = note({ sourceId: "3", at: 3, text: "use a lookup table" });

	saveNotes(state, [third]);
	await groupNotes({ state, propose: async () => undefined, trusts: () => true, onUnapplied: () => {} }, [third]);
	await fileChecks({ state, workSource, ...filing });
	await fileChecks({ state, workSource, ...filing });

	expect(filed).toHaveLength(1);
	expect(commented.map(({ id }) => id)).toEqual([`${filedFrom(noteKey(note({ sourceId: "1" })))}-item`]);
});

const filedGroup = async () => {
	const state = freshState();
	const { workSource, filed } = fakeSource();
	const notes = [note({ sourceId: "1", at: 1 }), note({ sourceId: "2", at: 2 })];

	saveNotes(state, notes);
	await groupNotes({ state, propose: async () => undefined, trusts: () => true, onUnapplied: () => {} }, notes);
	await fileChecks({ state, workSource, ...filing });

	const [only] = state.repeats.list();

	if (!only) throw new Error("no group was filed");

	return { state, workSource, filed, group: only };
};

test("a landed check item whose name the next CI log shows is confirmed; a log without it is not", async () => {
	const { state, group: held } = await filedGroup();

	const item = held.item ?? "";

	state.merges.put(item, { item, sha: "s", at: 10, paths: [] });
	await confirmChecks({ state, now: () => 20, ciLogs: async () => ["lint ok"] });
	expect(state.repeats.get(held.key)?.checked).toBeUndefined();

	await confirmChecks({ state, now: () => 20, ciLogs: async () => [`ran ${checkNameOf(held.key)}: passed`] });
	expect(state.repeats.get(held.key)?.checked).toEqual({ at: 20, check: checkNameOf(held.key) });
});

test("a note that comes after the check ran reopens it as a miss, once, and memory.md drops the covered entries", async () => {
	const { state, workSource, filed, group: held } = await filedGroup();
	const dir = mkdtempSync(join(tmpdir(), "hum-memory-"));

	folders.push(dir);
	const memoryPath = join(dir, "memory.md");

	await Bun.write(memoryPath, renderMemory([{ rule: "Use a lookup table", source: noteKey(note({ sourceId: "1" })) }, { rule: "Name things", source: "elsewhere" }]));
	state.repeats.put(held.key, { ...held, checked: { at: 5, check: checkNameOf(held.key) } });
	saveNotes(state, [note({ sourceId: "9", at: 9, text: "use a lookup table again" })]);
	const current = state.repeats.get(held.key);

	if (!current) throw new Error("the group is gone");

	state.repeats.put(held.key, { ...current, notes: [...held.notes, noteKey(note({ sourceId: "9" }))] });

	await closeLoop({ state, workSource, memoryPath });
	await closeLoop({ state, workSource, memoryPath });

	expect(filed.filter(({ followUp }) => followUp.title.startsWith("Check missed"))).toHaveLength(1);
	expect(parseMemory(await Bun.file(memoryPath).text())).toEqual([{ rule: "Name things", source: "elsewhere" }]);
});

test("memory.md keeps one entry per rule, refuses a line with no source and an entry past its cap, and lists entries no run used", () => {
	const held = [{ rule: "Use a lookup table", source: "review-comment:1" }];

	expect(addEntry(held, { rule: "use a  Lookup table", source: "review-comment:7" }, 1000)).toEqual([{ rule: "use a  Lookup table", source: "review-comment:7" }]);
	expect(() => addEntry(held, { rule: "x".repeat(50), source: "s" }, 60)).toThrow(MemoryFull);
	expect(() => parseMemory("- a rule with no source\n")).toThrow(MemoryFormatError);
	expect(withoutCovered(held, new Set(["review-comment:1"]))).toEqual([]);
	expect(unusedEntries([...held, { rule: "Fresh", source: "s" }], new Map([["Fresh", 95]]), 100, 20)).toEqual(held);
});

const runnerSpending = (structured: { kind: string }, tokens: number): Runner => ({
	limitedUntil: () => 0,
	run: async () => ({ kind: "finished", subtype: "success", isError: false, sessionId: "s", text: "", structured, tokens, cacheReadTokens: 0, plugins: [], keySource: undefined, models: ["m"] }) satisfies Finished,
});

test("a model call tells what it spent for the item it served, whether it was trusted or not", async () => {
	const spent: [string, number][] = [];
	const question = { boundary: "kind" as const, prompt: "p", answer: z.strictObject({ kind: z.string() }), item: "a" };
	const options = { model: "m", timeoutMs: 1000, onSpent: (item: string, tokens: number) => void spent.push([item, tokens]) };

	const picked = await modelCallOver(runnerSpending({ kind: "docs" }, 5000), { ...options, trusts: () => true })(question);
	const refused = await modelCallOver(runnerSpending({ kind: "docs" }, 4000), { ...options, trusts: () => false })(question);

	expect([picked.kind, refused.kind]).toEqual(["picked", "abstained"]);
	expect(spent).toEqual([["a", 5000], ["a", 4000]]);
});
