import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { gitIn } from "../src/adapters/git.ts";
import type { Pull } from "../src/adapters/pull-requests.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { labelChanges, type PastChange } from "../src/decide/labels.ts";
import { measureInputsOf } from "../src/measure/inputs.ts";
import { type AbandonedItem, type MergedChange, measureOf } from "../src/measure/measure.ts";
import { openState } from "../src/state/open.ts";
import { settleMergedPulls } from "../src/worker/merged.ts";
import { pastChange } from "./fixtures/records.ts";
import { tempDir } from "./fixtures/temp.ts";
import { rateOf, withRate } from "../src/measure/rate.ts";
import { isTrusted } from "../src/decide/prose.ts";
import { doesGateAlignment } from "../src/decide/alignment.ts";


const freshState = () => openState(tempDir("measure"), { now: Date.now });

const merge = (n: number): MergedChange => ({ item: `m${n}`, at: n, paths: [n < 10 ? "ui/x.ts" : "api/y.ts"], notes: n % 5 === 0 ? 2 : 0, questions: n % 4 === 0 ? 1 : 0, tokens: 1000 });

const merges = Array.from({ length: 20 }, (_, n) => merge(n));

const abandoned: AbandonedItem[] = [
	{ item: "x1", since: 3, paths: [], notes: 1, questions: 1, tokens: 5000 },
	{ item: "x2", since: 8, paths: [], notes: 0, questions: 1, tokens: 3000 },
	{ item: "x3", since: 15, paths: [], notes: 0, questions: 0, tokens: 2000 },
];

const window = { loopTokens: 400, window: 20, globs: ["ui/**"] };

test("20 merges and 3 abandoned items give known notes, questions and tokens per merge, and per path", () => {
	expect(measureOf({ merged: merges, abandoned, ...window })).toEqual({
		window: 20,
		merges: 20,
		abandoned: 3,
		notes: 9 / 20,
		questions: 7 / 20,
		tokens: (20_000 + 10_000 + 400) / 20,
		byPath: [{ glob: "ui/**", merges: 10, abandoned: 0, notes: 4 / 10, questions: 3 / 10, tokens: 1000 }],
	});
});

test("an item abandoned before the window does not count", () => {
	const withOld = measureOf({ merged: merges.map((found) => ({ ...found, at: found.at + 100 })), abandoned, ...window });

	expect(withOld?.abandoned).toBe(0);
});

test("only the last window of merges counts, and nothing merged measures nothing", () => {
	const more = [...merges, merge(20), merge(21)];

	expect(measureOf({ merged: more, abandoned: [], ...window, window: 20 })?.merges).toBe(20);
	expect(measureOf({ merged: [], abandoned, ...window })).toBeUndefined();
});

test("the inputs come from what the engine saved: notes by commit or item, questions by op key, stuck items as abandoned, and tokens with the loop's own", async () => {
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

	expect(measureInputsOf(state)).toEqual({
		merged: [{ item: "a", at: 5, paths: ["ui/a.ts"], notes: 2, questions: 1, tokens: 700 }],
		abandoned: [{ item: "b", since: 6, paths: [], notes: 0, questions: 0, tokens: 0 }],
		loopTokens: 90,
	});
});

/** A pull request in `state`, and a work source that writes each item it finishes into `finished`. */
const pull = (state: Pull["state"], finished: string[]) => ({
	pulls: { find: async () => ({ id: "p", number: 1, url: "u", state, autoMerge: true, behind: false }) },
	workSource: { finish: async (id: string) => void finished.push(id) },
	git: gitIn(tmpdir(), { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }),
	remote: "origin",
});

test("a change merged through a pull request after the worker moved on ends its item and is recorded as merged, once, and its saved landing goes", async () => {
	const state = freshState();
	const finished: string[] = [];

	state.landings.put("a", { item: "a", branch: "hum/a", since: 1, change: { paths: ["ui/a.ts"], size: 3, loosened: false, pinChanged: false }, head: "sha-a" });
	await settleMergedPulls(state, pull("OPEN", finished), 9);
	expect(state.merges.list()).toEqual([]);
	expect(finished).toEqual([]);

	await settleMergedPulls(state, pull("MERGED", finished), 9);
	await settleMergedPulls(state, pull("MERGED", finished), 10);

	expect(finished).toEqual(["a"]);
	expect(state.merges.list()).toEqual([{ item: "a", sha: "sha-a", at: 9, paths: ["ui/a.ts"] }]);
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

test("a measured rate is kept under the model as the owner names it and under each id that answered, so an alias such as haiku is trusted by the id its answers name", () => {
	const shipped = SHIPPED_DEFAULTS.measuredModels;
	const measured = withRate(shipped, { boundary: "alignment", model: "haiku", answered: ["global.anthropic.claude-haiku-5-5"], rate: 0.8123 });
	const bar = { measuredModels: measured, minJudgeRate: 0.8 };

	expect(measured).toEqual({ ...shipped, alignment: { ...shipped.alignment, haiku: 0.81, "global.anthropic.claude-haiku-5-5": 0.81 } });
	expect(isTrusted(["global.anthropic.claude-haiku-5-5"], "alignment", bar)).toBe(true);
	expect(doesGateAlignment({ ...bar, decisionModel: "haiku" })).toBe(true);
});
