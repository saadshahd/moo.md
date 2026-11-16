import { beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AnyActor, createActor, createAsyncLogic, waitFor } from "xstate";
import { kindMachine, openState, persistedSnapshot, type State } from "../src/index.ts";
import type { RunOutcome } from "../src/adapters/claude-p.ts";
import { shippedConfig } from "../src/setup/shipped.ts";
import { answerOnce, doneByOf, foldItem, keepLanding, machineStarted, ownerAnswered, picked, recordMachine } from "../src/state/item-log.ts";
import { finished } from "./fixtures/answers.ts";
import { tempDir } from "./fixtures/temp.ts";

const feature = shippedConfig().kinds.feature!;
const ITEM = "#68";
const VERSION = feature.machine.version;

let dir: string;

beforeEach(() => {
	dir = tempDir("item-log");
});

/** What each source of the feature machine does on its next call, in order; a source with nothing left stops the pass there, as a limit or a lost claim does. */
type Script = { plan?: string[]; build?: string[]; checks?: string[]; fix?: string[]; review?: string[] };

/** Where a pass ends on its own: an owner wait, the merge, or stuck. */
const RESTS: ReadonlySet<string> = new Set(["asking", "owner-review", "merging", "stuck"]);

/**
 * One pass of the item in this process, as the thin path drives it: a pass that carries the owner's answer restores
 * the saved wait and sends it, any other starts the machine over. Its snapshot is saved where the pass ends.
 */
const pass = async (state: State, script: Script, answer?: string): Promise<void> => {
	let actor: AnyActor;
	const stopped = Promise.withResolvers<void>();
	const forever = new Promise<never>(() => {});
	const next = (source: keyof Script): string | undefined => script[source]?.shift();

	const picks = (source: "plan" | "review") =>
		createAsyncLogic({
			run: () => {
				const event = next(source);

				if (event === undefined) stopped.resolve();
				else queueMicrotask(() => actor.send({ type: event }));

				return forever;
			},
		});

	const acts = (source: "build" | "checks" | "fix") =>
		createAsyncLogic({
			run: async () => {
				const step = next(source);

				if (step === undefined) return stopped.resolve(), forever;

				if (step === "token-cap") return queueMicrotask(() => actor.send({ type: step })), forever;

				if (step === "fail") throw new Error("the checks fail");

				if (source === "fix") (await answerOnce(state, { key: state.runs.keyFor(ITEM, source), launch: { name: source }, machineVersion: VERSION }, async () => finished({ status: "done" }))).begun.end();
			},
		});

	const sources = { plan: picks("plan"), build: acts("build"), checks: acts("checks"), fix: acts("fix"), review: picks("review") };
	const inspect = recordMachine(state.events, { itemId: ITEM, machineVersion: VERSION });

	if (answer === undefined) {
		state.events.add(machineStarted({ itemId: ITEM, machineVersion: VERSION, afresh: false }));
		actor = createActor(kindMachine(feature, sources), { inspect }).start();
	} else {
		const restored = await state.items.restore(ITEM, feature, { sources, inspect });

		if (!restored.ok || !restored.value) throw new Error(`no saved wait to answer for ${ITEM}`);

		actor = restored.value.start();
		state.events.add(ownerAnswered(ITEM, Date.now()));
		actor.send({ type: answer });
	}

	await Promise.race([waitFor(actor, (snapshot) => RESTS.has(String(snapshot.value))), stopped.promise]);
	expect(state.items.save(ITEM, feature, persistedSnapshot(actor)).ok).toBe(true);
	actor.stop();
};

const folded = (state: State) => foldItem(state.events.list(ITEM));

/** Where the item's saved snapshot stands, and the fix runs its log counts. */
const progress = (state: State) => ({ at: state.items.saved().find(({ itemId }) => itemId === ITEM)?.state, fixRuns: folded(state).fixRuns });

test("the log keeps each event the item's machine takes, under its kind's machine version, and none of the actor's own start or stop", async () => {
	const state = openState(dir, { now: Date.now });

	await pass(state, { plan: ["plan-ready"], build: ["token-cap"] });

	expect(state.events.list(ITEM).filter(({ type }) => type === "machine-stepped")).toEqual(
		["plan-ready", "token-cap"].map((type) => expect.objectContaining({ machineVersion: VERSION, payload: { event: expect.objectContaining({ type }) } })),
	);
});

test("fix runs count from the owner's last answer, over passes that start the machine over and a pass that resumes a wait", async () => {
	const state = openState(dir, { now: Date.now });

	await pass(state, { plan: ["plan-ready"], build: ["done"], checks: ["fail", "fail"], fix: ["done"] });
	expect(progress(state)).toEqual({ at: "fixing", fixRuns: 1 });

	await pass(state, { plan: ["plan-ready"], build: ["done"], checks: ["fail", "fail"], fix: ["done"] });
	expect(progress(state)).toEqual({ at: "fixing", fixRuns: 2 });

	await pass(state, { plan: ["plan-ready"], build: ["done"], checks: ["fail"], fix: ["token-cap"] });
	expect(progress(state)).toEqual({ at: "asking", fixRuns: 2 });

	await pass(state, { build: ["done"], checks: ["fail", "fail"], fix: ["done"] }, "answered");
	expect(progress(state)).toEqual({ at: "fixing", fixRuns: 1 });
});

const merged = (state: State) => state.events.add({ source: "work-source", sourceId: "merged:0123456", itemId: ITEM, type: "merged", payload: {} });

/** A sure pick of `event`, as a plan or review run makes one. */
const sure = (event: string) => ({ event, sure: true, reason: "It reads so.", cites: [], parts: [] });

const planPicked = (state: State, event: string) => state.events.add(picked(ITEM, { judge: "plan", pick: sure(event), models: ["m"] }));

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
	state.events.add(picked(ITEM, { judge: "review", head: "abc", pick: sure("request-changes"), models: ["m"] }));
	state.events.add(picked(ITEM, { judge: "alignment", head: "def", alignment }));
	state.events.add(picked(ITEM, { judge: "review", head: "def", pick: sure("approve"), models: ["m"] }));

	const { picks } = folded(state);

	expect([picks.plan?.pick.event, picks.review?.pick.event, picks.review?.head, picks.alignment?.alignment]).toEqual(["plan-ready", "approve", "def", alignment]);
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
