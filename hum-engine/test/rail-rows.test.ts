import { expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { railRunner, refusalCard, TALK_WATCH_CODE } from "../src/adapters/rail-rows.ts";
import type { Runner } from "../src/adapters/claude-p.ts";
import { type RoundupCall, RoundupRefusal } from "../src/adapters/roundup-rpc.ts";
import { keepTalkRun, runFolder } from "../src/adapters/run-answer.ts";
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
