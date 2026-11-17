import { expect, test } from "bun:test";
import { MERGED_CASES, keepMergedCases, type CaseSources } from "../src/measure/cases.ts";
import { keepPick } from "../src/state/item-log.ts";
import { openState, type State } from "../src/state/open.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { pastChange } from "./fixtures/records.ts";
import { tempDir } from "./fixtures/temp.ts";

const ITEM = "#7";
const SETTINGS = { changeLabels: { ...SHIPPED_DEFAULTS.changeLabels, fixWindow: 2 }, diffLimit: SHIPPED_DEFAULTS.diffLimit };
const DIFF = "diff --git a/a.ts b/a.ts\n+export const a = 1;\n";

/** The base: c0 before the change, its two commits c1 and c2, then `later` changes on its file. */
const history = (later: number) => [pastChange({ sha: "c0" }), pastChange({ sha: "c1" }), pastChange({ sha: "c2" }), ...Array.from({ length: later }, (_, n) => pastChange({ sha: `l${n}` }))];

/** An item whose change, c1 then c2 on a.ts, merged after the alignment call graded it and a review run approved it. */
const mergedItem = (): State => {
	const state = openState(tempDir("cases"), { now: Date.now });

	state.merges.put(ITEM, { item: ITEM, sha: "c2", at: 1, paths: ["a.ts"], baseChecked: true, commits: ["c1", "c2"] });
	keepPick(state.events, { itemId: ITEM, pick: { judge: "alignment", head: "c2", alignment: { graded: { alignment: "sound", verification: "sound" } } } });
	keepPick(state.events, { itemId: ITEM, pick: { judge: "review", head: "c2", pick: { event: "approve", sure: true, reason: "As asked.", cites: [], parts: [] }, models: ["m"] } });

	return state;
};

const sourcesFor = (reads: string[]): CaseSources => ({
	itemText: async (item) => (reads.push(item), { title: "Export a", body: "One constant." }),
	diff: async (from, to) => (from === "c0" && to === "c2" ? DIFF : ""),
});

test("a merged change becomes a case of each judge it was put to once git settles its label, and a later revert relabels the case without reading the item again", async () => {
	const state = mergedItem();
	const reads: string[] = [];

	await keepMergedCases(state, history(1), SETTINGS, sourcesFor(reads));
	expect(state.cases.list()).toEqual([]);

	await keepMergedCases(state, history(2), SETTINGS, sourcesFor(reads));
	expect(state.cases.list()).toEqual([{ item: ITEM, title: "Export a", body: "One constant.", diff: DIFF, label: "clean", judges: ["alignment", "review-verdict"] }]);

	state.labels.put("c1", { sha: "c1", label: "reverted" });
	await keepMergedCases(state, history(2), SETTINGS, sourcesFor(reads));

	const merged = state.cases.list();

	expect(reads).toEqual([ITEM]);
	expect(MERGED_CASES.alignment(merged)).toEqual([{ case: ITEM, label: "reverted", subject: "Export a", body: "One constant.", diff: DIFF }]);
	expect(MERGED_CASES["review-verdict"](merged)).toEqual([{ case: ITEM, label: "request-changes", item: "Export a", body: "One constant.", diff: DIFF }]);
});

test("a merged item no judge was put to, or one the work source no longer gives, gives no case", async () => {
	const unjudged = openState(tempDir("cases"), { now: Date.now });
	const gone = mergedItem();

	unjudged.merges.put(ITEM, { item: ITEM, sha: "c2", at: 1, paths: ["a.ts"], baseChecked: true, commits: ["c1", "c2"] });
	await keepMergedCases(unjudged, history(2), SETTINGS, sourcesFor([]));
	await keepMergedCases(gone, history(2), SETTINGS, { ...sourcesFor([]), itemText: async () => undefined });

	expect([...unjudged.cases.list(), ...gone.cases.list()]).toEqual([]);
});
