import { expect, test } from "bun:test";
import { mayMoveKind, passReach, takeWorkRecords } from "../src/publish/handoff.ts";
import { openState } from "../src/state/open.ts";
import { configWith } from "./fixtures/config.ts";
import { tempDir } from "./fixtures/temp.ts";

const config = configWith();
const feature = config.kinds.feature!;
const stateIn = (name: string) => openState(tempDir(name), { now: () => 0 });

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

	expect(takeWorkRecords(work, into, { item: "a", kind: feature, at: undefined, answered: false })).toBeUndefined();
	expect(into.items.saved().map(({ state }) => state)).toEqual(["checking"]);
	expect(into.runs.list("a")).toHaveLength(1);
	expect(into.landings.get("a")).toBeUndefined();
	expect(into.verdicts.get("a")).toBeUndefined();
});

test("publish refuses a machine state the owner's wait stands before, and keeps its own", () => {
	const [work, into] = [stateIn("work"), stateIn("publish")];

	into.items.save("a", feature, { status: "active", value: "owner-review", context: {} });
	work.items.save("a", feature, { status: "active", value: "merging", context: {} });

	expect(takeWorkRecords(work, into, { item: "a", kind: feature, at: "owner-review", answered: false })).toContain("no pass takes a from owner-review to merging");
	expect(into.items.saved().map(({ state }) => state)).toEqual(["owner-review"]);
});

test("a work job may move an item only to a kind whose risk floor is no lower", () => {
	const floored = configWith((raw) => void (raw.hum.kindFloors = { check: "high" }));

	expect(mayMoveKind(floored, { from: "docs", to: "check" })).toBe(true);
	expect(mayMoveKind(floored, { from: "check", to: "docs" })).toBe(false);
});
