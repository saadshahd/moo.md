import { expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { railRunner, TALK_WATCH_CODE } from "../src/adapters/rail-rows.ts";
import type { Runner } from "../src/adapters/claude-p.ts";
import type { RoundupCall } from "../src/adapters/roundup-rpc.ts";
import { keepTalkRun, runFolder } from "../src/adapters/run-answer.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
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
