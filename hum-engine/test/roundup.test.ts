import { expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Holder, ItemGone, ItemId } from "../src/adapter-api.ts";
import { guarded } from "../src/adapters/guard.ts";
import { roundupAdapter } from "../src/adapters/roundup.ts";
import { askName } from "../src/adapters/rail.ts";
import { RoundupRefusal } from "../src/adapters/roundup-rpc.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { slug } from "../src/state/fs.ts";
import { openState } from "../src/state/open.ts";
import { type FakeRoundup, fakeRoundup } from "./fixtures/fake-roundup.ts";
import { tempDir } from "./fixtures/temp.ts";

const HOLDER = Holder.parse("worker-1");

type Adapter = ReturnType<typeof roundupAdapter>;

/** The roundup adapter on a fake Daemon, holding one Todo the adapter claimed. */
const claimedTodo = async () => {
	const daemon = await fakeRoundup();
	const stateDir = tempDir("roundup-state");
	const adapter = roundupAdapter({ socket: daemon.socket, workstream: SHIPPED_DEFAULTS.roundupWorkstream, stateDir, repo: tempDir("repo"), config: SHIPPED_DEFAULTS }, { report: () => {}, now: Date.now, env: {} });
	const id = ItemId.parse(daemon.todo("a", daemon.workstream(SHIPPED_DEFAULTS.roundupWorkstream)));

	await adapter.workSource.claim(id, HOLDER, 60_000);

	return { daemon, adapter, id, stateDir, claim: join(stateDir, "roundup", "claims", `${id}.json`) };
};

test("a Todo roundup no longer holds reads as a gone item, and the adapter lets go of its claim", async () => {
	const { daemon, adapter, id, claim } = await claimedTodo();

	expect(existsSync(claim)).toBe(true);

	daemon.remove(id);

	await expect(adapter.workSource.read(id)).rejects.toBeInstanceOf(ItemGone);
	expect(existsSync(claim)).toBe(false);
	await adapter.close();
});

test.each([
	["its socket is gone", (daemon: FakeRoundup) => daemon.close()],
	["it refuses a Todo read for another cause", async (daemon: FakeRoundup) => daemon.refuse("todo.get", -32602)],
])("a roundup that is down while %s is down: the read raises the provider card, and the item and its claim stay", async (_, down) => {
	const { daemon, adapter, id, claim } = await claimedTodo();
	const state = openState(tempDir("guard-state"), { now: Date.now });
	const source = guarded(adapter, { provider: "roundup", faults: state.faults, timeoutMs: 50, backoffMs: { first: 5, max: 5 } });

	await down(daemon);

	const failed = await source.workSource!.read(id).catch((error: Error) => error);

	expect(failed).toBeInstanceOf(Error);
	expect(failed).not.toBeInstanceOf(ItemGone);
	expect(state.faults.list().map(({ code }) => code)).toEqual(["provider-unavailable"]);
	expect(existsSync(claim)).toBe(true);
	await adapter.close();
});

test.each([
	["a Pad", "pad.create", (adapter: Adapter, id: ItemId) => adapter.workSource.comment(id, "a line ".repeat(100))],
	["the Rail", "rail.tree", (adapter: Adapter, id: ItemId) => adapter.workSource.read(id)],
])("a not-found for %s is no gone item: the call fails, and the item keeps its claim", async (_, method, use) => {
	const { daemon, adapter, id, claim } = await claimedTodo();

	daemon.refuse(method, -32001);

	const failed = await use(adapter, id).catch((error: Error) => error);

	expect(failed).toBeInstanceOf(RoundupRefusal);
	expect(failed).not.toBeInstanceOf(ItemGone);
	expect(existsSync(claim)).toBe(true);
	await adapter.close();
});

test("a note of several lines posts its first words on the Todo and its whole text in a Pad, and reads back whole, the same text sent twice too, or as its first words once the Pad is gone", async () => {
	const { daemon, adapter, id } = await claimedTodo();
	const text = "Keep the old API.\n\nName the flag plainly.";

	await adapter.answers.request(id, { kind: "note", step: "fixing", text });

	await adapter.answers.request(id, { kind: "note", step: "reviewing", text });

	expect((await adapter.workSource.read(id)).thread).toMatchObject([
		{ kind: "note", step: "fixing", text, author: "hum" },
		{ kind: "note", step: "reviewing", text, author: "hum" },
	]);

	const [pad] = daemon.calls.filter(({ method }) => method === "pad.create").map(({ params }) => params.name ?? "");

	daemon.removePad(pad ?? "");

	expect((await adapter.workSource.read(id)).thread[0]).toMatchObject({ kind: "note", step: "fixing", text: `Keep the old API. Name the flag plainly. … full text in Pad "${pad}"` });
	await adapter.close();
});

test("a request posts on the Todo as hum's own marked comment and reads back on the thread with its kind and step, where an answer through hum is refused", async () => {
	const { adapter, id } = await claimedTodo();

	await expect(adapter.answers.answer(id, { text: "go" })).rejects.toBeInstanceOf(Error);
	await adapter.answers.request(id, { kind: "skip", step: "owner-review" });

	expect((await adapter.workSource.read(id)).thread).toMatchObject([{ kind: "skip", step: "owner-review", author: "hum" }]);
	await adapter.close();
});

test("the owner's answer in a question row reads on the thread with the row's name and when it asked as its id, the same on every read, so hum keeps it once", async () => {
	const { daemon, adapter, id, stateDir } = await claimedTodo();

	await adapter.questions.ask(id, { text: "Ship it?", options: ["yes", "no"] });

	const [row] = daemon.rows();

	if (row === undefined) throw new Error("asking started no row");

	daemon.waitOnOwner(row.id);
	await adapter.workSource.read(id);
	writeFileSync(join(stateDir, "roundup", "questions", slug(askName(id, 1)), "hooks", "answer.json"), JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", tool_response: { answers: { "Ship it?": "yes" } } }));

	const thread = async () => (await adapter.workSource.read(id)).thread;
	const asked = (await thread()).find(({ kind }) => kind === "question");
	const answers = async () => (await thread()).filter(({ kind }) => kind === "answer").map(({ text, id: key }) => ({ text, key }));
	const taken = { text: "yes", key: `${askName(id, 1)}@${asked?.at}` };

	expect(await answers()).toEqual([taken]);
	expect(await answers()).toEqual([taken]);
	await adapter.close();
});

test("a question hum closed takes no late answer from its row, which it stopped, and is never asked again: the thread reads it closed", async () => {
	const { daemon, adapter, id, stateDir } = await claimedTodo();

	await adapter.questions.ask(id, { text: "Ship it?", options: ["yes", "no"] });

	const [row] = daemon.rows();

	if (row === undefined) throw new Error("asking started no row");

	daemon.waitOnOwner(row.id);
	await adapter.workSource.read(id);
	await adapter.questions.close(id, "This question closed: its wait timed out. An answer to it no longer applies.");

	const late = { hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", tool_response: { answers: { "Ship it?": "yes" } } };

	writeFileSync(join(stateDir, "roundup", "questions", slug(askName(id, 1)), "hooks", "late.json"), JSON.stringify(late));

	expect((await adapter.workSource.read(id)).thread.map(({ kind }) => kind)).toEqual(["question", "close"]);
	expect(daemon.rows().map(({ status }) => status?.kind)).toEqual(["done"]);
	await adapter.close();
});
