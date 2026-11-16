import { expect, test } from "bun:test";
import { openState } from "../src/state/open.ts";
import { tallyOf } from "../src/worker/tally.ts";
import { tempDir } from "./fixtures/temp.ts";

test("an owner answer starts the token and fix-run counts afresh, and keeps their totals", () => {
	const state = openState(tempDir("tally"), { now: () => 0 });
	const tally = tallyOf(state, "a");

	tally.spend(500);
	tally.spendFix();
	tally.spendFix();
	tally.startAfresh();
	tally.spendFix();

	expect([tally.sinceAnswer(), tally.fixesSinceAnswer()]).toEqual([0, 1]);
	expect(state.spent.get("a")).toEqual({ item: "a", total: 500, base: 500, fixes: { total: 3, base: 2 } });
});
