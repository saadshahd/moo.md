import { expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { railRunner, refusalCard, TALK_WATCH_CODE } from "../src/adapters/rail-rows.ts";
import type { Runner } from "../src/adapters/claude-p.ts";
import { type RoundupCall, RoundupRefusal } from "../src/adapters/roundup-rpc.ts";
import { agentLink, NOT_FOUND, padLink } from "../src/adapters/rail.ts";
import { keepTalkRun, runFolder } from "../src/adapters/run-answer.ts";
import type { Json } from "../src/config/json.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { PROGRAM_FIX } from "../src/service/program.ts";
import { openState } from "../src/state/open.ts";
import { tempDir } from "./fixtures/temp.ts";

const unused: Runner = { run: () => Promise.reject(new Error("no run reaches the fallback here")), limitedUntil: () => 0 };

test("the card of a Rail read that failed while hum watched a row the owner talks to clears once no such row is left to watch", async () => {
	const state = openState(tempDir("rail-rows"), { now: Date.now });
	const call: RoundupCall = () => Promise.reject(new Error("roundup is not running"));
	const runner = railRunner({ call, repo: tempDir("repo"), state, config: SHIPPED_DEFAULTS, fallback: unused, now: Date.now });
	const talk = runFolder(state.dir, "hum a build #0");

	keepTalkRun(talk, { item: "a" });
	await runner.talking?.();
	expect(state.faults.list().map(({ code }) => code)).toEqual([TALK_WATCH_CODE]);

	rmSync(talk.root, { recursive: true, force: true });
	await runner.talking?.();
	expect(state.faults.list()).toEqual([]);
});

test("forgetting an item's runs stops each recorded row, drops every run's folder though a stop fails, and leaves the item no talk to keep", async () => {
	const state = openState(tempDir("rail-rows"), { now: Date.now });
	const stopped: string[] = [];

	const call: RoundupCall = async (method, params) => {
		if (method !== "agent.stop") throw new Error(`no ${method} here`);

		stopped.push(String(params?.id));

		if (params?.id === "1") throw new Error("roundup is not running");

		return null;
	};

	const runner = railRunner({ call, repo: tempDir("repo"), state, config: SHIPPED_DEFAULTS, fallback: unused, now: Date.now });
	const names = ["hum a ideate #0", "hum a shape #0"];

	for (const [index, name] of names.entries()) {
		const folder = runFolder(state.dir, name);

		keepTalkRun(folder, { item: "a" });
		writeFileSync(folder.row, JSON.stringify({ id: String(index + 1), name }));
	}

	await expect(runner.forget!(names)).rejects.toThrow("roundup is not running");
	expect(stopped.toSorted()).toEqual(["1", "2"]);
	expect(await runner.talking?.()).toEqual(new Map());
});

/** roundup's refusals of a row's start, by JSON-RPC code, method and words, as the live rig measured them; the last stands for any refusal hum reads no reason in. */
const REFUSALS: readonly (readonly [number, string, string])[] = [
	[-32602, "agent.adopt", "outside_program_directory: /repo"],
	[-32002, "agent.adopt", "only the user's own pick or the Project's program adopts a worktree"],
	[-32003, "agent.adopt", "worktree_in_use: /repo/.hum-slots/repo-talk-1-ideate"],
	[-32003, "agent.adopt", "adopt_stale: /repo/.hum-slots/s3 is not on hum/1 now"],
	[-32602, "agent.adopt", "detached_head: /repo/.hum-slots/s3"],
	[-32602, "agent.spawn", "cwd_not_in_worktree: /repo/.hum-slots/s1 is not in the fresh worktree"],
	[-32001, "rail.rename", "no node 9"],
];

test("a row roundup refused gets a card whose cause says what roundup's reason means and keeps its words, and whose fix is to set the Program again only where roundup does not take hum for it or the folder lies outside its Worktree path", () => {
	const cards = REFUSALS.map(([code, method, said]) => ({ said: `${method}: ${said}`, ...refusalCard(new RoundupRefusal(code, method, said)) }));

	expect(cards.every(({ said, cause }) => cause.endsWith(`: ${said}`))).toBe(true);
	expect(new Set(cards.map(({ said, cause }) => cause.slice(0, -said.length))).size).toBe(REFUSALS.length);
	expect(cards.map(({ fix }) => fix === PROGRAM_FIX)).toEqual([true, true, false, false, false, false, false]);
	expect(new Set(cards.slice(2).map(({ fix }) => fix)).size).toBe(REFUSALS.length - 2);
});

test("where the owner opens an item: each row of its Workstream but its feed row, its newest live question row, and its handoff Pad where one stands", async () => {
	const state = openState(tempDir("rail-rows"), { now: Date.now });
	const workstream = (id: string, name: string) => ({ id, name, kind: "workstream", parent: null });
	const agent = (id: string, name: string, parent: string, kind: string) => ({ id, name, kind: "agent", parent, status: { kind } });
	const nodes = [workstream("1", "#7 Add export"), workstream("2", "#8 Other"), agent("3", "hum 7 build", "1", "done"), agent("4", "hum 7 ask 1", "1", "needs-you"), agent("5", "hum 7 feed", "1", "idle"), agent("6", "hum 7 ask 2", "1", "done"), agent("7", "hum 8 build", "2", "working")];

	const call: RoundupCall = async (method, params): Promise<Json> => {
		if (method === "rail.tree") return nodes;

		if (method === "daemon.ping") return { projectKey: "key" };

		if (method === "pad.read" && params?.name === "#7 handoff") return { name: "#7 handoff", text: "" };

		throw new RoundupRefusal(NOT_FOUND, method, `not found: ${JSON.stringify(params)}`);
	};

	const links = await railRunner({ call, repo: tempDir("repo"), state, config: SHIPPED_DEFAULTS, fallback: unused, now: Date.now }).links?.(["7", "8", "9"]);
	const row = (id: string, name: string, kind: string) => ({ name, agent: id, state: kind, link: agentLink(id, "key") });

	expect(links).toEqual(
		new Map([
			["7", { rows: [row("3", "hum 7 build", "done"), row("4", "hum 7 ask 1", "needs-you"), row("6", "hum 7 ask 2", "done")], ask: row("4", "hum 7 ask 1", "needs-you"), handoff: { name: "#7 handoff", link: padLink("#7 handoff", "key") } }],
			["8", { rows: [row("7", "hum 8 build", "working")], ask: undefined, handoff: undefined }],
			["9", { rows: [], handoff: undefined }],
		]),
	);
});

test("an item's feed row starts in its Workstream with hum's plugin on, the item named and no order or prompt, and never where a row of its name stands or no Workstream does", async () => {
	const state = openState(tempDir("rail-rows"), { now: Date.now });
	const repo = tempDir("repo");
	const spawned: Json[] = [];

	const nodes: Json[] = [
		{ id: "1", name: "#7 Add export", kind: "workstream", parent: null },
		{ id: "2", name: "#8 Other", kind: "workstream", parent: null },
		{ id: "3", name: "hum 8 feed", kind: "agent", parent: "2", status: { kind: "done" } },
	];

	const call: RoundupCall = async (method, params): Promise<Json> => {
		if (method === "rail.tree") return nodes;

		if (method !== "agent.spawn") throw new Error(`no ${method} here`);

		spawned.push(params ?? null);

		return { id: "4", name: "hum 7 feed", kind: "agent", parent: "1" };
	};

	await railRunner({ call, repo, state, config: SHIPPED_DEFAULTS, fallback: unused, now: Date.now }).keepFeeds?.(["7", "8", "9"]);


	expect(spawned).toEqual([{ cwd: repo, parent: "1", name: "hum 7 feed", settings: { enabledPlugins: { "hum@moo.md": true }, env: { HUM_FEED_ITEM: "7" } }, visibility: "shown" }]);
});
