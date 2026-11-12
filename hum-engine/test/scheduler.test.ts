import { expect, test } from "bun:test";
import { type Candidate, footprintOf, overlaps, pick, PrefixGate } from "../src/worker/scheduler.ts";

const c = (id: string, touches?: string[], answered = false): Candidate => ({ id, footprint: touches, answered });

test("an item declares its files in a body line; no line means unknown", () => {
	expect(footprintOf({ body: "Do it.\n\nTouches: docs/a.md, src/\n" })).toEqual(["docs/a.md", "src/"]);
	expect(footprintOf({ body: "Do it." })).toBeUndefined();
});

test("two footprints clash when a path of one lies in the other; unknown clashes with everything; globs count as their folder", () => {
	expect(overlaps(["docs/a.md"], ["docs/b.md"])).toBe(false);
	expect(overlaps(["docs/a.md"], ["docs/a.md"])).toBe(true);
	expect(overlaps(["docs/"], ["docs/a.md"])).toBe(true);
	expect(overlaps(["docs/*.md"], ["docs/a.md"])).toBe(true);
	expect(overlaps(["docs/*.md"], ["src/a.ts"])).toBe(false);
	expect(overlaps(["doc*"], ["docs/a.md"])).toBe(true);
	expect(overlaps(["**/*.md"], ["src/a.ts"])).toBe(true);
	expect(overlaps(undefined, ["docs/a.md"])).toBe(true);
});

test("pick: different files start together; one file goes in order; an item behind a waiting item on its file waits too", () => {
	const base = { now: 0, limitedUntil: 0, runners: 5, running: [] };

	expect(pick({ ...base, queue: [c("a", ["x"]), c("b", ["y"])] }).start.map((i) => i.id)).toEqual(["a", "b"]);
	expect(pick({ ...base, queue: [c("a", ["x"]), c("b", ["x"]), c("c", ["y"])] }).start.map((i) => i.id)).toEqual(["a", "c"]);
	expect(pick({ ...base, running: [{ id: "r", footprint: ["x"] }], queue: [c("a", ["x"]), c("b", ["y"])] }).start.map((i) => i.id)).toEqual(["b"]);
	// d clashes with the waiting b only through b's wider footprint, and b waits on running r.
	expect(pick({ ...base, running: [{ id: "r", footprint: ["x"] }], queue: [c("b", ["x", "y"]), c("d", ["y"])] }).start).toEqual([]);
});

test("pick: the queue stays under the runner count, answered items go first, and nothing starts while limited", () => {
	const base = { now: 100, limitedUntil: 0, runners: 2, running: [{ id: "r", footprint: ["z"] }] };

	expect(pick({ ...base, queue: [c("a", ["x"]), c("b", ["y"], true)] }).start.map((i) => i.id)).toEqual(["b"]);
	expect(pick({ ...base, queue: [c("a", ["x"]), c("b", ["y"], true)] }).deferred.map((i) => i.id)).toEqual(["a"]);
	expect(pick({ ...base, limitedUntil: 101, queue: [c("a", ["x"])] }).start).toEqual([]);
	expect(pick({ ...base, limitedUntil: 100, queue: [c("a", ["x"])] }).start.map((i) => i.id)).toEqual(["a"]);
});

test("of runs sharing a prefix the first goes at once and the rest wait for its first token; a warm prefix lets all go", async () => {
	const clock = { at: 0 };
	const gate = new PrefixGate({ now: () => clock.at, ttlMs: 1000 });

	const first = await gate.enter("build");
	const rest = [gate.enter("build"), gate.enter("build")];

	expect(rest.map((lease) => Bun.peek.status(lease))).toEqual(["pending", "pending"]);

	first.opened();
	await Promise.all(rest);

	expect(Bun.peek.status(gate.enter("build"))).toBe("fulfilled");

	clock.at = 1001;
	await gate.enter("build");

	expect(Bun.peek.status(gate.enter("build"))).toBe("pending");
});

test("a first run that ends without a token hands the first place to the next, and the run after waits on it", async () => {
	const gate = new PrefixGate({ now: Date.now });
	const first = await gate.enter("fix");
	const next = gate.enter("fix");

	first.release();

	const second = await next;
	const third = gate.enter("fix");

	expect(Bun.peek.status(third)).toBe("pending");

	second.release();
	await third;
});

test("a run stopped while it waits for the first token does not start", async () => {
	const gate = new PrefixGate({ now: Date.now });

	await gate.enter("plan");

	const stop = new AbortController();
	const waiting = gate.enter("plan", stop.signal);

	stop.abort();
	await expect(waiting).rejects.toThrow("stopped while waiting");
});
