import { afterEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { x } from "tinyexec";
import { gitIn } from "../src/adapters/git.ts";
import { slotFolder } from "../src/slots/env.ts";
import { SLOT_KEPT_CODE, SLOT_OUT_CODE } from "../src/slots/pool.ts";
import { proposeRecipe } from "../src/slots/scan.ts";
import type { Slot } from "../src/state/saved.ts";
import { OWNER } from "./fixtures/identity.ts";
import { sh } from "./fixtures/work-repo.ts";
import { type SlotSettings, slotWorld, type SlotWorld } from "./fixtures/slot-world.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";

const worlds: SlotWorld[] = [];

const world = (settings?: SlotSettings, liveRuns?: Parameters<typeof slotWorld>[1]): SlotWorld => {
	const made = slotWorld(settings, liveRuns);

	worlds.push(made);

	return made;
};

afterEach(async () => {
	for (const made of worlds.splice(0)) {
		await made.slots.idle();
	}
});

const statuses = (w: SlotWorld): string[] => w.slots.list().map(({ status }) => status);

const WAITED_MS = 150;

const stillWaiting = async (pending: Promise<unknown>): Promise<boolean> => (await Promise.race([pending.then(() => false), Bun.sleep(WAITED_MS).then(() => true)]));

test("with more passes than slots, the extra pass waits and starts in the first slot returned", async () => {
	const w = world({ runners: 2 });
	const first = await w.ask("a");
	const second = await w.ask("b");
	const extra = w.ask("c");

	expect(first.folder).not.toBe(second.folder);
	expect(await stillWaiting(extra)).toBe(true);

	await first.giveBack();

	expect((await extra).folder).toBe(first.folder);
});

test("a pass that waits for a slot stops waiting when it is aborted", async () => {
	const w = world({ runners: 1 });

	await w.ask("a");

	const stop = new AbortController();
	const waiting = w.ask("b", { signal: stop.signal });

	stop.abort(new Error("claim lost"));

	await expect(waiting).rejects.toThrow("claim lost");
});

test("a slot taken by a worker that died before its run started is returned", async () => {
	const w = world({ runners: 1 });
	const died = await x("bun", [join(import.meta.dir, "fixtures", "take-and-die.ts"), w.stateDir, w.repo.owner, w.repo.remote, w.pool, "x"], { nodePath: false });

	expect(died.exitCode).not.toBe(0);
	const restarted = w.reopened();

	expect(restarted.list()).toMatchObject([{ status: "taken", item: "x" }]);

	await restarted.maintain();

	expect(restarted.list()).toMatchObject([{ status: "free" }]);
	expect(restarted.list()[0]).not.toHaveProperty("item");
});

test.each<[string, ReadonlySet<string>, Slot["status"]]>([
	["its run is gone from claude agents", new Set(), "free"],
	["its run is alive", new Set(["hum y build #0"]), "taken"],
])("a restarted worker finds a slot taken by an earlier pass whose run is %s", async (_why, alive, expected) => {
	const w = world({ runners: 1 });

	await w.ask("y");
	w.state.runs.begin({ itemId: "y", run: "build", attempt: 0 }, "hum y build #0");

	const restarted = w.reopened(async () => alive);

	await restarted.maintain();

	expect(restarted.list().map(({ status }) => status)).toEqual([expected]);
});

test("a pass that ends with a commit the remote lacks keeps its slot taken, with one card naming the branch, and the commit survives", async () => {
	const w = world({ runners: 1 });
	const taken = await w.ask("a");
	const git = gitIn(taken.folder, { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	await git.raw(["checkout", "-q", "-b", "hum/run/a"]);
	writeFileSync(join(taken.folder, "work.txt"), "unpushed\n");
	await git.raw(["add", "work.txt"]);
	await git.raw(["commit", "-q", "-m", "work"]);

	const commit = (await git.raw(["rev-parse", "HEAD"])).trim();

	await taken.giveBack();

	const cards = w.state.faults.list().filter(({ code }) => code === SLOT_KEPT_CODE);

	expect(statuses(w)).toEqual(["kept"]);
	expect(cards).toHaveLength(1);
	expect(cards[0]?.cause).toContain("hum/run/a");
	expect(await git.raw(["cat-file", "-t", commit])).toBe("commit\n");

	sh(taken.folder, ["push", "-q", "origin", "hum/run/a"]);
	await w.slots.maintain();

	expect(statuses(w)).toEqual(["free"]);
	expect(w.state.faults.list()).toEqual([]);
	expect(await git.run(["rev-parse", "--verify", "--quiet", "refs/heads/hum/run/a"])).toMatchObject({ code: 1 });
});

test("a slot refreshes between passes: its data resets every time and its dependencies reinstall only when a lockfile changed", async () => {
	const counters = tempDir("counters");
	const count = (name: string): number => (existsSync(join(counters, name)) ? readFileSync(join(counters, name), "utf8").split("\n").filter(Boolean).length : 0);

	const w = world({
		runners: 1,
		recipe: {
			prepare: [`echo installed >> ${counters}/installs`],
			refresh: [
				{ run: `echo installed >> ${counters}/installs`, when: "lockfile-changed" },
				{ run: `rm -f ${counters}/data`, when: "always" },
			],
		},
	});

	const first = await w.ask("a");

	writeFileSync(join(counters, "data"), "written by the first pass\n");
	await first.giveBack();
	await w.slots.idle();

	expect(existsSync(join(counters, "data"))).toBe(false);
	expect(count("installs")).toBe(1);

	w.repo.put("bun.lock", "changed\n");
	await (await w.ask("b")).giveBack();
	await w.slots.idle();

	expect(count("installs")).toBe(2);
});

test("a slot that fails its ready check leaves the pool with one card naming it and the check, and the other slots go on", async () => {
	const check = `test "$HUM_SLOT" != slot-2`;
	const w = world({ runners: 2, recipe: { ready: [check] } });
	const only = await w.ask("a");
	const second = w.ask("b");

	await w.slots.idle();

	const cards = w.state.faults.list().filter(({ code }) => code === SLOT_OUT_CODE);

	expect(statuses(w)).toEqual(["taken", "out"]);
	expect(cards).toHaveLength(1);
	expect(cards[0]?.cause).toContain("slot-2");
	expect(cards[0]?.cause).toContain(check);
	expect(await stillWaiting(second)).toBe(true);

	await only.giveBack();

	expect((await second).folder).toBe(only.folder);
});

test("every slot out of the pool fails the pass loudly", async () => {
	const w = world({ runners: 1, recipe: { ready: ["false"] } });

	await expect(w.ask("a")).rejects.toThrow("every run slot is out of the pool");
});

test("a slot made by git clone is refused, and the other slots go on", async () => {
	const w = world({ runners: 2 });
	const clone = slotFolder(w.repo.owner, w.config.runSlots.pool, "slot-2");

	mkdirSync(w.pool, { recursive: true });
	sh(w.pool, ["clone", "-q", w.repo.remote, basename(clone)]);

	await w.slots.maintain();

	const [card] = w.state.faults.list();

	expect(statuses(w)).toEqual(["free", "out"]);
	expect(card?.cause).toContain("not a git worktree");
	expect(card?.cause).toContain(clone);
});

test("a repo's own environment script is the recipe's prepare, and a repo without one gets an empty recipe", async () => {
	const bare = world({ runners: 1 });

	expect(proposeRecipe(bare.repo.owner)).toEqual({ prepare: [], refresh: [], ready: [] });

	const owned = world({
		runners: 1,
		seed: (repo) => {
			const owner = repo.owner;

			mkdirSync(join(owner, "scripts"), { recursive: true });
			writeFileSync(join(owner, "scripts", "env.sh"), '#!/bin/sh\ntouch "$HUM_SLOT_FOLDER/prepared-by-env-script"\n');
			chmodSync(join(owner, "scripts", "env.sh"), 0o755);
			repo.commit("env script");
			sh(owner, ["push", "-q", "origin", "main"]);
		},
		recipe: proposeRecipe,
	});

	expect(await Bun.file(join((await owned.ask("a")).folder, "prepared-by-env-script")).exists()).toBe(true);
});
