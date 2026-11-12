import { beforeEach, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createActor, SimulatedClock } from "xstate";
import {
	defaultStateDir,
	emptyStatus,
	ENGINE_VERSION,
	type EnvelopeMigrations,
	Kind,
	openState,
	persistedSnapshot,
	readHeartbeat,
	readStatus,
	type State,
	writeStatus,
} from "../src/index.ts";
import { kindMachine } from "../src/index.ts";
import { slug } from "../src/state/fs.ts";
import { SAVED_0_1_0 } from "./fixtures/saved-0-1-0.ts";
import { tempDir } from "./fixtures/temp.ts";

const DAY = 86_400_000;

/** A small kind: queued → waiting (a wait with a timeout) → done. */
const kindAt = (version: string, waiting = "waiting") =>
	Kind.parse({
		tiers: [{ purpose: "build", tier: "light", effort: "low" }],
		tokenCap: { tokens: 1000, overCap: "stuck" },
		machine: {
			id: "tiny",
			version,
			initial: "queued",
			states: {
				queued: { on: { start: { target: waiting } } },
				[waiting]: { tags: ["wait"], on: { answer: { target: "done" } }, after: { [DAY]: { target: "stuck" } } },
				done: { type: "final" },
				stuck: { type: "final", tags: ["stuck"] },
			},
		},
	});

const tiny = kindAt("1");

let dir: string;

beforeEach(() => {
	dir = tempDir("state");
});

const waitingItem = (state: State, itemId: string) => {
	const actor = createActor(kindMachine(tiny), { clock: new SimulatedClock() }).start();

	actor.send({ type: "start" });
	expect(state.items.save(itemId, tiny, persistedSnapshot(actor)).ok).toBe(true);
	actor.stop();
};

test("a saved item restores in place, with its timer", async () => {
	const state = openState(dir);

	waitingItem(state, "#68");
	const clock = new SimulatedClock();
	const restored = await state.items.restore("#68", tiny, { clock });

	expect(restored.ok && restored.value?.getSnapshot().value).toBe("waiting");

	if (!restored.ok || !restored.value) return;
	restored.value.start();
	clock.increment(DAY);
	expect(restored.value.getSnapshot().value).toBe("stuck");
	expect((await state.items.restore("#none", tiny)).ok).toBe(true);
	expect(state.faults.list()).toEqual([]);
});

test("a truncated snapshot keeps its file, starts nothing and raises one card; other items go on", async () => {
	const state = openState(dir);

	waitingItem(state, "#68");
	waitingItem(state, "#69");
	truncateSync(state.items.path("#68"), 40);
	const before = readFileSync(state.items.path("#68"));

	for (let times = 0; times < 2; times++) {
		const broken = await state.items.restore("#68", tiny);

		expect(broken.ok).toBe(false);
	}

	expect(readFileSync(state.items.path("#68"))).toEqual(before);
	expect(state.faults.list().map((card) => card.code)).toEqual(["snapshot-unreadable"]);
	expect(state.faults.list()[0]?.cause).toContain(state.items.path("#68"));
	const other = await state.items.restore("#69", tiny);

	expect(other.ok && other.value?.getSnapshot().value).toBe("waiting");
});

test("a snapshot xstate cannot restore gives an error status, one card, and the file stays", async () => {
	const state = openState(dir);

	waitingItem(state, "#68");
	const file = state.items.path("#68");
	const envelope = JSON.parse(readFileSync(file, "utf8"));

	envelope.snapshot.value = "nowhere";
	writeFileSync(file, JSON.stringify(envelope));
	const result = await state.items.restore("#68", tiny);

	expect(result.ok).toBe(false);
	expect(state.faults.list().map((card) => card.code)).toEqual(["snapshot-restore-error"]);
	expect(existsSync(file)).toBe(true);
});

test("a snapshot from an older engine restores in place, and a rollback to an older engine gives one card", async () => {
	waitingItem(openState(dir, { engineVersion: "0.1.0" }), "#68");

	const next = openState(dir, { engineVersion: "0.2.0" });
	const restored = await next.items.restore("#68", tiny);

	expect(restored.ok && restored.value?.getSnapshot().value).toBe("waiting");

	if (restored.ok && restored.value) next.items.save("#68", tiny, persistedSnapshot(restored.value));
	expect(JSON.parse(readFileSync(next.items.path("#68"), "utf8")).engineVersion).toBe("0.2.0");

	// Rollback: the 0.1.0 engine meets a 0.2.0 file. One card, however often it looks; the file stays and the item does not start over.
	const rolledBack = openState(dir, { engineVersion: "0.1.0" });
	const before = readFileSync(rolledBack.items.path("#68"));

	for (let times = 0; times < 3; times++) expect((await rolledBack.items.restore("#68", tiny)).ok).toBe(false);

	expect(rolledBack.faults.list().map((card) => card.code)).toEqual(["snapshot-from-newer-engine"]);
	expect(readFileSync(rolledBack.items.path("#68"))).toEqual(before);
});

test("a shipped envelope migration runs on an older format; a format with no migration reads as damaged, with one card", async () => {
	const engine = openState(dir);

	waitingItem(engine, "#68");
	const file = engine.items.path("#68");
	const legacy = JSON.parse(readFileSync(file, "utf8"));

	// Format 0 called `savedAt` `at`.
	legacy.format = 0;
	legacy.at = legacy.savedAt;
	delete legacy.savedAt;
	writeFileSync(file, JSON.stringify(legacy));

	const migrations: EnvelopeMigrations = {
		0: ({ at, ...rest }) => ({ ...rest, savedAt: at ?? 0 }),
	};

	const restored = await openState(dir, { migrations }).items.restore("#68", tiny);

	expect(restored.ok && restored.value?.getSnapshot().value).toBe("waiting");

	// A format with no migration, from a hand edit or a damaged file, would throw on every tick: it is refused like any damaged file.
	expect((await engine.items.restore("#68", tiny)).ok).toBe(false);
	expect(engine.faults.list().map((card) => card.code)).toEqual(["snapshot-unreadable"]);
});

const canMountDiskImage = process.platform === "darwin" && Bun.which("hdiutil") !== null;

const canMountTmpfs = process.platform === "linux" && process.getuid?.() === 0;

test.skipIf(!canMountDiskImage)("a full disk image leaves the old snapshot restorable and raises one card", async () => {
	const image = join(dir, "disk.dmg");
	const mount = join(dir, "mnt");

	mkdirSync(mount);
	const made = spawnSync("hdiutil", ["create", "-size", "2m", "-fs", "HFS+", "-volname", "humfull", "-ov", image]);

	if (made.status !== 0) throw new Error(`hdiutil create failed: ${made.stderr}`);
	const attached = spawnSync("hdiutil", ["attach", "-nobrowse", "-mountpoint", mount, image]);

	if (attached.status !== 0) throw new Error(`hdiutil attach failed: ${attached.stderr}`);

	try {
		const state = openState(join(mount, "hum"));

		waitingItem(state, "#68");
		const good = readFileSync(state.items.path("#68"));

		const chunk = "x".repeat(65_536);

		for (let at = 0; ; at++) {
			try {
				appendFileSync(join(mount, "filler"), chunk);
			} catch {
				break;
			}

			if (at > 100) throw new Error("the disk image never filled");
		}

		const actor = createActor(kindMachine(tiny)).start();
		const big = persistedSnapshot(actor);
		const result = state.items.save("#68", tiny, { big: "y".repeat(500_000), big2: big });

		expect(result.ok).toBe(false);
		expect(state.items.save("#68", tiny, { big: "y".repeat(500_000) }).ok).toBe(false);
		expect(state.faults.list().map((card) => card.code)).toEqual(["snapshot-write-failed"]);
		expect(readFileSync(state.items.path("#68"))).toEqual(good);
		expect(readdirSync(join(mount, "hum", "items")).filter((name) => !name.endsWith(".json"))).toEqual([]);

		const restored = await state.items.restore("#68", tiny);

		expect(restored.ok && restored.value?.getSnapshot().value).toBe("waiting");
	} finally {
		spawnSync("hdiutil", ["detach", "-force", mount]);
	}
}, 60_000);

test.skipIf(!canMountTmpfs)("a full size-capped tmpfs leaves the old snapshot restorable and raises one card", () => {
	const mount = join(dir, "tmpfs");

	mkdirSync(mount);
	expect(spawnSync("mount", ["-t", "tmpfs", "-o", "size=2m", "tmpfs", mount]).status).toBe(0);

	try {
		const state = openState(join(mount, "hum"));

		waitingItem(state, "#68");

		for (let at = 0; at < 100; at++) {
			try {
				appendFileSync(join(mount, "filler"), "x".repeat(65_536));
			} catch {
				break;
			}
		}

		expect(state.items.save("#68", tiny, { big: "y".repeat(500_000) }).ok).toBe(false);
		expect(state.faults.list()).toHaveLength(1);
	} finally {
		spawnSync("umount", [mount]);
	}
});

test("a half-written temp file a crash left beside the records is not read as one", () => {
	const state = openState(dir);

	state.parked.put("a", { item: "a", why: "stuck", cause: "c", since: 1 });
	writeFileSync(join(dir, "parked", "partial.json.1234567890"), "{");

	expect(state.parked.list().map((parked) => parked.item)).toEqual(["a"]);
});

const readsOf = (state: State) =>
	({
		parked: () => state.parked.list(),
		spent: () => state.spent.list(),
		limit: () => state.limit.list(),
		ready: () => state.ready.list(),
		landings: () => state.landings.list(),
		learned: () => state.learned.list(),
		"item-kinds": () => state.itemKinds.list(),
		plans: () => state.plans.list(),
		verdicts: () => state.verdicts.list(),
		questions: () => state.questions.list(),
		answers: () => state.answers.list(),
		slots: () => state.slots.list(),
		runs: () => state.runs.all(),
		events: () => state.events.list(SAVED_0_1_0.events.itemId),
		ops: () => state.ops.list(),
		proofs: () => state.proofs.list(),
		choices: () => state.choices.list(),
		notes: () => state.notes.list(),
		repeats: () => state.repeats.list(),
		"possible-repeats": () => state.possibleRepeats.list(),
		merges: () => state.merges.list(),
		breaks: () => state.breaks.list(),
	}) satisfies Record<keyof typeof SAVED_0_1_0, () => unknown[]>;

/** Runs and events live one folder deeper, under the item's slug. */
const folderOf = (store: keyof typeof SAVED_0_1_0): string => (store === "runs" || store === "events" ? join(dir, store, slug(SAVED_0_1_0[store].itemId)) : join(dir, store));

// SAFETY: Object.keys of a literal object lists exactly the keys its type names.
test.each(Object.keys(SAVED_0_1_0) as (keyof typeof SAVED_0_1_0)[])("a %s record hum 0.1.0 wrote reads, with a field a newer engine added", (store) => {
	mkdirSync(folderOf(store), { recursive: true });
	writeFileSync(join(folderOf(store), "record.json"), JSON.stringify({ ...SAVED_0_1_0[store], addedLater: true }));

	expect(readsOf(openState(dir))[store]()).toEqual([expect.objectContaining(SAVED_0_1_0[store])]);
});

test("a failed save of a new item leaves nothing behind, and a later save clears the card", () => {
	const state = openState(dir);

	mkdirSync(state.items.path("#9"), { recursive: true });
	const blocked = state.items.save("#9", tiny, {});

	expect(blocked.ok).toBe(false);
	expect(state.faults.list()).toHaveLength(1);
	rmSync(state.items.path("#9"), { recursive: true });
	expect(state.items.save("#9", tiny, {}).ok).toBe(true);
	expect(state.faults.list()).toEqual([]);
});

const readFile = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

for (const mode of ["before-op", "after-op"]) {
	test(`a kill ${mode} makes no duplicate on the provider`, () => {
		const script = join(import.meta.dir, "fixtures/kill-between.ts");
		const killed = spawnSync("bun", [script, dir, mode]);

		expect(killed.signal).toBe("SIGKILL");
		expect(readFile(join(dir, "provider.txt")).split("\n").filter(Boolean)).toHaveLength(mode === "before-op" ? 0 : 1);

		for (let times = 0; times < 2; times++) expect(spawnSync("bun", [script, dir, "finish"]).status).toBe(0);

		expect(readFile(join(dir, "provider.txt")).split("\n").filter(Boolean)).toHaveLength(1);
	});
}

test("a done op is skipped without asking the provider, and keys differ by attempt", async () => {
	const { ops } = openState(dir);
	const key = { itemId: "#68", run: "build", attempt: 1, op: "comment" };
	let asked = 0;
	let ran = 0;
	const provider = { holds: async () => (asked++, false), run: async () => void ran++ };

	expect(await ops.once(key, provider)).toBe("ran");
	expect(await ops.once(key, provider)).toBe("skipped");
	expect(await ops.once({ ...key, attempt: 2 }, provider)).toBe("ran");
	expect([asked, ran]).toEqual([0, 2]);
	expect(ops.state(key)).toBe("done");
});

test("one event read twice is saved once, and the first copy stays", () => {

	let tick = 0;
	const { events } = openState(dir, { now: () => ++tick });
	const answer = { source: "github-comment", sourceId: "4411", itemId: "#68", type: "answer", payload: { text: "yes" } };

	const first = events.add(answer);
	const second = events.add({ ...answer, payload: { text: "changed" } });

	expect([first.added, second.added]).toEqual([true, false]);
	expect(second.event.payload).toEqual({ text: "yes" });
	events.add({ ...answer, sourceId: "4412", payload: { text: "later" } });
	expect(events.list("#68").map((event) => event.sourceId)).toEqual(["4411", "4412"]);
	expect(events.list("#none")).toEqual([]);
});

test("the run's name is saved before launch and adopted after a restart", () => {
	const key = { itemId: "#68", run: "build", attempt: 1 };
	const before = openState(dir).runs;

	expect(before.begin(key, "hum #68 build 1").adopted).toBe(false);

	// The worker died before it learned the session id. The next one finds the name.
	const after = openState(dir).runs;
	const found = after.begin(key, "hum #68 build 1");

	expect(found.adopted).toBe(true);
	expect(found.record.sessionId).toBeUndefined();
	expect(found.saveSession("session-1").sessionId).toBe("session-1");
	expect(openState(dir).runs.begin(key, "hum #68 build 1").record.sessionId).toBe("session-1");
	expect(after.list("#68")).toHaveLength(1);
});

test("a run is adopted until its outcome is taken, then the next attempt starts fresh", () => {
	const key = { itemId: "#68", run: "build", attempt: 0 };
	const runs = openState(dir).runs;

	const begun = runs.begin(key, "hum #68 build #0");

	expect(runs.unended("#68", "build")?.attempt).toBe(0);
	expect(runs.unended("#68", "review")).toBeUndefined();
	begun.end();
	expect(runs.unended("#68", "build")).toBeUndefined();
	expect(openState(dir).runs.get(key)?.endedAt).toBeNumber();
});

test("a reader never sees a partial status file", async () => {
	const path = join(dir, "status.json");

	writeStatus(path, emptyStatus(ENGINE_VERSION, 0));
	const writer = spawn("bun", [join(import.meta.dir, "fixtures/status-writer.ts"), path, "600"], { stdio: "ignore" });
	const done = new Promise<void>((resolve) => writer.on("exit", () => resolve()));
	let finished = false;

	void done.then(() => (finished = true));
	let reads = 0;
	const distinct = new Set<number>();

	while (!finished) {
		const read = readStatus(path);

		expect(read.ok).toBe(true);

		if (read.ok) distinct.add(read.status.writtenAt);
		reads++;
		await new Promise((resolve) => setImmediate(resolve));
	}

	expect(reads).toBeGreaterThan(20);
	expect(distinct.size).toBeGreaterThan(5);
	expect(readdirSync(dir).filter((name) => !name.endsWith(".json"))).toEqual([]);
});

const statusFile = () => {
	const path = join(dir, "nested", "status.json");
	const status = emptyStatus(ENGINE_VERSION, 1000);

	status.workers = { mac: 990 };
	status.inFlight = [{ item: "#68", title: "Fix it", level: "low", state: "building", since: 900, unclear: true }];
	writeStatus(path, status);

	return { path, status };
};

test("the status file reads back as written, with every section, the engine version and an empty measure slot", () => {
	const { path, status } = statusFile();
	const read = readStatus(path);

	expect(read.ok && read.status).toEqual(status);
	expect(Object.keys(status)).toEqual(["format", "writtenAt", "workers", "engine", "questions", "cards", "inFlight", "merged", "choices", "rules", "possibleRepeats", "unusedMemory", "measure"]);
	expect(status.measure).toBeNull();
	expect(status.engine.version).toBe(ENGINE_VERSION);
});

test("a status that breaks its schema is not written, and the file keeps the last good one", () => {
	const { path, status } = statusFile();

	expect(() => writeStatus(path, { ...status, writtenAt: -1 })).toThrow();
	expect(readStatus(path).ok).toBe(true);
});

test("a status file that does not parse reads as unreadable, and one that is not there as missing", () => {
	const { path } = statusFile();

	writeFileSync(path, "{");
	expect(readStatus(path)).toMatchObject({ ok: false, reason: "unreadable" });
	expect(readStatus(join(dir, "none.json"))).toMatchObject({ ok: false, reason: "missing" });
});

test("a status file with fields a newer engine added reads, without those fields", () => {
	const { path, status } = statusFile();
	const card = { kind: "fault", key: "x:#1", item: "#1", code: "x", cause: "It broke.", fix: "Fix it.", since: 5 } as const;
	const choice = { item: "#1", text: "Chose short.", at: 5 };

	writeFileSync(path, JSON.stringify({ ...status, addedLater: 1, engine: { ...status.engine, addedLater: 1 }, cards: [{ ...card, addedLater: 1 }], choices: [{ ...choice, addedLater: 1 }] }));

	expect(readStatus(path)).toEqual({ ok: true, status: { ...status, cards: [card], choices: [choice] } });
});

test("a heartbeat with a field a newer engine added reads, without that field", () => {
	const path = join(dir, "heartbeat.json");
	const heartbeat = { time: 5, engineVersion: "0.1.0", configHash: "h", inFlight: [], intervalMs: 600_000 };

	writeFileSync(path, JSON.stringify({ ...heartbeat, addedLater: true }));

	expect(readHeartbeat(path)).toEqual(heartbeat);
});

test("a saved item whose envelope carries a field a newer engine added restores", async () => {
	const state = openState(dir);

	waitingItem(state, "#68");
	const file = state.items.path("#68");

	writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), addedLater: true }));

	const restored = await openState(dir).items.restore("#68", tiny);

	expect(restored.ok && restored.value?.getSnapshot().value).toBe("waiting");
});

const FAULT = { code: "x", item: "#1", cause: "It broke.", fix: "Fix it." };

test("a fault raised twice is one saved card, and clearing it removes it", () => {
	const { faults } = openState(dir, { now: () => 5 });

	expect(faults.raise(FAULT)).toBe(faults.raise(FAULT));
	expect(openState(dir).faults.list()).toHaveLength(1);
	faults.clear({ code: "x", item: "#1" });
	expect(openState(dir).faults.list()).toEqual([]);
});

test.each([
	["a fix of two lines", { code: "y", fix: "one\ntwo" }],
	["an action label too wide for its button", { code: "z", action: { label: "a label far over fourteen cells", answer: "retry" } }],
])("a fault card with %s is refused", (_, over) => {
	const { faults } = openState(dir, { now: () => 5 });

	expect(() => faults.raise({ ...FAULT, ...over })).toThrow();
});

test("the state folder is the git common dir's hum/, shared by worktrees", async () => {
	const repo = join(dir, "repo");

	mkdirSync(repo);
	spawnSync("git", ["init", "-q", repo]);
	spawnSync("git", ["-C", repo, "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "--allow-empty", "-m", "x"]);
	const tree = join(dir, "tree");

	spawnSync("git", ["-C", repo, "worktree", "add", "-q", tree, "-b", "other"]);
	const real = (path: string) => spawnSync("realpath", [path], { encoding: "utf8" }).stdout.trim();

	expect(real(await defaultStateDir(repo))).toBe(real(join(repo, ".git", "hum")));
	expect(real(await defaultStateDir(tree))).toBe(real(join(repo, ".git", "hum")));
	await expect(defaultStateDir(dir)).rejects.toThrow("not inside a git repository");
});
