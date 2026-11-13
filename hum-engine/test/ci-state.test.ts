import { expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CI_STATE_REF, CiStateRaced, restoreCiState, saveCiState } from "../src/service/ci-state.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { defaultStateDir, openState } from "../src/state/open.ts";
import { tallyOf } from "../src/worker/tally.ts";
import { OWNER } from "./fixtures/identity.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

const NOW = 1_800_000_000_000;

/** One CI job: a fresh clone of the remote, its state folder in the clone's git dir, and the state it read back. */
const job = async (repo: WorkRepo, name: string) => {
	const clone = repo.worker(name);
	const dir = await defaultStateDir(clone);
	const where = { repo: clone, remote: "origin", dir, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS };
	const read = await restoreCiState(where);

	return { dir, read, state: openState(dir, { now: () => NOW }), save: (from = read) => saveCiState({ ...where, ...from, identity: OWNER, at: NOW }) };
};

test("a wake that parks a stuck item and spends tokens saves both, and the next wake, in a fresh clone, reads them back and runs the item no more", async () => {
	const repo = new WorkRepo();
	const first = await job(repo, "wake-1");

	expect(first.read).toEqual({ read: undefined });

	tallyOf(first.state, "seed-1").spend(900_000);
	first.state.parked.put("seed-1", { item: "seed-1", why: "stuck", cause: "the checks still fail after 3 fixes", since: NOW });
	writeFileSync(join(first.dir, "heartbeat.json"), "{}");
	await first.save();

	const second = await job(repo, "wake-2");

	expect(second.read.read).toBe(sh(repo.remote, ["rev-parse", CI_STATE_REF]).trim());
	expect(second.state.parked.get("seed-1")?.why).toBe("stuck");
	expect(tallyOf(second.state, "seed-1").sinceAnswer()).toBe(900_000);
	expect(existsSync(join(second.dir, "heartbeat.json"))).toBe(false);
});

test("each save replaces the ref with one commit and no parent, so the ref never grows", async () => {
	const repo = new WorkRepo();
	const wake = await job(repo, "wake");

	mkdirSync(wake.dir, { recursive: true });
	writeFileSync(join(wake.dir, "credentials.json"), "{}\n");

	const once = await wake.save();

	await wake.save(once);

	expect(sh(repo.remote, ["rev-list", "--count", CI_STATE_REF]).trim()).toBe("1");
});

test("two wakes that read the same state race to save it: one lands, the other throws and writes over nothing", async () => {
	const repo = new WorkRepo();
	const a = await job(repo, "wake-a");
	const b = await job(repo, "wake-b");

	a.state.parked.put("x", { item: "x", why: "stuck", cause: "a", since: NOW });
	b.state.parked.put("y", { item: "y", why: "stuck", cause: "b", since: NOW });

	const outcomes = await Promise.allSettled([a.save(), b.save()]);
	const later = await job(repo, "wake-c");

	expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
	expect(outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))[0]).toBeInstanceOf(CiStateRaced);
	expect([later.state.parked.get("x"), later.state.parked.get("y")].filter(Boolean)).toHaveLength(1);
});
