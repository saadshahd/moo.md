import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Holder, ItemGone, ItemId } from "../src/adapter-api.ts";
import { guarded } from "../src/adapters/guard.ts";
import { roundupAdapter } from "../src/adapters/roundup.ts";
import { RoundupRefusal } from "../src/adapters/roundup-rpc.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
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

	return { daemon, adapter, id, claim: join(stateDir, "roundup", "claims", `${id}.json`) };
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

test("a won claim starts the item's feed row in its Workstream once, with hum's plugin on, the item named and no order or prompt", async () => {
	const { daemon, adapter, id } = await claimedTodo();

	await adapter.workSource.renew(id, HOLDER, 60_000);

	const spawns = daemon.calls.filter(({ method }) => method === "agent.spawn").map(({ params }) => params);
	const home = daemon.calls.find(({ method, params }) => method === "todo.move" && String(params.id) === id)?.params.home;

	expect(home).toBeString();
	expect(spawns).toEqual([{ cwd: expect.any(String), parent: home, name: `hum ${id} feed`, settings: { enabledPlugins: { "hum@moo.md": true }, env: { HUM_FEED_ITEM: id } }, visibility: "shown" }]);
	await adapter.close();
});
