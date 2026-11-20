import { afterAll, beforeAll, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { x } from "tinyexec";
import { z } from "zod";
import { railName } from "../src/adapters/rail.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { type ProgramEntry, programEntry, programFields } from "../src/service/program.ts";
import { writeSetup } from "../src/setup/write.ts";
import { installedSkills } from "./fixtures/config.ts";
import { OWNER } from "./fixtures/identity.ts";
import { ROUNDUP_APP, type Rig, SLOTS_DIR, startRig } from "./fixtures/rows-rig.ts";

const live = process.env.HUM_LIVE === "1" && existsSync(ROUNDUP_APP);

if (!live) console.log("skip hum serve as roundup's program: set HUM_LIVE=1 on a Mac with roundup.app installed; the rig starts a throwaway roundup Daemon on a fresh data folder with a stub claude, and makes no model call");

const RIG_MS = 180_000;

const CLI = join(import.meta.dir, "..", "src", "cli", "main.ts");

const ProgramRun = z.looseObject({ state: z.string(), terminalId: z.string().optional() });

const Terminal = z.looseObject({ id: z.string(), program_pid: z.int().nullish(), status: z.looseObject({ kind: z.string(), label: z.string() }).nullish() });

const Node = z.looseObject({ id: z.string(), name: z.string(), kind: z.string(), status: z.looseObject({ kind: z.string() }).nullish() });

const Made = z.looseObject({ id: z.union([z.int(), z.string()]) });

let rig: Rig;
let repo: string;
let entry: Required<ProgramEntry>;
let printed: unknown;
let item: string;

const waitFor = async <T>(read: () => Promise<T | undefined>, what: string, ms = 90_000): Promise<T> => {
	for (const deadline = Date.now() + ms; ; await Bun.sleep(200)) {
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

const buildRows = async () => z.array(Node).parse(await rig.user.call("rail.tree")).filter((node) => node.kind === "agent" && node.name === railName(`hum ${item} build #0`));

const startProgram = async ({ argv, dir, adoptDir }: ProgramEntry): Promise<void> => {
	await rig.stopProgram();
	await rig.user.call("project.setProgram", adoptDir === undefined ? { argv, dir } : { argv, dir, adoptDir });
	await rig.user.call("project.startProgram");
};

beforeAll(async () => {
	if (!live) return;

	rig = await startRig(undefined, { slots: 0 });
	repo = join(rig.dir, "repo");
	mkdirSync(join(repo, "node_modules", ".bin"), { recursive: true });
	symlinkSync(CLI, join(repo, "node_modules", ".bin", "hum"));
	appendFileSync(join(repo, ".git", "info", "exclude"), "node_modules/\n");

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
				tickIntervalSeconds: 2,
				claimExpirySeconds: 8,
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
	"after hum serve comes back, its item resumes on the same row once the old claim lapses: hum takes the row's answer and starts no second row",
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
