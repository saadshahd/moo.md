import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { type AdapterContext, Holder, ItemId } from "../../src/adapter-api.ts";
import { runContract } from "../../src/adapters/contract.ts";
import { railRunner, roundupProgram } from "../../src/adapters/rail-rows.ts";
import { railTree, rootWorkstream } from "../../src/adapters/rail.ts";
import { roundupAdapter } from "../../src/adapters/roundup.ts";
import { roundupRpc } from "../../src/adapters/roundup-rpc.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { RUN_AGAIN } from "../../src/decide/answer.ts";
import { openState } from "../../src/state/open.ts";
import { SECOND_MS } from "../../src/time.ts";
import { runThinPath } from "../../src/worker/thin-path.ts";
import { configWith } from "./config.ts";
import { scriptedJudge, SOUND } from "./judge.ts";
import { refusing, SLOTS_DIR } from "./rows-rig.ts";
import { TTL, workerWorld } from "./worker-world.ts";

/**
 * The rig's program for hum's items: the roundup adapter, as the Project's program, which alone may start a question
 * row, runs one scenario and writes its result where the test reads it. It then waits, since roundup starts a
 * program that exits again.
 */
const [scenario = "", rig = ""] = process.argv.slice(2);

const socket = process.env.RUPD_SOCKET ?? "";

const clock = { offset: 0 };

const now = (): number => Date.now() + clock.offset;

const ANSWER_WAIT_MS = 60_000;

const roundupOn = (state: string, context: AdapterContext, workstream = SHIPPED_DEFAULTS.roundupWorkstream) => roundupAdapter({ socket, workstream, stateDir: join(rig, state), repo: join(rig, "repo"), config: SHIPPED_DEFAULTS }, context);

const adapterOn = (state: string) => roundupOn(state, { report: () => {}, now, env: process.env });

/** Asks the question item's question as a row, and reads its thread until an answer is on it. */
const question = async (): Promise<object> => {
	const adapter = adapterOn("state-question");
	const item = (await adapter.workSource.listReady()).find(({ title }) => title === "question item");

	if (!item) return { error: "no ready Todo named question item" };

	await adapter.workSource.claim(item.id, Holder.parse("rig"), ANSWER_WAIT_MS);
	writeFileSync(join(rig, `go-ask-${item.id}`), "b");
	await adapter.questions.ask(item.id, { text: "Which title?", options: ["a", "b"] });

	const refusal = await adapter.answers.answer(item.id, { text: "through hum" }).then(
		() => undefined,
		(error: Error) => error.message,
	);

	for (const deadline = Date.now() + ANSWER_WAIT_MS; ; await Bun.sleep(200)) {
		const { thread } = await adapter.workSource.read(item.id);

		if (thread.some(({ kind }) => kind === "answer") || Date.now() > deadline) return { thread, refusal };
	}
};

/** The park scenario's own Workstream of items, so the worker sees no Todo another case left. */
const PARK_WORKSTREAM = "hum park";

/**
 * A whole worker over the roundup adapter, on the worker world's clock: the park item ends stuck, as its checks fail,
 * its park asks a row, and the owner's "Run it again" in that row runs the item again, now that its checks pass.
 */
const park = async (): Promise<object> => {
	const seeder = roundupRpc(socket);
	const home = z.looseObject({ id: z.string() }).parse(await seeder.call("rail.createWorkstream", { name: PARK_WORKSTREAM })).id;
	const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title: "park item" }));

	await seeder.call("todo.move", { id, home });

	const item = { id: String(id) };
	const flag = join(rig, "park-checks-pass");
	const w = await workerWorld({ items: { [item.id]: { writeForItem: true } } }, { checks: [`test -f ${flag}`], settings: { maxFixRuns: 1 }, source: (context) => roundupOn("state-park", context, PARK_WORKSTREAM) });

	const ticked = async (ms: number) => {
		w.clock.at += ms;
		await w.worker.tick();
		await w.worker.idle();
	};

	await ticked(0);

	const runs = [w.shim.calls().length];

	writeFileSync(flag, "");
	writeFileSync(join(rig, `go-ask-${item.id}`), RUN_AGAIN);
	await ticked(TTL + 1);

	for (const deadline = Date.now() + ANSWER_WAIT_MS; w.results.at(-1)?.outcome !== "merged" && Date.now() < deadline; await Bun.sleep(200)) await ticked(SECOND_MS);

	return { outcomes: w.results.map(({ outcome }) => outcome), asked: w.state.questions.list().map(({ options }) => options), runs: [...runs, w.shim.calls().length] };
};

/** The talk scenario's own Workstream of items. */
const TALK_WORKSTREAM = "hum talk";

/** The run slot the talk scenario's pass works in. */
const TALK_SLOT = "s1";

/**
 * One thin-path pass of a feature item over the roundup adapter with Rail rows, as hum serve runs it: its talk rows act
 * out the owner, and the pass stops once its plan row starts. The result holds the item's rows and what it kept of the talk.
 */
const talk = async (): Promise<object> => {
	const seeder = roundupRpc(socket);
	const home = z.looseObject({ id: z.string() }).parse(await seeder.call("rail.createWorkstream", { name: TALK_WORKSTREAM })).id;
	const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title: "talk item", body: "Kind: feature\n\nWrite the note." }));

	await seeder.call("todo.move", { id, home });

	const state = openState(join(rig, "state-talk"), { now });
	const program = await roundupProgram(process.env, state.faults);

	if (!program) return { error: `roundup did not take this process as its program: ${JSON.stringify(state.faults.list())}` };

	const source = roundupOn("state-talk", { report: () => {}, now, env: process.env }, TALK_WORKSTREAM);
	const item = ItemId.parse(String(id));
	const folder = join(rig, "repo", SLOTS_DIR, TALK_SLOT);
	const stop = new AbortController();

	const passed = runThinPath({
		workSource: source.workSource,
		questions: source.questions,
		state,
		runner: railRunner({ call: program.call, state, config: { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.2 }, fallback: refusing, now }),
		config: configWith(),
		judge: scriptedJudge({ kind: { kind: "feature" }, alignment: SOUND }),
		remote: join(rig, "origin.git"),
		checks: ["true"],
		holder: Holder.parse("rig"),
		checkout: async () => ({ folder, env: {}, readyFailure: async () => undefined, giveBack: async () => {} }),
		itemId: item,
		now,
		runnerVariables: new Set(),
		newSessionId: randomUUID,
		signal: stop.signal,
	}).catch((error: Error) => ({ error: error.message }));

	const rows = async () => {
		const nodes = await railTree(seeder.call);
		const own = nodes.find(({ kind, name }) => kind === "workstream" && name.startsWith(`#${id} `));

		return nodes.filter(({ parent }) => parent !== undefined && parent === own?.id);
	};

	for (const deadline = Date.now() + ANSWER_WAIT_MS; !(await rows()).some(({ name }) => name.includes(" plan-after-talk ")) && Date.now() < deadline; ) await Bun.sleep(200);

	const seen = await rows();

	stop.abort();

	return { rows: seen, talk: state.talks.get(item), outcome: await passed, faults: state.faults.list() };
};

/** Every check of the adapter contract, with items seeded in the hum Workstream. */
const contract = async (): Promise<object> => {
	const seeder = roundupRpc(socket);
	const hum = rootWorkstream(await railTree(seeder.call), SHIPPED_DEFAULTS.roundupWorkstream)?.id;

	if (!hum) return { error: "no hum Workstream" };

	const seed = async (title: string) => {
		const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title }));

		await seeder.call("todo.move", { id, home: hum });

		return ItemId.parse(String(id));
	};

	const [primary, secondary] = [adapterOn("state-contract"), adapterOn("state-contract")];
	/* The owner answers only in a question's row, so the contract's checks of an answer written through hum do not apply; the rig's wake case covers the watch. */
	const results = await runContract({ name: "roundup (rig)", adapter: { ...primary, answers: undefined }, other: async () => secondary, seed, advance: async (ms) => void (clock.offset += ms), spent: primary.spent });

	return { results };
};

const SCENARIOS = new Map(Object.entries({ question, park, contract, talk }));

const result = JSON.stringify(await (SCENARIOS.get(scenario) ?? (async () => ({ error: `no scenario ${scenario}` })))().catch((error: Error) => ({ error: error.stack ?? error.message })));

writeFileSync(join(rig, `result-${scenario}.json`), result);

setInterval(() => {}, 1 << 30);
