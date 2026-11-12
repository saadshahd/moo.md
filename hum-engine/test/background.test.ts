import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { x } from "tinyexec";
import { BACKGROUND_CHECK_CODE, backgroundRunner, FALLBACK_CODE, backgroundSettings, HUM_PLUGIN, launchArgs, type Progress, progressOf, type Reading, startBackgroundRunner } from "../src/adapters/claude-bg.ts";
import { type Runner, type RunRequest, startRunner } from "../src/adapters/claude-p.ts";
import { readTranscript, billedTokens } from "../src/adapters/transcript.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { listFiles, listRecords } from "../src/state/fs.ts";
import { openState } from "../src/state/open.ts";
import { makeShim, SHIM_MODEL, type ShimSpec } from "./fixtures/shim.ts";
import { until } from "./fixtures/process.ts";
import { tempDir } from "./fixtures/temp.ts";

const MODEL = SHIPPED_DEFAULTS.models.light;
const CONFIG = { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.05 };
const STRUCTURED = { ok: true };

const setup = async (spec: ShimSpec = {}) => {
	const shim = makeShim(spec);
	const state = openState(tempDir("background"), { now: Date.now });
	const { runner } = await startRunner({ state, model: MODEL, binary: shim.binary, env: shim.env, now: Date.now });
	const background = backgroundRunner({ binary: shim.binary, env: shim.env, state, config: CONFIG, fallback: runner, now: Date.now });

	return { shim, state, runner, background };
};

const ask = (runner: Runner, over: Partial<RunRequest> = {}) => runner.run({ name: "hum #68 build #0", prompt: "do it", cwd: tmpdir(), model: MODEL, effort: "low", schema: { type: "object" }, ...over });

type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; iterations?: { type: string; input_tokens: number; output_tokens: number }[] };

const assistant = (id: string, usage: Usage) => JSON.stringify({ type: "assistant", message: { id, model: SHIM_MODEL, usage } });

const attachment = (timestamp: string) => JSON.stringify({ type: "attachment", timestamp, attachment: { type: "structured_output", data: STRUCTURED } });

const apiError = (error: string) => JSON.stringify({ type: "assistant", isApiErrorMessage: true, error });

test("a transcript sums tokens once per message id, counting the advisor's own calls, and reads the structured result and an API error", () => {
	const transcript = readTranscript(
		[
			assistant("m1", { input_tokens: 1, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 9 }),
			assistant("m1", { input_tokens: 1, output_tokens: 7, cache_creation_input_tokens: 100, cache_read_input_tokens: 9 }),
			assistant("m2", { input_tokens: 2, output_tokens: 3, iterations: [{ type: "message", input_tokens: 2, output_tokens: 3 }, { type: "advisor_message", input_tokens: 1000, output_tokens: 20 }] }),
			"not json, a row still being written",
			attachment("2026-11-08T10:00:00.000Z"),
			apiError("model_not_found"),
		].join("\n"),
	);

	expect(billedTokens(transcript)).toBe(1 + 7 + 100 + 2 + 3 + 1020);
	expect(transcript.structured).toEqual({ data: STRUCTURED, at: Date.parse("2026-11-08T10:00:00.000Z") });
	expect(transcript.apiError).toBe("model_not_found");
});

const NOW_MS = Date.parse("2026-11-08T10:00:00.000Z");

const reading = (over: Partial<Reading> & { structuredAt?: number; spent?: number }): Reading => ({
	transcript: {
		messages: over.spent === undefined ? {} : { m: { billed: over.spent, output: 0, cacheRead: 0, model: SHIM_MODEL } },
		structured: over.structuredAt === undefined ? undefined : { data: STRUCTURED, at: over.structuredAt },
		apiError: over.transcript?.apiError,
		limit: over.transcript?.limit,
	},
	stops: over.stops ?? [],
	job: "job" in over ? over.job : "working",
	jobOutputTokens: over.jobOutputTokens ?? 0,
});

const PROGRESS: [string, Reading, number | undefined, Progress["kind"]][] = [
	["a run still working", reading({ spent: 10 }), 100, "waiting"],
	["the first Stop, before the structured result", reading({ structuredAt: NOW_MS, stops: [NOW_MS - 1] }), 100, "waiting"],
	["a Stop after the structured result", reading({ structuredAt: NOW_MS, stops: [NOW_MS - 1, NOW_MS + 1] }), 100, "done"],
	["tokens past the cap", reading({ spent: 101 }), 100, "over-cap"],
	["a job in the failed state", reading({ job: "failed" }), 100, "failed"],
	["an API error row", reading({ transcript: { messages: {}, structured: undefined, apiError: "model_not_found", limit: undefined } }), 100, "failed"],
	["a usage-limit row", reading({ transcript: { messages: {}, structured: undefined, apiError: "rate_limit", limit: { resetsAt: NOW_MS, text: "You've hit your weekly limit" } } }), 100, "limit"],
	["output tokens only the job counts, past the cap", reading({ jobOutputTokens: 101 }), 100, "over-cap"],
	["a job that ended with no structured result", reading({ job: "done" }), 100, "failed"],
	["a run gone from the list with no result", reading({ job: undefined }), 100, "failed"],
	["no cap set", reading({ spent: 1_000_000 }), undefined, "waiting"],
];

test.each(PROGRESS)("progress: %s", (_name, at, cap, expected) => {
	expect(progressOf(at, cap).kind).toBe(expected);
});

test("run settings turn hum's plugin off, deny the GitHub writes and report the run to the stops folder, and the prompt stays out of the flags", () => {
	const settings = backgroundSettings(CONFIG, "/tmp/it's here/stops");
	const args = launchArgs({ name: "hum #68 build #0", model: MODEL, effort: "low", schema: { type: "object" }, settings });

	expect(settings).toMatchObject({ enabledPlugins: { [HUM_PLUGIN]: false }, permissions: { deny: expect.arrayContaining(["Bash(git push *)"]) } });
	expect(args.slice(0, 3)).toEqual(["--bg", "-n", "hum #68 build #0"]);
	expect(args).not.toContain("do it");
});

test("the run's hook files its report whole: the stops folder lists no record until the hook's input has ended", async () => {
	const stops = join(tempDir("stops"), "it's here");

	mkdirSync(stops);

	const hook = Bun.spawn(["sh", "-c", backgroundSettings(CONFIG, stops).hooks["Stop"]![0]!.hooks[0]!.command], { stdin: "pipe" });

	hook.stdin.write('{"session_id":');
	hook.stdin.flush();
	await until(() => listFiles(stops).length > 0);

	expect(listRecords(stops)).toEqual([]);

	hook.stdin.write('"s"}');
	hook.stdin.end();
	await hook.exited;

	expect(listRecords(stops).map((file) => JSON.parse(readFileSync(file, "utf8")))).toEqual([{ session_id: "s" }]);
});

test("a named run is a background agent: its prompt comes on stdin, its tokens are read from the transcript, and it is stopped and removed once its outcome is taken", async () => {
	const { shim, background } = await setup({ script: [{}, { structured: { done: 1 }, spend: 7 }] });
	const sessions: string[] = [];
	const outcome = await ask(background, { prompt: "build the thing", onSession: (id) => sessions.push(id) });

	expect(outcome).toMatchObject({ kind: "finished", structured: { done: 1 }, tokens: 8, isError: false, models: [SHIM_MODEL] });
	expect(sessions).toHaveLength(1);

	const [launch, ...after] = shim.background();

	expect(launch).toMatchObject({ cmd: "bg", name: "hum #68 build #0", prompt: "build the thing" });
	expect(launch?.argv).not.toContain("build the thing");
	expect(after.map(({ cmd }) => cmd)).toEqual(["stop", "rm"]);
	expect(shim.agents()).toEqual([]);
});

test("once a run's outcome is taken its hook reports leave the stops folder, and another session's stay", async () => {
	const { state, background } = await setup({ script: [{}, { structured: { done: 1 } }] });
	const other = join(state.stops, "other.json");

	mkdirSync(state.stops, { recursive: true });
	writeFileSync(other, JSON.stringify({ hook_event_name: "Stop", session_id: "another session" }));

	expect(await ask(background)).toMatchObject({ kind: "finished", structured: { done: 1 } });
	expect(listRecords(state.stops)).toEqual([other]);
});

test("a cheap model call and a run with no name are never background agents", async () => {
	const { shim, background } = await setup();

	await ask(background, { call: "judgment" });
	await ask(background, { name: undefined });

	expect(shim.background()).toEqual([]);
	expect(shim.calls()).toHaveLength(2);
});

test("when the background service refuses a run it goes on as claude -p under the same name, with one card that says why", async () => {
	const { shim, state, background } = await setup({ bgDown: true, script: [{}, { structured: { done: 1 } }] });

	expect(await ask(background)).toMatchObject({ kind: "finished", structured: { done: 1 } });
	expect(shim.calls().at(-1)?.argv).toContain("hum #68 build #0");
	expect(state.faults.list().map(({ code }) => code)).toEqual([FALLBACK_CODE]);
	expect(state.faults.list()[0]?.cause).toContain("background service is not running");
});

test("a run past its token cap is stopped partway, and the tokens it spent are reported", async () => {
	const { shim, background } = await setup({ script: [{}, { spend: 500, hang: true }] });
	const outcome = await ask(background, { tokenCap: 100 });

	expect(outcome).toMatchObject({ kind: "over-cap", tokens: 501 });
	expect(shim.background().map(({ cmd }) => cmd)).toEqual(["bg", "stop", "rm"]);
	expect(shim.agents()).toEqual([]);
});

test("a run that fails is a finished error with the API's text", async () => {
	const { background } = await setup({ script: [{}, { error: "model_not_found" }] });

	expect(await ask(background)).toMatchObject({ kind: "finished", isError: true, subtype: "error_during_execution", text: "model_not_found" });
});

test("a worker killed after the launch and before the session id is saved finds its run by name on restart: one run, its id saved", async () => {
	const shim = makeShim({ script: [{}, { structured: { done: 1 }, sleep: 400 }] });
	const dir = tempDir("background-d1");
	const name = "hum #68 build #0";
	const key = { itemId: "#68", run: "build", attempt: 0 };

	const died = await x(process.execPath, [join(import.meta.dir, "fixtures/launch-and-die.ts"), dir, shim.binary, name], { nodeOptions: { env: { ...process.env, ...shim.env } } });

	expect(died.exitCode).not.toBe(0);

	const state = openState(dir, { now: Date.now });
	const { runner } = await startRunner({ state, model: MODEL, binary: shim.binary, env: shim.env, now: Date.now });
	const background = backgroundRunner({ binary: shim.binary, env: shim.env, state, config: CONFIG, fallback: runner, now: Date.now });

	expect(state.runs.unended("#68", "build")?.sessionId).toBeUndefined();

	const begun = state.runs.begin(key, { name });
	const outcome = await ask(background, { onSession: (id) => begun.saveSession(id) });

	expect(begun.adopted).toBe(true);
	expect(outcome).toMatchObject({ kind: "finished", structured: { done: 1 } });
	expect(shim.background().filter(({ cmd }) => cmd === "bg")).toHaveLength(1);
	expect(state.runs.get(key)?.sessionId).toBe(outcome.kind === "finished" ? outcome.sessionId : undefined);
});

test("the start check starts one background run and keeps it", async () => {
	const good = makeShim();
	const goodState = openState(tempDir("background-check"), { now: Date.now });
	const started = await startBackgroundRunner({ state: goodState, model: MODEL, binary: good.binary, env: good.env, config: CONFIG, repo: tmpdir(), now: Date.now });

	expect(started.check).toMatchObject({ kind: "finished", structured: STRUCTURED });
	expect(good.background().filter(({ cmd }) => cmd === "bg")).toHaveLength(1);
	expect(goodState.faults.list().map(({ code }) => code)).toEqual([]);
});

test("a start check that cannot start a background run leaves one card, and every run goes on as claude -p", async () => {
	const down = makeShim({ bgDown: true });
	const downState = openState(tempDir("background-check"), { now: Date.now });
	const fallen = await startBackgroundRunner({ state: downState, model: MODEL, binary: down.binary, env: down.env, config: CONFIG, repo: tmpdir(), now: Date.now });

	expect(downState.faults.list().map(({ code }) => code)).toEqual([BACKGROUND_CHECK_CODE]);
	expect(downState.faults.list()[0]?.cause).toContain("background service is not running");
	expect(await ask(fallen.runner)).toMatchObject({ kind: "finished" });
});

test("a background start check that never answers is stopped at commandTimeoutSeconds and leaves one card that says so", async () => {
	const shim = makeShim({ script: [{}, { hang: true }] });
	const state = openState(tempDir("background-check"), { now: Date.now });
	const started = await startBackgroundRunner({ state, model: MODEL, binary: shim.binary, env: shim.env, config: { ...CONFIG, commandTimeoutSeconds: 2 }, repo: tmpdir(), now: Date.now });

	expect(started.check.kind).toBe("stopped");
	expect(state.faults.list().map(({ code, cause }) => ({ code, cause }))).toEqual([{ code: BACKGROUND_CHECK_CODE, cause: expect.stringContaining("no result within 2 seconds") }]);
});

test("a claude agents list in a shape hum does not read fails the run with a card, and no run starts", async () => {
	const { background, shim, state } = await setup({ agentsWrapped: true });

	await expect(ask(background)).rejects.toThrow("claude agents --json");
	expect(shim.background().filter(({ cmd }) => cmd === "bg")).toHaveLength(0);
	expect(state.faults.list().map(({ code }) => code)).toEqual(["agents-unread"]);
});

/** A usage-limit row as Claude Code writes it into a transcript. */
const LIMIT_ROW = {
	type: "assistant",
	isApiErrorMessage: true,
	error: "rate_limit",
	message: { model: "<synthetic>", content: [{ type: "text", text: "You've hit your weekly limit · resets Oct 7 at 5pm (Europe/London)" }] },
	quotaLimits: { status: "rejected", resetsAt: 1791388800, rateLimitType: "seven_day" },
};

test("a usage-limit row carries its reset time, read as epoch ms, and its words", () => {
	expect(readTranscript(JSON.stringify(LIMIT_ROW)).limit).toEqual({ resetsAt: 1_791_388_800_000, text: "You've hit your weekly limit · resets Oct 7 at 5pm (Europe/London)" });
});

const HOUR_S = 3600;

test("a background run that hits a usage limit ends limited at its reset time, and no named run starts before then", async () => {
	const resetsAt = Math.floor(Date.now() / 1000) + HOUR_S;
	const { shim, state, background } = await setup({ script: [{}, { rejectUntil: resetsAt, error: "You've hit your limit" }] });

	expect(await ask(background)).toEqual({ kind: "limited", until: resetsAt * 1000 });
	expect(state.limit.get("runner")).toEqual({ until: resetsAt * 1000 });
	expect(await ask(background, { name: "hum #68 plan #0" })).toEqual({ kind: "limited", until: resetsAt * 1000 });
	expect(shim.background().filter(({ cmd }) => cmd === "bg")).toHaveLength(1);
	expect(shim.agents()).toEqual([]);
});

test("a background run's usage limit with no reset time hum can read holds every run with one card", async () => {
	const { state, background } = await setup({ script: [{}, { error: "You've hit your limit" }] });

	expect(await ask(background)).toMatchObject({ kind: "held", card: { code: "limit-unparsed" } });
	expect(state.faults.list().map(({ code }) => code)).toEqual(["limit-unparsed"]);
	expect(state.limit.list()).toEqual([]);
});

test("output tokens the job counts beyond its transcript are billed to the run", async () => {
	const { background } = await setup({ script: [{}, { structured: { done: 1 }, spend: 7, jobTokens: 50 }] });

	expect(await ask(background)).toMatchObject({ kind: "finished", tokens: 8 + (50 - 7) });
});
