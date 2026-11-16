import { beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createActor, createAsyncLogic } from "xstate";
import { kindMachine, openState, type State } from "../src/index.ts";
import type { RunOutcome } from "../src/adapters/claude-p.ts";
import { shippedConfig } from "../src/setup/shipped.ts";
import { answerOnce, doneByOf, foldItem, keepLanding, keepPick, machineStarted, ownerAnswered, recordMachine } from "../src/state/item-log.ts";
import { finished } from "./fixtures/answers.ts";
import { tempDir } from "./fixtures/temp.ts";

const feature = shippedConfig().kinds.feature!;
const ITEM = "#68";
const VERSION = feature.machine.version;

let dir: string;

beforeEach(() => {
	dir = tempDir("item-log");
});

/** A source that never settles, so the machine moves only on the events the test sends. */
const waits = createAsyncLogic({ run: () => new Promise<never>(() => {}) });

test("the log keeps each event the item's machine takes, under its kind's machine version, and none of the actor's own start or stop", () => {
	const state = openState(dir, { now: Date.now });
	const actor = createActor(kindMachine(feature, { plan: waits, build: waits, checks: waits, fix: waits, review: waits }), { inspect: recordMachine(state.events, { itemId: ITEM, machineVersion: VERSION }) }).start();

	for (const type of ["plan-ready", "token-cap"]) actor.send({ type });

	actor.stop();

	expect(state.events.list(ITEM).filter(({ type }) => type === "machine-stepped")).toEqual(
		["plan-ready", "token-cap"].map((type) => expect.objectContaining({ machineVersion: VERSION, payload: { event: expect.objectContaining({ type }) } })),
	);
});

const folded = (state: State) => foldItem(state.events.list(ITEM));

/** One fix run of the item that keeps its answer and ends its record, as a pass's fix run does. */
const fixRun = async (state: State) => (await answerOnce(state, { key: state.runs.keyFor(ITEM, "fix"), launch: { name: "fix" }, machineVersion: VERSION }, async () => finished({ status: "done" }))).begun.end();

test("fix runs count from the owner's last answer, over passes that start the machine over", async () => {
	const state = openState(dir, { now: Date.now });

	await fixRun(state);
	state.events.add(machineStarted({ itemId: ITEM, machineVersion: VERSION, afresh: false }));
	await fixRun(state);
	expect(folded(state).fixRuns).toBe(2);

	state.events.add(ownerAnswered(ITEM, 1));
	await fixRun(state);
	expect(folded(state).fixRuns).toBe(1);
});

const merged = (state: State) => state.events.add({ source: "work-source", sourceId: "merged:0123456", itemId: ITEM, type: "merged", payload: {} });

/** A sure pick of `event`, as a plan or review run makes one. */
const sure = (event: string) => ({ event, sure: true, reason: "It reads so.", cites: [], parts: [] });

const planPicked = (state: State, event: string) => keepPick(state.events, { itemId: ITEM, pick: { judge: "plan", pick: sure(event), models: ["m"] } });

test.each([
	["split, by its plan", "split", "needs-split", []],
	["checks", "checks", "plan-ready", ["checks"]],
	["review", "review", "plan-ready", ["review"]],
	["the owner's, once its change went back to waiting", "owner", "plan-ready", ["checks", "owner"]],
	["unknown, where landing never judged its change", undefined, "plan-ready", []],
] as const)("a merged item's log folds to how it reached done: %s", (_, doneBy, planPick, found) => {
	const state = openState(dir, { now: Date.now });

	planPicked(state, planPick);

	for (const finding of found) keepLanding(state.events, { itemId: ITEM, head: "abc", doneBy: finding });
	expect(doneByOf(folded(state))).toBeUndefined();

	merged(state);
	expect(doneByOf(folded(state))).toBe(doneBy);
});

test("how landing found the change stands through later passes until landing finds otherwise, and finding it again adds nothing", () => {
	const state = openState(dir, { now: Date.now });

	keepLanding(state.events, { itemId: ITEM, head: "abc", doneBy: "checks" });
	state.events.add(machineStarted({ itemId: ITEM, machineVersion: VERSION, afresh: true }));
	state.events.add(ownerAnswered(ITEM, 1));
	planPicked(state, "plan-ready");
	keepLanding(state.events, { itemId: ITEM, head: "abc", doneBy: "checks" });
	merged(state);

	expect(state.events.list(ITEM).filter(({ type }) => type === "landing-found")).toHaveLength(1);
	expect(doneByOf(folded(state))).toBe("checks");
});

test("the log keeps each judge's last pick", () => {
	const state = openState(dir, { now: Date.now });
	const alignment = { graded: { alignment: "sound", verification: "partial" } } as const;

	planPicked(state, "plan-ready");
	keepPick(state.events, { itemId: ITEM, pick: { judge: "review", head: "abc", pick: sure("request-changes"), models: ["m"] } });
	keepPick(state.events, { itemId: ITEM, pick: { judge: "alignment", head: "def", alignment } });
	keepPick(state.events, { itemId: ITEM, pick: { judge: "review", head: "def", pick: sure("approve"), models: ["m"] } });

	const { picks } = folded(state);

	expect([picks.plan?.pick.event, picks.review?.pick.event, picks.review?.head, picks.alignment?.alignment]).toEqual(["plan-ready", "approve", "def", alignment]);
});

test("a judge's pick that repeats its last adds nothing, and one that comes back after another pick is kept again", () => {
	const state = openState(dir, { now: Date.now });

	for (const event of ["plan-ready", "plan-ready", "plan-blocked", "plan-ready"]) planPicked(state, event);

	expect(state.events.list(ITEM).map(({ payload }) => "pick" in payload && payload.pick.event)).toEqual(["plan-ready", "plan-blocked", "plan-ready"]);
	expect(folded(state).picks.plan?.pick.event).toBe("plan-ready");
});

/** Asks the plan question once, as a run of the item would, and ends the run's record; counts each time the model is asked. */
const planAsker = (state: State, answer: () => RunOutcome) => {
	let asked = 0;

	const ask = async () => {
		const { begun } = await answerOnce(state, { key: state.runs.keyFor(ITEM, "plan"), launch: { name: "plan" }, machineVersion: VERSION, question: { prompt: "Plan the change." } }, async () => {
			asked++;

			return answer();
		});

		begun.end();
	};

	return { ask, asked: () => asked };
};

test.each([
	["a pass that starts the machine over reads it back", machineStarted({ itemId: ITEM, machineVersion: VERSION, afresh: false }), 1],
	["a pass that starts the item afresh asks again", machineStarted({ itemId: ITEM, machineVersion: VERSION, afresh: true }), 2],
	["the owner's answer makes the next run ask again", ownerAnswered(ITEM, 1), 2],
] as const)("an answer the log keeps to the same question: %s", async (_, between, times) => {
	const state = openState(dir, { now: Date.now });
	const plan = planAsker(state, () => finished({ event: "plan-ready" }));

	await plan.ask();
	state.events.add(between);
	await plan.ask();

	expect(plan.asked()).toBe(times);
});

test("a run that ends with no answer keeps nothing, so the same question is asked again", async () => {
	const state = openState(dir, { now: Date.now });
	const answers: RunOutcome[] = [{ kind: "limited", until: 1 }, finished({ event: "plan-ready" })];
	const plan = planAsker(state, () => answers.shift() ?? finished({ event: "plan-blocked" }));

	await plan.ask();
	await plan.ask();

	expect(plan.asked()).toBe(2);
	expect(state.events.list(ITEM).map(({ type }) => type)).toEqual(["model-answered"]);
});

test("a fix run that starts again under its key, as one does after a kill left its record open, keeps one answer, which the cap counts once", async () => {
	const state = openState(dir, { now: Date.now });

	for (let run = 0; run < 2; run++) await answerOnce(state, { key: state.runs.keyFor(ITEM, "fix"), launch: { name: "fix" }, machineVersion: VERSION }, async () => finished({ status: "done" }));

	expect(folded(state).fixRuns).toBe(1);
});

test("a build or fix run, which asks no question the log can answer, runs every time", async () => {
	const state = openState(dir, { now: Date.now });
	let asked = 0;

	for (let run = 0; run < 2; run++) (await answerOnce(state, { key: state.runs.keyFor(ITEM, "build"), launch: { name: "build" }, machineVersion: VERSION }, async () => (asked++, finished({ status: "done" })))).begun.end();

	expect(asked).toBe(2);
});

for (const mode of ["before-run", "after-run", "after-log", "after-end"] as const) {
	test(`a process killed ${mode} leaves the model asked once and its answer kept once`, () => {
		const script = join(import.meta.dir, "fixtures/kill-answer.ts");

		expect(spawnSync("bun", [script, dir, mode]).signal).toBe("SIGKILL");

		for (let times = 0; times < 2; times++) expect(spawnSync("bun", [script, dir, "finish"]).status).toBe(0);

		const state = openState(dir, { now: Date.now });

		expect(readFileSync(join(dir, "transcript.txt"), "utf8").split("\n").filter(Boolean)).toHaveLength(1);
		expect(state.events.list(ITEM).map(({ type }) => type)).toEqual(["model-answered"]);
		expect(state.runs.list(ITEM).every(({ endedAt }) => endedAt !== undefined)).toBe(true);
	});
}
