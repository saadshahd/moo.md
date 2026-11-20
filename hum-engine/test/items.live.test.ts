import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Holder, ItemId } from "../src/adapter-api.ts";
import { itemWorkstreamName } from "../src/adapters/rail.ts";
import { roundupAdapter } from "../src/adapters/roundup.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { RUN_AGAIN } from "../src/decide/answer.ts";
import { INBOX_DIR } from "../src/state/open.ts";
import { ITEMS_DRIVER, ROUNDUP_APP, type Rig, startRig } from "./fixtures/rows-rig.ts";

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

test.skipIf(!live)("a question row's answer counts only once roundup showed the row waiting on the owner, and an answer through hum is refused with the row's link", async () => {
	await todoIn("question item", hum);

	const { thread = [], refusal } = await run("question");

	expect(thread.filter(({ kind }) => kind === "answer")).toEqual([expect.objectContaining({ text: "after", option: "b" })]);
	expect(refusal).toMatch(/roundup:\/\/agent\/\d+\?project=/u);
}, RIG_MS);

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
