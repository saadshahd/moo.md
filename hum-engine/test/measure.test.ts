import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { gitIn } from "../src/adapters/git.ts";
import type { Pull } from "../src/adapters/pull-requests.ts";
import { BOUNDARIES, SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { labelChanges, type PastChange } from "../src/decide/labels.ts";
import { measureInputsOf } from "../src/measure/inputs.ts";
import { type AbandonedItem, type MergedChange, measureOf } from "../src/measure/measure.ts";
import { openState } from "../src/state/open.ts";
import { settleMergedPulls } from "../src/worker/merged.ts";
import type { DoneBy } from "../src/decide/merge.ts";
import type { Merge } from "../src/loop/records.ts";
import { keepLanding } from "../src/state/item-log.ts";
import { configWith } from "./fixtures/config.ts";
import { pastChange } from "./fixtures/records.ts";
import { tempDir } from "./fixtures/temp.ts";
import { rateOf, withRate } from "../src/measure/rate.ts";
import { isTrusted } from "../src/decide/prose.ts";
import { doesGateAlignment } from "../src/decide/alignment.ts";


const freshState = () => openState(tempDir("measure"), { now: Date.now });

/** The first four were saved before hum kept how an item reached done; then review and checks take turns. One is reverted, and every sixth fixed. */
const merge = (n: number): MergedChange => ({
	item: `m${n}`,
	at: n,
	paths: [n < 10 ? "ui/x.ts" : "api/y.ts"],
	doneBy: n < 4 ? undefined : n % 2 === 0 ? "review" : "checks",
	label: n === 5 ? "reverted" : n % 6 === 0 ? "fixed" : "clean",
	notes: n % 5 === 0 ? 2 : 0,
	questions: n % 4 === 0 ? 1 : 0,
	tokens: 1000,
});

const merges = Array.from({ length: 20 }, (_, n) => merge(n));

const abandoned: AbandonedItem[] = [
	{ item: "x1", since: 3, paths: [], notes: 1, questions: 1, tokens: 5000 },
	{ item: "x2", since: 8, paths: [], notes: 0, questions: 1, tokens: 3000 },
	{ item: "x3", since: 15, paths: [], notes: 0, questions: 0, tokens: 2000 },
];

const window = { loopTokens: 400, window: 20, globs: ["ui/**"] };

test("20 merges and 3 abandoned items give known notes, questions and tokens per merge, per path, and the reverts and fixes of each way of reaching done", () => {
	expect(measureOf({ merged: merges, abandoned, ...window })).toEqual({
		window: 20,
		merges: 20,
		abandoned: 3,
		notes: 9 / 20,
		questions: 7 / 20,
		tokens: (20_000 + 10_000 + 400) / 20,
		byPath: [{ glob: "ui/**", merges: 10, abandoned: 0, notes: 4 / 10, questions: 3 / 10, tokens: 1000 }],
		byDoneBy: [
			{ doneBy: "checks", merges: 8, reverted: 1, fixed: 0 },
			{ doneBy: "review", merges: 8, reverted: 0, fixed: 3 },
		],
	});
});

test("an item abandoned before the window does not count", () => {
	const withOld = measureOf({ merged: merges.map((found) => ({ ...found, at: found.at + 100 })), abandoned, ...window });

	expect(withOld?.abandoned).toBe(0);
});

test("only the last window of merges counts, each way of reaching done over its own, and nothing merged measures nothing", () => {
	const more = [...merges, merge(20), merge(21)];

	expect(measureOf({ merged: more, abandoned: [], ...window, window: 20 })?.merges).toBe(20);
	expect(measureOf({ merged: merges, abandoned: [], ...window, window: 4 })?.byDoneBy).toEqual([
		{ doneBy: "checks", merges: 4, reverted: 0, fixed: 0 },
		{ doneBy: "review", merges: 4, reverted: 0, fixed: 2 },
	]);
	expect(measureOf({ merged: [], abandoned, ...window })).toBeUndefined();
});

test("the inputs come from what the engine saved: notes by commit or item, questions by op key, stuck items as abandoned, tokens with the loop's own, each merge's way of reaching done from its item's log, and its label from the reverts and fixes of its commits and the base's breaks after it", async () => {
	const state = freshState();
	const asked = (itemId: string, op: string, done: "done" | "started" = "done") => state.ops.once({ itemId, run: "ask", attempt: 0, op }, { holds: async () => done === "done", run: async () => {} });

	state.merges.put("a", { item: "a", sha: "sha-a", at: 5, paths: ["ui/a.ts"] });
	state.spent.put("a", { item: "a", total: 700, base: 0 });
	state.spent.put("loop:review-comment:1", { item: "loop:review-comment:1", total: 90, base: 0 });
	state.notes.put("review-comment:1", { source: "review-comment", sourceId: "1", change: "sha-a", hunk: "", text: "n", at: 1 });
	state.notes.put("plan-answer:a:1", { source: "plan-answer", sourceId: "a:1", change: "a", item: "a", hunk: "", text: "n", at: 2 });
	state.parked.put("b", { item: "b", why: "stuck", cause: "c", since: 6 });
	state.parked.put("c", { item: "c", why: "review", cause: "c", since: 6 });
	await asked("a", "question:one");
	await asked("a", "comment:other");

	const broke = (source: "revert" | "fix", sourceId: string, change: string) => state.notes.put(`${source}:${sourceId}`, { source, sourceId, change, hunk: "", text: "n", at: 7 });

	/** A merge whose item's log holds how landing found its change. */
	const mergeLogged = (merge: Merge, found: DoneBy) => {
		state.merges.put(merge.item, merge);
		keepLanding(state.events, merge.item, merge.sha, found);
		state.events.add({ source: "work-source", sourceId: `merged:${merge.sha}`, itemId: merge.item, type: "merged", payload: {} });
	};

	mergeLogged({ item: "fixed", sha: "merge-f", at: 6, paths: [], commits: ["run-f", "merge-f"], baseChecked: true }, "review");
	broke("fix", "f1", "run-f");
	mergeLogged({ item: "reverted", sha: "merge-r", at: 6, paths: [], commits: ["merge-r"], baseChecked: true }, "checks");
	broke("fix", "f2", "merge-r");
	broke("revert", "r1", "merge-r");
	mergeLogged({ item: "broke-base", sha: "merge-b", at: 6, paths: [], commits: ["merge-b"], baseChecked: true }, "owner");
	state.breaks.put("broke-base", { item: "broke-base", sha: "merge-b", at: 7, paths: [], level: "low", failure: "f", onBreak: "follow-up", followUp: "fix-b" });

	const inputs = measureInputsOf(state);

	expect({ ...inputs, merged: inputs.merged.toSorted((x, y) => x.item.localeCompare(y.item)) }).toEqual({
		merged: [
			{ item: "a", at: 5, paths: ["ui/a.ts"], doneBy: undefined, label: "clean", notes: 2, questions: 1, tokens: 700 },
			{ item: "broke-base", at: 6, paths: [], doneBy: "owner", label: "fixed", notes: 0, questions: 0, tokens: 0 },
			{ item: "fixed", at: 6, paths: [], doneBy: "review", label: "fixed", notes: 1, questions: 0, tokens: 0 },
			{ item: "reverted", at: 6, paths: [], doneBy: "checks", label: "reverted", notes: 2, questions: 0, tokens: 0 },
		],
		abandoned: [{ item: "b", since: 6, paths: [], notes: 0, questions: 0, tokens: 0 }],
		loopTokens: 90,
	});
});

test("a merge whose log holds a record a newer engine wrote reads its way of reaching done as unknown, with that engine's card, and the measure goes on", () => {
	const state = freshState();

	state.merges.put("a", { item: "a", sha: "sha-a", at: 5, paths: [] });
	openState(state.dir, { engineVersion: "99.0.0", now: Date.now }).events.add({ source: "work-source", sourceId: "merged:sha-a", itemId: "a", type: "merged", payload: {} });

	expect(measureInputsOf(state).merged.map(({ doneBy }) => doneBy)).toEqual([undefined]);
	expect(state.faults.list().map(({ code }) => code)).toEqual(["snapshot-from-newer-engine"]);
});

/** A pull request open, or merged as `merge-a` on the base, and a work source that writes each item it finishes into `finished`. */
const pull = (state: "OPEN" | "MERGED", finished: string[]) => ({
	pulls: { find: async (): Promise<Pull> => ({ id: "p", number: 1, url: "u", autoMerge: true, behind: false, ...(state === "MERGED" ? { state, mergeCommit: "merge-a" } : { state }) }) },
	workSource: { finish: async (id: string) => void finished.push(id) },
	git: gitIn(tmpdir(), { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }),
	remote: "origin",
});

test("a change merged through a pull request after the worker moved on ends its item and is recorded as merged at the commit its merge made, once, and its saved landing goes", async () => {
	const state = freshState();
	const finished: string[] = [];

	state.landings.put("a", { item: "a", branch: "hum/a", since: 1, change: { paths: ["ui/a.ts"], size: 3, loosened: false, pinChanged: false }, head: "sha-a", commits: ["sha-a"] });
	await settleMergedPulls(state, pull("OPEN", finished), 9);
	expect(state.merges.list()).toEqual([]);
	expect(finished).toEqual([]);

	await settleMergedPulls(state, pull("MERGED", finished), 9);
	await settleMergedPulls(state, pull("MERGED", finished), 10);

	expect(finished).toEqual(["a"]);
	expect(state.merges.list()).toEqual([{ item: "a", sha: "merge-a", at: 9, paths: ["ui/a.ts"], baseChecked: false, commits: ["sha-a", "merge-a"] }]);
	expect(state.landings.list()).toEqual([]);
	expect(state.events.list("a").map(({ type }) => type)).toEqual(["merged"]);
});

test("a revert titled revert!: that names a change's commit marks that change reverted; one that names none marks nothing", () => {
	const labels = (revert: PastChange) => labelChanges([pastChange({ sha: "3028506abcdef", subject: "feat: skills" }), revert], SHIPPED_DEFAULTS.changeLabels);

	expect(labels(pastChange({ sha: "54e7809", subject: "revert!: roll back to router skills pattern (pre-3028506)" })).get("3028506abcdef")).toBe("reverted");
	expect(labels(pastChange({ sha: "54e7809", subject: "revert!: roll back to router skills pattern" })).get("3028506abcdef")).toBe("clean");
});

test("a boundary where nothing was measured has no rate, so it never stands in for a measured one", () => {
	expect(rateOf(0, 0)).toBeUndefined();
	expect(rateOf(3, 4)).toBe(0.75);
});

test("rates measured into a hum.json that had none keep each boundary not measured, such as taste, with no rate, so the config still loads", () => {
	const measured = withRate({}, { boundary: "kind", model: "haiku", answered: [], rate: 0.9 });
	const loaded = configWith((raw) => (raw.hum.measuredModels = measured)).hum.measuredModels;

	expect(Object.keys(loaded).toSorted()).toEqual(BOUNDARIES.toSorted());
	expect(Object.entries(loaded).filter(([, rates]) => Object.keys(rates).length > 0)).toEqual([["kind", { haiku: 0.9 }]]);
});

test("a measured rate is kept under the model as the owner names it and under each id that answered, so an alias such as haiku is trusted by the id its answers name", () => {
	const shipped = SHIPPED_DEFAULTS.measuredModels;
	const measured = withRate(shipped, { boundary: "alignment", model: "haiku", answered: ["global.anthropic.claude-haiku-5-5"], rate: 0.8123 });
	const bar = { measuredModels: measured, minJudgeRate: 0.8 };

	expect(measured).toEqual({ ...shipped, alignment: { ...shipped.alignment, haiku: 0.81, "global.anthropic.claude-haiku-5-5": 0.81 } });
	expect(isTrusted(["global.anthropic.claude-haiku-5-5"], "alignment", bar)).toBe(true);
	expect(doesGateAlignment({ ...bar, decisionModel: "haiku" })).toBe(true);
});
