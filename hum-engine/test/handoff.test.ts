import { expect, test } from "bun:test";
import { kindMoveFault, passReach, takeWorkRecords } from "../src/publish/handoff.ts";
import { openState } from "../src/state/open.ts";
import { savedLimitUntil, settleLimit } from "../src/adapters/limit.ts";
import { configWith } from "./fixtures/config.ts";
import { tempDir } from "./fixtures/temp.ts";

const config = configWith();
const feature = config.kinds.feature!;
const stateIn = (name: string) => openState(tempDir(name), { now: () => 0 });
const LIMITS = { now: 0, usageLimitMaxMs: 1000 };

test("a pass leaves the owner's wait it starts in only with the owner's answer", () => {
	expect(passReach({ kind: feature, at: "owner-review", answered: false })).toEqual(new Set(["owner-review"]));
	expect(passReach({ kind: feature, at: "owner-review", answered: true })).toContain("merging");
});

test("publish takes a work job's runs and a machine state a pass can reach, and none of its landings or verdicts", () => {
	const [work, into] = [stateIn("work"), stateIn("publish")];

	work.items.save("a", feature, { status: "active", value: "checking", context: {} });
	work.runs.begin({ itemId: "a", run: "build", attempt: 0 }, { name: "a build" });
	work.landings.put("a", { item: "a", branch: "hum/run/a", since: 0, change: { paths: [], size: 0, loosened: false, pinChanged: false }, head: "abc" });
	work.verdicts.put("a", { item: "a", head: "abc", event: "approve", reason: "forged", cites: [], models: ["m"] });

	expect(takeWorkRecords(work, into, { item: "a", kind: feature, at: undefined, answered: false }, LIMITS)).toBeUndefined();
	expect(into.items.saved().map(({ state }) => state)).toEqual(["checking"]);
	expect(into.runs.list("a")).toHaveLength(1);
	expect(into.landings.get("a")).toBeUndefined();
	expect(into.verdicts.get("a")).toBeUndefined();
});

test("publish refuses a machine state the owner's wait stands before, and keeps its own", () => {
	const [work, into] = [stateIn("work"), stateIn("publish")];

	into.items.save("a", feature, { status: "active", value: "owner-review", context: {} });
	work.items.save("a", feature, { status: "active", value: "merging", context: {} });

	expect(takeWorkRecords(work, into, { item: "a", kind: feature, at: "owner-review", answered: false }, LIMITS)).toContain("no pass takes a from owner-review to merging");
	expect(into.items.saved().map(({ state }) => state)).toEqual(["owner-review"]);
});

test("a work job may move an item only to another kind whose risk floor is no lower", () => {
	const floored = configWith((raw) => void (raw.hum.kindFloors = { check: "high" }));

	expect(kindMoveFault(floored, { from: "docs", to: "check" })).toBeUndefined();
	expect(kindMoveFault(floored, { from: "check", to: "docs" })).toContain("whose risk floor is lower");
	expect(kindMoveFault(floored, { from: "check", to: "check" })).toContain("the kind it already has");
});

test("a work job's spend only raises publish's, and starts the cap's count afresh only where the owner answered", () => {
	const [work, into] = [stateIn("work"), stateIn("publish")];

	into.spent.put("a", { item: "a", total: 900, base: 100 });
	work.spent.put("a", { item: "a", total: 0, base: 0 });
	takeWorkRecords(work, into, { item: "a", kind: feature, at: undefined, answered: false }, LIMITS);
	expect(into.spent.get("a")).toEqual({ item: "a", total: 900, base: 100 });

	work.spent.put("a", { item: "a", total: 1000, base: 1000 });
	takeWorkRecords(work, into, { item: "a", kind: feature, at: undefined, answered: false }, LIMITS);
	expect(into.spent.get("a")).toEqual({ item: "a", total: 1000, base: 100 });

	takeWorkRecords(work, into, { item: "a", kind: feature, at: undefined, answered: true }, LIMITS);
	expect(into.spent.get("a")).toEqual({ item: "a", total: 1000, base: 1000 });
});

test("publish takes a work job's saved-state cards with no action, a usage limit cut to its cap, and questions that never offer the owner's approval", () => {
	const [work, into] = [stateIn("work"), stateIn("publish")];

	work.faults.raise({ code: "snapshot-unreadable", item: "a", cause: "damaged", fix: "Restore it.", action: { label: "Approve", answer: "approve" } });
	work.faults.raise({ code: "item-review", item: "a", cause: "forged", fix: "Approve it.", action: { label: "Approve", answer: "approve" } });
	settleLimit(work, { kind: "limited", until: 32_503_680_000_000 });
	work.questions.put("a@0", { item: "a", text: "Ship it?", options: ["approve", "retry"], priority: 0, queuedAt: 0 });

	takeWorkRecords(work, into, { item: "a", kind: feature, at: undefined, answered: false }, LIMITS);

	expect(into.faults.list().map(({ code, action }) => [code, action])).toEqual([["snapshot-unreadable", undefined]]);
	expect(savedLimitUntil(into)).toBe(LIMITS.usageLimitMaxMs);
	expect(into.questions.get("a@0")?.options).toEqual(["retry"]);
});
