import { expect, test } from "bun:test";
import shippedFix from "../defaults/kinds/fix.json" with { type: "json" };
import { KindFile } from "../src/config/kind-file.ts";
import { withOverCapWaits } from "../src/config/machine.ts";
import { flowOf } from "../src/status/flow.ts";
import type { Tree } from "./fixtures/config.ts";
import { newestChoices, openQuestions } from "../src/status/sections.ts";
import type { QueuedQuestion, SettledAnswer } from "../src/state/saved.ts";

const asked = (item: string, askedAt?: number, options?: string[]): QueuedQuestion => ({ item, text: `Which for ${item}?`, options, priority: 0, queuedAt: 1, askedAt });
const answer = (item: string, at: number, disposition: SettledAnswer["disposition"]): SettledAnswer => ({ item, ordinal: 1, text: "yes", source: "free", disposition, why: "ok", at });

test("a question is open from the time it is asked until an answer or a request to its item is applied", () => {
	const queued = [asked("a", 30), asked("b", 10, ["keep", "drop"]), asked("c", 20), asked("d"), asked("e", 50), asked("f", 30)];
	const answers = [answer("a", 40, "applied"), answer("c", 25, "held"), answer("e", 40, "applied")];
	const requests = [{ item: "f", ordinal: 1, kind: "skip", step: "asking", disposition: "applied", why: "ok", at: 35 } as const];

	expect(openQuestions(queued, [...answers, ...requests])).toEqual([
		{ item: "b", text: "Which for b?", options: ["keep", "drop"], since: 10 },
		{ item: "c", text: "Which for c?", options: [], since: 20 },
		{ item: "e", text: "Which for e?", options: [], since: 50 },
	]);
});

test("the newest choices come first and no more than the shown count", () => {
	const choices = [1, 3, 2].map((at) => ({ item: "a", text: `t${at}`, at }));

	expect(newestChoices(choices, 2).map(({ at }) => at)).toEqual([3, 2]);
});

const fixWith = (edit: (states: Tree) => void) => {
	const raw: Tree = structuredClone(shippedFix);

	edit(raw.machine.states);

	return withOverCapWaits(KindFile.parse(raw));
};

const FIX_STEPS = ["reproducing", "confirming", "objecting", "building", "checking", "proving", "fixing", "reviewing", "owner-review", "merging", "stuck", "done"];

test("at a wait, the flow names every step it shows, which of them wait on the owner and which the item passed, and the options, answer, skip and notes the wait allows", () => {
	const flow = flowOf(fixWith((states) => (states["owner-review"].meta.skip = { target: "merging" })));

	expect(flow("owner-review", ["reproducing", "confirming", "building", "asking", "checking", "owner-review", "reviewing"])).toEqual({
		steps: FIX_STEPS.map((name) => ({ name, waitsOnOwner: name === "objecting" || name === "owner-review" })),
		at: "owner-review",
		passed: ["reproducing", "confirming", "building", "checking", "reviewing"],
		controls: {
			choices: [{ label: "Approve", event: "owner-approved" }],
			answer: true,
			skip: true,
			runNow: false,
			noteTo: ["building", "checking", "proving", "fixing", "reviewing", "owner-review", "merging", "stuck"],
		},
	});
});

test("a step allows a skip and a timer run now only where it waits on the owner, which a pass restores, and a run now only where its earliest timer leads on to work, not to a stuck step", () => {
	const flow = flowOf(fixWith((states) => (states.building.meta = { skip: { target: "checking" } })));
	const toStuck = flowOf(fixWith((states) => (states.objecting.after = { "3600000": { target: "stuck" }, "86400000": { target: "building" } })));

	expect(flow("building", [])?.controls).toMatchObject({ skip: false, runNow: false });
	expect(flow("objecting", [])?.controls).toMatchObject({ skip: false, runNow: true });
	expect(toStuck("objecting", [])?.controls).toMatchObject({ runNow: false });
});

test("a wait a run stops at past its token cap is a step only while the item is in it, and a final step has no flow", () => {
	const flow = flowOf(fixWith(() => {}));

	expect(flow("asking-reviewing", undefined)?.steps.map(({ name }) => name)).toEqual([...FIX_STEPS, "asking-reviewing"]);
	expect(flow("reviewing", undefined)?.steps.map(({ name }) => name)).toEqual(FIX_STEPS);
	expect(flow("done", [])).toBeUndefined();
});
