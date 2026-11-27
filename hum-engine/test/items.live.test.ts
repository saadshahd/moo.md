import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Holder, ItemId } from "../src/adapter-api.ts";
import { itemWorkstreamName } from "../src/adapters/rail.ts";
import { roundupAdapter } from "../src/adapters/roundup.ts";
import { HUM_EXT } from "../src/adapters/roundup-rpc.ts";
import { Json } from "../src/config/json.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { RUN_AGAIN } from "../src/decide/answer.ts";
import { INBOX_DIR } from "../src/state/open.ts";
import { ITEMS_DRIVER, OWN_WORDS, PREPARE_STEP, ROUNDUP_APP, type Rig, SLOTS_DIR, startRig } from "./fixtures/rows-rig.ts";

const live = process.env.HUM_LIVE === "1" && existsSync(ROUNDUP_APP);

if (!live) console.log("skip hum's items on roundup: set HUM_LIVE=1 on a Mac with roundup.app installed; the rig starts a throwaway roundup Daemon on a fresh data folder with a stub claude, and makes no model call");

const RIG_MS = 120_000;

const WAKE_MS = 5000;

const Todo = z.looseObject({ id: z.int(), done: z.boolean(), home: z.string().nullish() });

const Node = z.looseObject({ id: z.string(), name: z.string(), kind: z.string(), parent: z.string().nullish() });

const Entry = z.looseObject({ kind: z.string(), text: z.string(), option: z.string().optional() });

const Result = z.looseObject({
	error: z.string().optional(),
	refusal: z.string().optional(),
	thread: z.array(Entry).optional(),
	results: z.array(z.looseObject({ name: z.string(), failure: z.string().optional() })).optional(),
	outcomes: z.array(z.string()).optional(),
	asked: z.array(z.array(z.string()).optional()).optional(),
	runs: z.array(z.int()).optional(),
	rows: z.array(Node.extend({ visibility: z.string().optional(), worktree: z.looseObject({ path: z.string(), adopted: z.boolean() }).nullish() }).loose()).optional(),
	parent: z.looseObject({ outcome: z.string().optional() }).optional(),
	talk: z.looseObject({}).optional(),
	passes: z.looseObject({ outcomes: z.array(z.string()) }).optional(),
	prepareMs: z.array(z.number()).optional(),
});

const HOLDER = Holder.parse("rig");

let rig: Rig;
let hum: string;
let adapter: ReturnType<typeof roundupAdapter>;

beforeAll(async () => {
	if (!live) return;

	rig = await startRig(ITEMS_DRIVER);
	hum = Node.parse(await rig.user.call("rail.createWorkstream", { name: SHIPPED_DEFAULTS.roundupWorkstream })).id;
	adapter = roundupAdapter({ socket: join(rig.dir, "rupd.sock"), workstream: SHIPPED_DEFAULTS.roundupWorkstream, stateDir: join(rig.dir, "state-items"), repo: join(rig.dir, "repo"), config: SHIPPED_DEFAULTS }, { report: () => {}, now: Date.now, env: {} });
}, RIG_MS);

afterAll(async () => {
	if (!live) return;

	await adapter.close();
	await rig.stop();
}, RIG_MS);

/** A Todo the owner makes, in `home` when one is named. */
const todoIn = async (title: string, home?: string): Promise<ItemId> => {
	const made = Todo.parse(await rig.user.call("todo.create", { title }));

	if (home) await rig.user.call("todo.move", { id: made.id, home });

	return ItemId.parse(String(made.id));
};

const todoOf = async (id: string) => Todo.parse(await rig.user.call("todo.get", { id: Number(id) }));

const workstreams = async () => z.array(Node).parse(await rig.user.call("rail.tree")).filter(({ kind }) => kind === "workstream");

const listed = async (): Promise<string[]> => (await adapter.workSource.listReady()).map(({ id }) => id);

/** Runs `scenario` as the Project's program and returns the result it wrote. */
const run = async (scenario: string) => {
	await rig.runProgram(scenario);

	const result = Result.parse(await rig.resultOf(scenario, RIG_MS));

	await rig.stopProgram();
	expect(result.error).toBeUndefined();

	return result;
};

let claimed: ItemId;

test.skipIf(!live)("a Todo in the hum Workstream is claimed into a Workstream of its own, #<id> <title>", async () => {
	claimed = await todoIn("claimed item", hum);

	expect(await listed()).toContain(claimed);
	expect((await adapter.workSource.claim(claimed, HOLDER, RIG_MS)).won).toBe(true);

	const own = (await workstreams()).find(({ name, parent }) => !parent && name === itemWorkstreamName({ id: claimed, title: "claimed item" }));

	expect((await todoOf(claimed)).home).toBe(own?.id ?? "no such Workstream");
	expect(await listed()).not.toContain(claimed);
}, RIG_MS);

test.skipIf(!live)("a Todo in an item's Workstream, where a run's Todos land, is never claimed", async () => {
	const made = await todoIn("made by a run", (await todoOf(claimed)).home ?? undefined);

	expect(await listed()).not.toContain(made);
	expect(adapter.workSource.claim(made, HOLDER, RIG_MS)).rejects.toThrow("not ready to claim");
}, RIG_MS);

test.skipIf(!live)("a new Todo in the hum Workstream wakes hum through roundup's events", async () => {
	const { token } = await adapter.answers.watch();
	const inbox = join(rig.dir, "state-items", INBOX_DIR);

	await todoIn("wakes hum", hum);

	for (const deadline = Date.now() + WAKE_MS; !(existsSync(inbox) && readdirSync(inbox).length > 0) && Date.now() < deadline; ) await Bun.sleep(50);

	expect(existsSync(inbox) && readdirSync(inbox).length).toBeGreaterThan(0);
	expect((await adapter.answers.watch(token)).changed).toBe(true);
}, RIG_MS);

test.skipIf(!live)("a landed item's Todo is completed and back in the hum Workstream, and its own Workstream is gone", async () => {
	await adapter.workSource.finish(claimed);

	expect(await todoOf(claimed)).toMatchObject({ done: true, home: hum });
	expect((await workstreams()).some(({ name }) => name.startsWith(`#${claimed} `))).toBe(false);
}, RIG_MS);

/** Runs `check` with the Project's Worktrees on, and puts the setting back after. */
const withWorktreesOn = async (check: () => Promise<void>): Promise<void> => {
	const { worktrees } = z.looseObject({ worktrees: z.record(z.string(), Json) }).parse(await rig.user.call("project.get"));

	await rig.user.call("project.setWorktrees", { on: true, check: "true" });

	try {
		await check();
	} finally {
		await rig.user.call("project.setWorktrees", worktrees);
	}
};

/**
 * Runs a question scenario on a new question item: its answer is what the owner picked or typed in the row's
 * AskUserQuestion, counted only once roundup showed the row waiting on them, and one through hum is refused.
 */
const expectQuestion = async (scenario: string, answer: { readonly text: string; readonly option: string | undefined }): Promise<void> => {
	await todoIn("question item", hum);

	const { thread = [], refusal } = await run(scenario);

	expect(thread.filter(({ kind }) => kind === "answer").map(({ text, option }) => ({ text, option }))).toEqual([answer]);
	expect(refusal).toMatch(/roundup:\/\/agent\/\d+\?project=/u);
};

test.skipIf(!live)("a question row takes the option the owner picked in its AskUserQuestion only once roundup showed the row waiting on them, and an answer through hum is refused with the row's link", () => expectQuestion("question", { text: "b", option: "b" }), RIG_MS);

test.skipIf(!live)("a question row takes the words the owner typed in its AskUserQuestion as their answer, naming no option", () => expectQuestion("question-words", { text: OWN_WORDS, option: undefined }), RIG_MS);

test.skipIf(!live)("a question row the owner stops after it asked them is asked again in a new row, whose answer counts", async () => {
	await todoIn("question item", hum);

	const { thread = [] } = await run("question-stopped");

	expect(thread.filter(({ kind }) => kind === "question")).toHaveLength(2);
	expect(thread.filter(({ kind }) => kind === "answer").map(({ text, option }) => ({ text, option }))).toEqual([{ text: "b", option: "b" }]);
}, RIG_MS);

test.skipIf(!live)("with the Project's Worktrees on, a question row still starts in the Project's folder and its answer counts", () => withWorktreesOn(() => expectQuestion("question-worktrees", { text: "b", option: "b" })), RIG_MS);

test.skipIf(!live)("a parked item asks a row with the owner's park actions, and the row's Run it again runs the item again", async () => {
	const { outcomes = [], asked = [], runs = [] } = await run("park");

	expect(asked).toEqual([[RUN_AGAIN]]);
	expect(outcomes.at(0)).toBe("stuck");
	expect(outcomes.at(-1)).toBe("merged");
	expect(runs[1]).toBeGreaterThan(runs[0] ?? Infinity);
}, RIG_MS);

test.skipIf(!live)("the roundup adapter keeps the adapter contract as the Project's program", async () => {
	const { results = [] } = await run("contract");

	expect(results.length).toBeGreaterThan(0);
	expect(results.filter(({ failure }) => failure !== undefined)).toEqual([]);
}, RIG_MS);

/** Each row's step and visibility, in the order hum started them. */
const stepsOf = (rows: readonly { readonly id: string; readonly name: string; readonly visibility?: string }[]) =>
	rows.toSorted((one, other) => Number(one.id) - Number(other.id)).map(({ name, visibility }) => [name.replace(/^hum \S+ /u, "").replace(/ #\d+$/u, ""), visibility]);

const TalkMark = z.strictObject({ run: z.string(), moment: z.enum(["started", "answered"]), at: z.number(), prepared: z.boolean() });

/** When each row the owner talks to started and answered, and whether its folder held the prepare's mark as it started, by the row's run. */
const talkMarks = () =>
	readFileSync(join(rig.dir, "talk-rows.jsonl"), "utf8")
		.split("\n")
		.filter(Boolean)
		.map((line) => TalkMark.parse(JSON.parse(line)));

/**
 * Runs a talk scenario and checks what both of roundup's Worktrees settings must show: the rows in order and shown, the
 * talk kept, the passes that wait, each talk row adopting a talk copy of its own and the pick rows running at once, the
 * prepare run only where the role asks for it, and no note to a row the owner talks to.
 */
const expectTalk = async (scenario: string): Promise<void> => {
	const { rows = [], talk, passes, prepareMs = [] } = await run(scenario);
	const steps = stepsOf(rows);

	expect(steps.slice(0, 2)).toEqual([
		["ideate", "shown"],
		["shape", "shown"],
	]);
	expect(steps.slice(2, 5).toSorted()).toEqual([
		["draft 3", "shown"],
		["find 1", "shown"],
		["spike 2", "shown"],
	]);
	expect(steps.slice(5)).toEqual([["plan-after-talk", "internal"]]);
	expect(talk).toMatchObject({ order: { title: "Write the note" }, choices: [{ pick: "the first" }, { pick: "the first" }, { pick: "the first" }, { pick: "plain" }] });
	expect(JSON.stringify(talk)).not.toContain("early");
	expect(passes?.outcomes.filter((outcome) => outcome === "waiting").length).toBeGreaterThanOrEqual(3);

	const talked = rows.toSorted((one, other) => Number(one.id) - Number(other.id)).slice(0, 5);
	const folders = talked.map(({ worktree }) => worktree);

	expect(folders.every((folder) => folder?.adopted === true && folder.path.includes(`${SLOTS_DIR}/repo-talk-`))).toBe(true);
	expect(new Set(folders.map((folder) => folder?.path)).size).toBe(talked.length);

	const marks = talkMarks();
	const at = (row: { readonly name: string }, moment: "started" | "answered") => marks.find(({ run, moment: was }) => run === row.name && was === moment);
	const picks = talked.slice(2);

	expect(Math.max(...picks.map((row) => at(row, "started")?.at ?? Infinity))).toBeLessThan(Math.min(...picks.map((row) => at(row, "answered")?.at ?? -Infinity)));
	expect(talked.map((row) => [stepsOf([row])[0]?.[0], at(row, "started")?.prepared]).filter(([, prepared]) => prepared !== false)).toEqual([["spike 2", true]]);
	console.log(`the rig's prepare (${PREPARE_STEP}) took ${prepareMs.join(", ")} ms`);

	const ids = new Set(talked.map(({ id }) => id));

	expect((await rig.events()).filter(({ name, data }) => name === "message.sent" && ids.has(String(data?.to)) && JSON.stringify(data).includes(HUM_EXT))).toEqual([]);
};

test.skipIf(!live)("a feature item shows its ideate row, then its shape row and a row for each open choice, all shown, each adopting a talk copy of its own; each takes only the answer saved once it asked the owner and gets no note, a pass ends while one waits on the owner and the next runs once the talk watch wakes it, the choice rows run at once, and planning starts once every choice carries a pick", () => expectTalk("talk"), RIG_MS);

test.skipIf(!live)("with the Project's Worktrees on, the same feature item's talk rows each adopt a talk copy of their own, and its choice rows run at once", () => withWorktreesOn(() => expectTalk("talk-worktrees")), RIG_MS);

test.skipIf(!live)("a part split from a talked feature item keeps the owner's work order and picks, so its pass starts only its plan row", async () => {
	const { parent, rows = [], talk } = await run("split");

	expect(parent?.outcome).toBe("merged");
	expect(stepsOf(rows)).toEqual([["plan-after-talk", "internal"]]);
	expect(talk).toMatchObject({ order: { title: "Write the note" }, choices: [{ pick: "the first" }, { pick: "the first" }, { pick: "the first" }, { pick: "plain" }] });
}, RIG_MS);
