import { afterAll, beforeAll, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { x } from "tinyexec";
import { z } from "zod";
import { railName } from "../src/adapters/rail.ts";
import { ROW_REFUSED_CODE } from "../src/adapters/rail-rows.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { type ProgramEntry, programEntry, programFields } from "../src/service/program.ts";
import { writeSetup } from "../src/setup/write.ts";
import { readHeartbeat, readStatus } from "../src/status/file.ts";
import type { Status } from "../src/status/format.ts";
import { SECOND_MS } from "../src/time.ts";
import { installedSkills } from "./fixtures/config.ts";
import { OWNER } from "./fixtures/identity.ts";
import { ROUNDUP_APP, type Rig, SLOTS_DIR, startRig } from "./fixtures/rows-rig.ts";

const live = process.env.HUM_LIVE === "1" && existsSync(ROUNDUP_APP);

if (!live) console.log("skip hum serve as roundup's program: set HUM_LIVE=1 on a Mac with roundup.app installed; the rig starts a throwaway roundup Daemon on a fresh data folder with a stub claude, and makes no model call");

const RIG_MS = 180_000;

/** How often hum serve ticks on the rig. */
const TICK_SECONDS = 2;

/** This checkout's engine, which the rig's repo installs as a package manager does. */
const ENGINE = join(import.meta.dir, "..");

const ProgramRun = z.looseObject({ state: z.string(), terminalId: z.string().optional() });

const Terminal = z.looseObject({ id: z.string(), program_pid: z.int().nullish(), status: z.looseObject({ kind: z.string(), label: z.string() }).nullish() });

const Node = z.looseObject({ id: z.string(), name: z.string(), kind: z.string(), status: z.looseObject({ kind: z.string() }).nullish() });

const Made = z.looseObject({ id: z.union([z.int(), z.string()]) });

/** The scratch repo turns on, at project scope as an owner's project does, the moo.md plugins hum's roles name. */
const PROJECT_SETTINGS = { enabledPlugins: { "hope@moo.md": true, "sound@moo.md": true } };

let rig: Rig;
let repo: string;
let entry: Required<ProgramEntry>;
let printed: unknown;
let item: string;

const waitFor = async <T>(read: () => Promise<T | undefined>, what: string, ms = 90_000, everyMs = 200): Promise<T> => {
	for (const deadline = Date.now() + ms; ; await Bun.sleep(everyMs)) {
		const found = await read();

		if (found !== undefined) return found;

		if (Date.now() > deadline) throw new Error(`the rig timed out waiting for ${what}`);
	}
};

/** The Terminal roundup runs the program in, while it runs. */
const programTerminal = async () => {
	const run = ProgramRun.parse(await rig.user.call("project.programRun"));

	return run.state === "running" ? z.array(Terminal).parse(await rig.user.call("terminal.list")).find(({ id }) => id === run.terminalId) : undefined;
};

/** The program's Terminal once the status roundup shows on its row has a label that `matches`. */
const shownStatus = (matches: RegExp) =>
	waitFor(async () => {
		const terminal = await programTerminal();

		return terminal?.status && matches.test(terminal.status.label) ? { ...terminal, status: terminal.status } : undefined;
	}, `the program's row to show a status matching ${matches}`);

const childrenOf = async (pid: number | null | undefined): Promise<string[]> => (await x("pgrep", ["-P", String(pid)])).stdout.split("\n").filter(Boolean);

const isAlive = (pid: string): boolean => {
	try {
		process.kill(Number(pid), 0);

		return true;
	} catch {
		return false;
	}
};

/** The status hum's worker last wrote. */
const humStatus = () => readStatus(join(repo, ".git", "hum", "status.json"));

/** The heartbeat hum's worker last wrote, as it ends a tick. */
const humHeartbeat = () => readHeartbeat(join(repo, ".git", "hum", "heartbeat.json"));

/** How many start checks hum's workers made: each `hum work` makes one as it starts, before its first tick. */
const startChecks = (): number => readFileSync(join(rig.dir, "stub-p.log"), "utf8").split("\n").filter((line) => line === "ok").length;

/** The Program's Terminal once roundup started the Program again in a Terminal other than `was`. */
const programBack = (was: string, what: string) =>
	waitFor(async () => {
		const terminal = await programTerminal();

		return terminal && terminal.id !== was ? terminal : undefined;
	}, what);

/** Whether the status shows the rig's item in flight in its build. */
const isBuilding = ({ inFlight }: Status) => inFlight.some((flight) => flight.item === item && flight.state === "building");

/** The rows of every attempt at the item's build. */
const buildRows = async () => z.array(Node).parse(await rig.user.call("rail.tree")).filter((node) => node.kind === "agent" && node.name.startsWith(railName(`hum ${item} build #`)));

const startProgram = async ({ argv, dir, adoptDir }: ProgramEntry): Promise<void> => {
	await rig.stopProgram();
	await rig.user.call("project.setProgram", adoptDir === undefined ? { argv, dir } : { argv, dir, adoptDir });
	await rig.user.call("project.startProgram");
};

beforeAll(async () => {
	if (!live) return;

	rig = await startRig(undefined, { slots: 0 });
	repo = join(rig.dir, "repo");
	mkdirSync(join(repo, "node_modules", "@moo.md"), { recursive: true });
	symlinkSync(ENGINE, join(repo, "node_modules", "@moo.md", "hum"));
	appendFileSync(join(repo, ".git", "info", "exclude"), "node_modules/\n");
	mkdirSync(join(repo, ".claude"), { recursive: true });
	writeFileSync(join(repo, ".claude", "settings.json"), JSON.stringify(PROJECT_SETTINGS));

	const setup = writeSetup(
		repo,
		{
			hum: {
				checks: ["true"],
				runPlaces: ["mac"],
				integrations: { "work-source": "roundup", questions: "roundup", answers: "roundup" },
				runSlots: { ...SHIPPED_DEFAULTS.runSlots, enabled: true },
				runners: 1,
				defaultKind: "docs",
				tickIntervalSeconds: TICK_SECONDS,
				claimExpirySeconds: 600,
			},
			waitHours: {},
		},
		{ installedSkills: installedSkills(), gitIdentity: { found: true, identity: OWNER } },
	);

	if (!setup.ok) throw new Error(setup.refusal.message);

	printed = setup.program?.fields;
	entry = programEntry(repo, SHIPPED_DEFAULTS.runSlots.pool, process.execPath);

	for (const args of [["add", "-A"], ["commit", "-qm", "hum setup"], ["push", "-q", "origin", "main"]]) await x("git", args, { nodeOptions: { cwd: repo }, throwOnError: true });

	const hum = Made.parse(await rig.user.call("rail.createWorkstream", { name: SHIPPED_DEFAULTS.roundupWorkstream })).id;
	const todo = Made.parse(await rig.user.call("todo.create", { title: "rig docs item" })).id;

	await rig.user.call("todo.move", { id: todo, home: hum });
	item = String(todo);
}, RIG_MS);

afterAll(async () => {
	if (live) await rig.stop();
}, RIG_MS);

test.skipIf(!live)(
	"with the values setup printed, hum serve runs as the Program and starts its item's build as a Rail row in a run slot",
	async () => {
		expect(printed).toEqual(programFields(entry));

		await startProgram(entry);

		await waitFor(async () => ((await buildRows()).length > 0 ? true : undefined), "the build row");
		await waitFor(async () => (existsSync(join(rig.dir, "cwd-build.txt")) ? true : undefined), "the build row's session");

		expect(readFileSync(join(rig.dir, "cwd-build.txt"), "utf8")).toStartWith(`${join(realpathSync(repo), SLOTS_DIR)}/`);
		expect(JSON.stringify(await rig.events())).not.toContain("outside_program_directory");
		expect(readFileSync(join(rig.dir, "stub-p.log"), "utf8").split("\n").filter((line) => line.startsWith("refused"))).toEqual([]);
	},
	RIG_MS,
);

test.skipIf(!live)(
	"a hum serve stopped mid-build, as an update stops it, leaves its build row running, and back again it takes that row over and starts no second one",
	async () => {
		const before = await shownStatus(/^#\d+ rig docs item: building/u);
		const [row] = await buildRows();

		process.kill(before.program_pid ?? 0, "SIGTERM");

		await programBack(before.id, "hum serve back");

		const backAt = Date.now();

		await waitFor(async () => {
			const read = humStatus();

			return read.ok && read.status.writtenAt > backAt && isBuilding(read.status) ? true : undefined;
		}, "the restarted worker to build its item");
		await Bun.sleep(3 * TICK_SECONDS * SECOND_MS);

		const after = humStatus();

		expect(after.ok && { building: isBuilding(after.status), refused: after.status.cards.filter(({ code }) => code === ROW_REFUSED_CODE) }).toEqual({ building: true, refused: [] });
		expect((await buildRows()).map(({ id, status }) => ({ id, done: status?.kind === "done" }))).toEqual([{ id: row?.id ?? "no build row", done: false }]);
	},
	RIG_MS,
);

test.skipIf(!live)(
	"the Program's row shows hum's status, and a killed hum serve comes back with its worker gone and its status shown again",
	async () => {
		const before = await shownStatus(/^#\d+ rig docs item: building/u);
		const workers = await childrenOf(before.program_pid);

		expect(before.status.kind).toBe("working");
		expect(workers).toHaveLength(1);

		process.kill(before.program_pid ?? 0, "SIGKILL");

		const after = await waitFor(async () => {
			const terminal = await programTerminal();

			return terminal && terminal.id !== before.id && terminal.status?.kind === "working" ? terminal : undefined;
		}, "the Program back with its status");

		expect(after.status?.label).toMatch(/^#\d+ rig docs item/u);
		expect(workers.filter(isAlive)).toEqual([]);
	},
	RIG_MS,
);

test.skipIf(!live)(
	"a hum serve stopped before its worker's first tick ended stops that worker and exits, and roundup starts it again",
	async () => {
		await rig.stopProgram();

		const checks = startChecks();
		const restartedAt = Date.now();

		await startProgram(entry);

		const starting = await waitFor(programTerminal, "the Program's Terminal");

		const [worker] = await waitFor(async () => {
			const children = await childrenOf(starting.program_pid);

			return children.length > 0 ? children : undefined;
		}, "its worker");

		await waitFor(async () => (startChecks() > checks ? true : undefined), "its worker's start check", 90_000, 10);

		const beat = humHeartbeat();

		process.kill(starting.program_pid ?? 0, "SIGTERM");

		expect(worker).toBeDefined();
		expect(beat?.time).toBeLessThan(restartedAt);

		await programBack(starting.id, "hum serve back after a stop before its worker's first tick ended");

		expect([worker ?? "no worker"].filter(isAlive)).toEqual([]);
		expect((await buildRows()).filter(({ status }) => status?.kind !== "done")).toHaveLength(1);
	},
	RIG_MS,
);

test.skipIf(!live)(
	"after hum serve comes back, it takes its item back at once, long before the claim's 600 s expiry: hum takes the row's answer and starts no second row",
	async () => {
		writeFileSync(join(rig.dir, "go-build"), "");

		const rows = await waitFor(async () => {
			const found = await buildRows();

			return found.every((row) => row.status?.kind === "done") ? found : undefined;
		}, "hum to take the build's answer and stop its row");

		expect(rows).toHaveLength(1);
		expect(readFileSync(join(rig.dir, "stub-build.log"), "utf8")).toContain("answer saved");
		expect((await shownStatus(/^(?!#\d+ rig docs item: building)/u)).status.label).not.toContain("building");
	},
	RIG_MS,
);

test.skipIf(!live)(
	"an entry that differs from the one setup printed makes hum serve show an error on its row naming the difference, start no worker, and stay up",
	async () => {
		await startProgram({ argv: entry.argv, dir: entry.dir });

		const shown = await shownStatus(/Worktree path/u);

		expect(shown.status.kind).toBe("error");
		expect(shown.status.label).toContain('its Worktree path is "", where setup printed ".hum-slots"');

		await Bun.sleep(3000);

		const still = await programTerminal();

		expect(still?.id).toBe(shown.id);
		expect(await childrenOf(still?.program_pid)).toEqual([]);
	},
	RIG_MS,
);

test.skipIf(!live)(
	"a worker that keeps crashing makes hum serve give up and stay up with the error on its row, since roundup would start it again after any exit",
	async () => {
		const file = join(repo, ".hum", "hum.json");

		writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), runners: "two", maxCrashes: 2, restartBackoff: { firstSeconds: 1, maxSeconds: 1 } }));
		await startProgram(entry);

		const shown = await shownStatus(/Restarts have stopped/u);

		expect(shown.status.kind).toBe("error");

		await Bun.sleep(3000);

		expect((await programTerminal())?.id).toBe(shown.id);
	},
	RIG_MS,
);
