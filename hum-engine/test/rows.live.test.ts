import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { railName, ROW_STOPPED } from "../src/adapters/rail-rows.ts";
import { HUM_EXT } from "../src/adapters/roundup-rpc.ts";
import { runKey } from "../src/adapters/run-answer.ts";
import { ROUNDUP_APP, type Rig, startRig } from "./fixtures/rows-rig.ts";

const live = process.env.HUM_LIVE === "1" && existsSync(ROUNDUP_APP);

if (!live) console.log("skip Rail row runs: set HUM_LIVE=1 on a Mac with roundup.app installed; the rig starts a throwaway roundup Daemon on a fresh data folder with a stub claude, and makes no model call");

const SCENARIO_MS = 120_000;

let rig: Rig;

beforeAll(async () => {
	if (live) rig = await startRig();
}, SCENARIO_MS);

afterAll(async () => {
	if (live) await rig.stop();
}, SCENARIO_MS);

const Outcome = z.looseObject({ kind: z.string(), subtype: z.string().optional(), text: z.string().optional(), structured: z.unknown().optional() });

const Result = z.looseObject({ error: z.string().optional(), outcome: Outcome.optional() });

const Node = z.looseObject({ id: z.string(), name: z.string(), kind: z.string(), status: z.looseObject({ kind: z.string() }).nullish() });

const DONE = { status: "done", pullRequest: { title: "rig change", body: "rig body" } };

const runName = (scenario: string): string => `hum 1 ${scenario} #1`;

const rowsOf = async (scenario: string) => z.array(Node).parse(await rig.user.call("rail.tree")).filter((node) => node.kind === "agent" && node.name === railName(runName(scenario)));

const liveRow = async (scenario: string): Promise<string> => {
	for (;;) {
		const found = (await rowsOf(scenario)).find((node) => node.status?.kind !== "done");

		if (found) return found.id;

		await Bun.sleep(100);
	}
};

/** Runs `scenario` as the Project's program, doing `during` while it runs, and returns the outcome it wrote. */
const run = async (scenario: string, during: () => Promise<void> = async () => {}) => {
	await rig.runProgram(scenario);
	await during();

	const result = Result.parse(await rig.resultOf(scenario));

	await rig.stopProgram();
	expect(result.error).toBeUndefined();

	return result.outcome;
};

const rigFile = (name: string): string => (existsSync(join(rig.dir, name)) ? readFileSync(join(rig.dir, name), "utf8") : "");

const stubLog = (scenario: string): string => rigFile(`stub-${scenario}.log`);

const Sent = z.looseObject({ to: z.string() });

/** The notes hum sent `row`, as roundup's events record them. */
const notesTo = async (row: string) => (await rig.events()).filter(({ name, data }) => name === "message.sent" && Sent.safeParse(data).data?.to === row && JSON.stringify(data).includes(HUM_EXT));

const noteTo = async (row: string): Promise<void> => {
	while ((await notesTo(row)).length === 0) await Bun.sleep(100);
};

/** Stops the program mid-run and checks that its run came back stopped, as `hum work`'s does on its way out. */
const stopMidRun = async (scenario: string): Promise<void> => {
	await rig.stopProgram();
	expect(Result.parse(await rig.resultOf(scenario, 10_000, "aborted")).outcome).toEqual({ kind: "stopped" });
};

test.skipIf(!live)(
	"a run finishes with its answer, hum stops its row, and the run's key is in no Pad, order, argv or event",
	async () => {
		expect(await run("finish")).toMatchObject({ kind: "finished", subtype: "success", structured: DONE });

		const rows = await rowsOf("finish");
		const key = runKey(rig.stateDir, runName("finish"));
		const brief = await rig.user.call("pad.read", { name: railName(`${runName("finish")} brief`) });
		const seen = [brief, rows, await rig.events(), ...["argv-finish.txt", "stub-finish.log", "rupd.log", "rupd.err"].map(rigFile)];

		expect(rows.map((row) => row.status?.kind)).toEqual(["done"]);
		expect(rigFile("key-finish.txt")).toBe(key);
		expect(JSON.stringify(seen)).not.toContain(key);
	},
	SCENARIO_MS,
);

test.skipIf(!live)(
	"a bad answer is refused with what to fix, and the fixed answer is taken",
	async () => {
		expect(await run("fix")).toMatchObject({ kind: "finished", subtype: "success", structured: DONE });
		expect(stubLog("fix")).toMatch(/exit 1: [\s\S]*refused:[\s\S]*status[\s\S]*exit 0: answer saved/u);
	},
	SCENARIO_MS,
);

test.skipIf(!live)(
	"an answer saved without the run's key is ignored",
	async () => {
		expect(await run("keyless")).toMatchObject({ kind: "finished", subtype: "success", structured: DONE });
	},
	SCENARIO_MS,
);

test.skipIf(!live)(
	"a row that ends a turn with no answer gets one note, and hum stops it after a second such turn",
	async () => {
		const outcome = await run("silent");
		const [row] = await rowsOf("silent");

		expect(outcome).toMatchObject({ kind: "finished", subtype: ROW_STOPPED });
		expect(await notesTo(row?.id ?? "")).toHaveLength(1);
		expect(row?.status?.kind).toBe("done");
	},
	SCENARIO_MS,
);

test.skipIf(!live)(
	"a row the owner stops reports stopped",
	async () => {
		const outcome = await run("stopped", async () => {
			await rig.user.call("agent.stop", { id: await liveRow("stopped") });
		});

		expect(outcome).toMatchObject({ kind: "finished", subtype: ROW_STOPPED });
		expect(outcome?.text).toContain("ended before it answered");
	},
	SCENARIO_MS,
);

test.skipIf(!live)(
	"a hum stopped mid-run leaves its row running, and the restarted hum takes it over and starts no second one",
	async () => {
		const outcome = await run("restart", async () => {
			const row = await liveRow("restart");

			await stopMidRun("restart");
			await rig.runProgram("restart");
			await Bun.sleep(1000);
			writeFileSync(join(rig.dir, "go-restart"), "");
			expect((await rowsOf("restart")).map(({ id }) => id)).toEqual([row]);
		});

		expect(outcome).toMatchObject({ kind: "finished", subtype: "success", structured: DONE });
		expect(await rowsOf("restart")).toHaveLength(1);
	},
	SCENARIO_MS,
);

test.skipIf(!live)(
	"a restarted hum keeps the note the last one sent: it sends no second note and takes the answer that follows",
	async () => {
		let row = "";

		const outcome = await run("silent-restart", async () => {
			row = await liveRow("silent-restart");
			await noteTo(row);
			await stopMidRun("silent-restart");
			await rig.runProgram("silent-restart");
			await Bun.sleep(1000);
			expect((await rowsOf("silent-restart")).map(({ id, status }) => [id, status?.kind === "done"])).toEqual([[row, false]]);
			writeFileSync(join(rig.dir, "go-silent-restart"), "");
		});

		expect(outcome).toMatchObject({ kind: "finished", subtype: "success", structured: DONE });
		expect(await notesTo(row)).toHaveLength(1);
	},
	SCENARIO_MS,
);
