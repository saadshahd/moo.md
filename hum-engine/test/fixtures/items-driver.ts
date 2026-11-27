import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { type AdapterContext, Holder, ItemId } from "../../src/adapter-api.ts";
import { runContract } from "../../src/adapters/contract.ts";
import { railRunner, roundupProgram } from "../../src/adapters/rail-rows.ts";
import { feedName, isItemWorkstream, railName, railTree, rootWorkstream } from "../../src/adapters/rail.ts";
import { roundupAdapter } from "../../src/adapters/roundup.ts";
import { roundupRpc } from "../../src/adapters/roundup-rpc.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { RUN_AGAIN } from "../../src/decide/answer.ts";
import { slug } from "../../src/state/fs.ts";
import { openState } from "../../src/state/open.ts";
import { SECOND_MS } from "../../src/time.ts";
import { SlotPool } from "../../src/slots/pool.ts";
import { runThinPath, type TalkCopy } from "../../src/worker/thin-path.ts";
import { configWith } from "./config.ts";
import { scriptedJudge, SOUND } from "./judge.ts";
import { OWN_WORDS, PREPARE_STEP, refusing, SLOTS_DIR, woken } from "./rows-rig.ts";
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

/**
 * Asks a new question item's question as a row, with hum's state in `state`, the owner answering `owner` in it, reads
 * its thread until an answer is on it, and finishes the item. Where the owner stops the first row once it asked them,
 * that row gets no answer.
 */
const questionIn =
	(state: string, owner: string, { stopsFirst = false }: { readonly stopsFirst?: boolean } = {}) =>
	async (): Promise<object> => {
		const adapter = adapterOn(state);
		const item = (await adapter.workSource.listReady()).findLast(({ title }) => title === "question item");

		if (!item) return { error: "no ready Todo named question item" };

		const first = `hum ${item.id} ask 1`;

		await adapter.workSource.claim(item.id, Holder.parse("rig"), ANSWER_WAIT_MS);
		writeFileSync(join(rig, `go-ask-${item.id}`), owner);

		if (stopsFirst) writeFileSync(join(rig, `unanswered-${first.replaceAll(" ", "-")}`), "");

		await adapter.questions.ask(item.id, { text: "Which title?", options: ["a", "b"] });

		const refusal = await adapter.answers.answer(item.id, { text: "through hum" }).then(
			() => undefined,
			(error: Error) => error.message,
		);

		if (stopsFirst) await stopOnceAsked(state, first);

		for (const deadline = Date.now() + ANSWER_WAIT_MS; ; await Bun.sleep(200)) {
			const { thread } = await adapter.workSource.read(item.id);

			if (thread.some(({ kind }) => kind === "answer") || Date.now() > deadline) {
				/* Finished, the item is ready to no later scenario's worker. */
				await adapter.workSource.finish(item.id);

				return { thread, refusal };
			}
		}
	};

/** Stops the question row named `name` as the owner would, once hum marked it waiting on them. */
const stopOnceAsked = async (state: string, name: string): Promise<void> => {
	const asked = join(rig, state, "roundup", "questions", slug(name), "asked.json");

	for (const deadline = Date.now() + ANSWER_WAIT_MS; !existsSync(asked) && Date.now() < deadline; ) await Bun.sleep(100);

	const row = (await railTree(roundupRpc(socket).call)).find((node) => node.name === railName(name));

	if (row) await roundupRpc(socket).call("agent.stop", { id: row.id });
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

/** The handoff scenario's own Workstream of items. */
const HANDOFF_WORKSTREAM = "hum handoff";

const PadRead = z.looseObject({ text: z.string(), home: z.string().nullish(), visibility: z.string() });

/**
 * A whole worker over the roundup adapter at a level a review run clears: the review asks for a change to a file the
 * branch never touches, so the change parks for the owner's review, and its question row names the shown handoff Pad.
 * The owner stops that first row once it asked them, and the row hum asks again names the Pad too; their approve there
 * lands the change, and the Pad then says what merged, in the scenario's Workstream.
 */
const handoff = async (): Promise<object> => {
	const seeder = roundupRpc(socket);
	const home = z.looseObject({ id: z.string() }).parse(await seeder.call("rail.createWorkstream", { name: HANDOFF_WORKSTREAM })).id;
	const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title: "handoff item" }));

	await seeder.call("todo.move", { id, home });

	const item = String(id);
	const readme = { event: "request-changes", sure: true, reason: "README.md does not name the new note.", cites: [{ file: `docs/${item}.md`, line: 1 }], plan: { summary: "Name the new note in README.md.", steps: ["Add a line."], paths: ["README.md"] } };
	const w = await workerWorld({ items: { [item]: { writeForItem: true } }, decisions: [readme] }, { settings: { paths: [{ glob: "docs/**", level: "medium" }] }, source: (context) => roundupOn("state-handoff", context, HANDOFF_WORKSTREAM) });
	const padOf = async (name: string) => seeder.call("pad.read", { name }).then((pad) => PadRead.parse(pad), () => undefined);

	const ticked = async (ms: number) => {
		w.clock.at += ms;
		await w.worker.tick();
		await w.worker.idle();
	};

	const tickUntil = async <T>(found: () => Promise<T | undefined>): Promise<T | undefined> => {
		for (const deadline = Date.now() + ANSWER_WAIT_MS; Date.now() < deadline; await ticked(SECOND_MS)) {
			const value = await found();

			if (value !== undefined) return value;
		}

		return undefined;
	};

	const pad = `#${item} handoff`;

	writeFileSync(join(rig, `go-ask-${item}`), "approve");
	writeFileSync(join(rig, `unanswered-hum-${item}-ask-1`), "");

	const atReview = await tickUntil(() => padOf(pad));
	const brief = await tickUntil(() => padOf(`hum ${item} ask 1 brief`));
	const itemHome = (await railTree(seeder.call)).find((node) => node.kind === "workstream" && node.name.startsWith(`#${item} `))?.id;

	await stopOnceAsked("state-handoff", `hum ${item} ask 1`);

	const reBrief = await tickUntil(() => padOf(`hum ${item} ask 2 brief`));

	await tickUntil(async () => (w.results.at(-1)?.outcome === "merged" ? true : undefined));

	return {
		outcomes: w.results.map(({ outcome }) => outcome),
		handoff: { item, home, itemHome, atReview, brief: brief?.text, reBrief: reBrief?.text, atLand: await padOf(pad), comments: z.array(z.looseObject({ body: z.string() })).parse(await seeder.call("todo.comments", { id })).map(({ body }) => body) },
	};
};

/**
 * A Workstream of feature items, and thin-path passes over the roundup adapter with Rail rows, as hum serve runs
 * them, in a run slot of the scenario's own, their talk rows in talk copies the slot pool gives; their talk rows act
 * out the owner. A pass that ends waiting on the owner runs again once the talk watch wakes the item.
 */
const talkWorld = async (workstream: string, slot: string) => {
	const seeder = roundupRpc(socket);
	const home = z.looseObject({ id: z.string() }).parse(await seeder.call("rail.createWorkstream", { name: workstream })).id;
	const dir = `state-${workstream.replaceAll(" ", "-")}`;
	const state = openState(join(rig, dir), { now });
	const program = await roundupProgram(process.env, state.faults);

	if (!program) throw new Error(`roundup did not take this process as its program: ${JSON.stringify(state.faults.list())}`);

	const source = roundupOn(dir, { report: () => {}, now, env: process.env }, workstream);
	const folder = join(rig, "repo", SLOTS_DIR, slot);
	const runner = railRunner({ call: program.call, repo: join(rig, "repo"), state, config: { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.2 }, fallback: refusing, now });
	const runSlots = { ...SHIPPED_DEFAULTS.runSlots, enabled: true, recipe: { ...SHIPPED_DEFAULTS.runSlots.recipe, prepare: [PREPARE_STEP] } };
	const pool = new SlotPool({ repo: join(rig, "repo"), state, config: { ...SHIPPED_DEFAULTS, runSlots }, base: "main", talking: runner.talking, now });
	const prepareMs: number[] = [];

	/** The pool's talk copy, timing each ask that runs the recipe's prepare first. */
	const talkCopy: TalkCopy = async (request) => {
		const at = Date.now();
		const copy = await pool.talkCopy(request);

		if (request.prepared) prepareMs.push(Date.now() - at);

		return copy;
	};

	const seed = async (title: string, body: string): Promise<ItemId> => {
		const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title, body }));

		await seeder.call("todo.move", { id, home });

		return ItemId.parse(String(id));
	};

	const passOf = (item: ItemId, signal: AbortSignal) =>
		runThinPath({
			workSource: source.workSource,
			questions: source.questions,
			state,
			runner,
			config: configWith(),
			judge: scriptedJudge({ kind: { kind: "feature" }, alignment: SOUND }),
			remote: join(rig, "origin.git"),
			checks: ["true"],
			holder: Holder.parse("rig"),
			checkout: async () => ({ folder, env: {}, readyFailure: async () => undefined, giveBack: async () => {} }),
			talkCopy,
			itemId: item,
			now,
			runnerVariables: new Set(),
			newSessionId: randomUUID,
			signal,
		}).catch((error: Error) => ({ error: error.message }));

	/** The item's passes until one ends other than waiting on the owner, each after the talk watch woke the item. */
	const passesOf = async (item: ItemId, signal: AbortSignal) => {
		const outcomes: string[] = [];

		for (;;) {
			const passed = await passOf(item, signal);

			outcomes.push("outcome" in passed ? passed.outcome : "error");

			if (!("outcome" in passed) || passed.outcome !== "waiting" || signal.aborted) return { ...passed, outcomes };

			await woken(state.inbox, signal);
		}
	};

	const rowsOf = async (item: ItemId) => {
		const nodes = await railTree(seeder.call);
		const own = nodes.find(({ kind, name }) => kind === "workstream" && name.startsWith(`#${item} `));

		return nodes.filter(({ parent, name }) => parent !== undefined && parent === own?.id && name !== feedName(item));
	};

	/** The item's rows once its plan row started: the passes stop there, as the plan row waits. */
	const rowsToPlan = async (item: ItemId) => {
		const stop = new AbortController();
		const passed = passesOf(item, stop.signal);

		for (const deadline = Date.now() + ANSWER_WAIT_MS; !(await rowsOf(item)).some(({ name }) => name.includes(" plan-after-talk ")) && Date.now() < deadline; ) await Bun.sleep(200);

		const rows = await rowsOf(item);

		stop.abort();

		return { rows, talk: state.talks.get(item), passes: await passed, prepareMs, faults: state.faults.list() };
	};

	return { seed, passesOf, rowsToPlan, source };
};

/** A feature item's talk rows, then its plan row, in the Workstream and slot of the scenario's own. */
const talkIn = (workstream: string, slot: string) => async (): Promise<object> => {
	const world = await talkWorld(workstream, slot);

	return world.rowsToPlan(await world.seed("talk item", "Kind: feature\n\nWrite the note."));
};

/** A feature item whose plan row splits it after the talk, then its first part's rows once its plan row started. */
const split = async (): Promise<object> => {
	const world = await talkWorld("hum split", "s2");
	const item = await world.seed("split item", "Kind: feature\n\nWrite the note in two parts.");

	writeFileSync(join(rig, `go-split-${item}`), "");

	const parent = await world.passesOf(item, new AbortController().signal);
	const part = (await world.source.workSource.listReady()).find(({ title }) => title.endsWith("Write part one"));

	if (!part) return { error: `the split filed no ready part: ${JSON.stringify(parent)}` };

	return { parent, ...(await world.rowsToPlan(part.id)) };
};

/**
 * Claims and renews an item as the Project's program, which starts its feed row once, reads that row once its claude
 * started, with the argv roundup started it with, then finishes the item and reads what of it is left on the Rail.
 */
const feed = async (): Promise<object> => {
	const seeder = roundupRpc(socket);
	const hum = rootWorkstream(await railTree(seeder.call), SHIPPED_DEFAULTS.roundupWorkstream)?.id;

	if (!hum) return { error: "no hum Workstream" };

	const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title: "feed item" }));

	await seeder.call("todo.move", { id, home: hum });

	const item = ItemId.parse(String(id));
	const adapter = adapterOn("state-feed");
	const argv = join(rig, "argv-feed.txt");

	await adapter.workSource.claim(item, Holder.parse("rig"), ANSWER_WAIT_MS);
	await adapter.workSource.renew(item, Holder.parse("rig"), ANSWER_WAIT_MS);

	for (const deadline = Date.now() + ANSWER_WAIT_MS; !existsSync(argv) && Date.now() < deadline; ) await Bun.sleep(100);

	await Bun.sleep(3000);

	const rows = (await railTree(seeder.call)).filter(({ name }) => name === feedName(item));

	await adapter.workSource.finish(item);

	const left = (await railTree(seeder.call)).filter((node) => isItemWorkstream(item, node) || node.name === feedName(item));

	return { feed: { rows, argv: existsSync(argv) ? readFileSync(argv, "utf8").split("\n") : [], left } };
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

const SCENARIOS = new Map(Object.entries({ question: questionIn("state-question", "b"), "question-words": questionIn("state-question-words", OWN_WORDS), "question-stopped": questionIn("state-question-stopped", "b", { stopsFirst: true }), "question-worktrees": questionIn("state-question-worktrees", "b"), park, handoff, contract, talk: talkIn("hum talk", "s1"), "talk-worktrees": talkIn("hum talk worktrees", "s3"), split, feed }));

const result = JSON.stringify(await (SCENARIOS.get(scenario) ?? (async () => ({ error: `no scenario ${scenario}` })))().catch((error: Error) => ({ error: error.stack ?? error.message })));

writeFileSync(join(rig, `result-${scenario}.json`), result);

setInterval(() => {}, 1 << 30);
