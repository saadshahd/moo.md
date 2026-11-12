import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Runner, type RunnerOptions, type RunRequest, runArgs, startRunner, succeeded } from "../src/adapters/claude-p.ts";
import { parseLimit } from "../src/adapters/limit.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { openState } from "../src/state/open.ts";
import { isAlive, until } from "./fixtures/process.ts";
import { makeShim, type ShimSpec } from "./fixtures/shim.ts";
import { tempDir } from "./fixtures/temp.ts";

const NOW = 1_800_000_000_000;
const MODEL = SHIPPED_DEFAULTS.models.light;

const setup = async (spec: ShimSpec = {}, extra: Partial<RunnerOptions> & { clock?: { at: number } } = {}) => {
	const shim = makeShim(spec);
	const state = openState(tempDir("runner"));
	const { clock = { at: NOW }, ...rest } = extra;
	const { check, runner } = await startRunner({ state, model: MODEL, binary: shim.binary, env: shim.env, now: () => clock.at, lockBackoffMs: 1, ...rest });

	return { shim, state, runner, check, clock };
};

const ask = (runner: Runner, over: Partial<RunRequest> = {}) => runner.run({ prompt: "do it", cwd: tmpdir(), model: MODEL, effort: "low", schema: { type: "object" }, ...over });

const RUN = { model: "m", effort: "low", schema: { type: "object" }, sessionId: "11111111-1111-4111-8111-111111111111" } as const;

test("a run's flags start with stream-json output and hold the five flags", () => {
	const args = runArgs(RUN);

	expect(args.slice(0, 4)).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);

	for (const flag of ["--model", "--effort", "--json-schema", "--settings", "--session-id"]) expect(args).toContain(flag);
});

test.each(["--bare", "--resume", "--continue", "-r", "-c"])("a run's flags never hold %s", (banned) => {
	expect(runArgs(RUN)).not.toContain(banned);
});

test("a model call keeps no session, loads no settings source, tool or hook, and draws in the default style", () => {
	const judging = runArgs({ ...RUN, call: "judgment" });

	expect(judging).toContain("--no-session-persistence");
	expect(judging.slice(judging.indexOf("--setting-sources"), judging.indexOf("--setting-sources") + 2)).toEqual(["--setting-sources", ""]);
	expect(judging.slice(judging.indexOf("--tools"), judging.indexOf("--tools") + 2)).toEqual(["--tools", ""]);
	expect(JSON.parse(judging[judging.indexOf("--settings") + 1] ?? "{}")).toMatchObject({ disableAllHooks: true, outputStyle: "default" });
});

test("a usage-limit message parses to limited(until), and no call is made until then", async () => {
	const until = Math.floor(NOW / 1000) + 3600;
	const { runner, shim, clock, check } = await setup({ script: [{}, { error: `Claude usage limit reached|${until}` }, {}] });

	expect(check.kind).toBe("finished");
	expect(await ask(runner)).toEqual({ kind: "limited", until: until * 1000 });
	expect(await ask(runner)).toEqual({ kind: "limited", until: until * 1000 });
	expect(shim.calls()).toHaveLength(2);

	clock.at = until * 1000 + 1;

	const after = await ask(runner);

	expect(after.kind === "finished" && succeeded(after)).toBe(true);
	expect(shim.calls()).toHaveLength(3);
});

test("a runner started while a saved limit stands makes no call until the limit ends, then checks and runs", async () => {
	const until = Math.floor(NOW / 1000) + 3600;
	const first = await setup({ script: [{}, { error: `Claude usage limit reached|${until}` }, {}, {}] });

	await ask(first.runner);

	const restarted = await startRunner({ state: first.state, model: MODEL, binary: first.shim.binary, env: first.shim.env, now: () => first.clock.at });

	expect(restarted.check).toEqual({ kind: "limited", until: until * 1000 });
	expect(await ask(restarted.runner)).toEqual({ kind: "limited", until: until * 1000 });
	expect(first.shim.calls()).toHaveLength(2);

	first.clock.at = until * 1000 + 1;

	const after = await ask(restarted.runner);

	expect(after.kind === "finished" && succeeded(after)).toBe(true);
	expect(first.shim.calls()).toHaveLength(4);
});

test("a start check the limit refused is made again once the limit has ended, so runs resume without a restart", async () => {
	const until = Math.floor(NOW / 1000) + 3600;
	const { runner, shim, clock, check } = await setup({ script: [{ error: `Claude usage limit reached|${until}` }, {}, {}] });

	expect(check).toEqual({ kind: "limited", until: until * 1000 });
	expect(await ask(runner)).toEqual({ kind: "limited", until: until * 1000 });
	expect(shim.calls()).toHaveLength(1);

	clock.at = until * 1000 + 1;

	const after = await ask(runner);

	expect(after.kind === "finished" && succeeded(after)).toBe(true);
	expect(shim.calls()).toHaveLength(3);
});

test("a start check refused with a limit that has no readable reset time is made again on the next run", async () => {
	const { runner, shim, state, check } = await setup({ script: [{ error: "You've hit your limit, try later" }, {}, {}] });

	expect(check).toMatchObject({ kind: "held", card: { code: "limit-unparsed" } });

	const after = await ask(runner);

	expect(after.kind === "finished" && succeeded(after)).toBe(true);
	expect(shim.calls()).toHaveLength(3);
	expect(state.faults.list()).toEqual([]);
});

test("a start check that never answers is stopped at the limit, held with a card that says so, and made again on the next run", async () => {
	const { runner, shim, state, check } = await setup({ script: [{ hang: true }, {}, {}] }, { timeoutMs: 2000 });

	expect(check).toMatchObject({ kind: "held", card: { code: "start-check-timed-out" } });

	const after = await ask(runner);

	expect(after.kind === "finished" && succeeded(after)).toBe(true);
	expect(shim.calls()).toHaveLength(3);
	expect(state.faults.list()).toEqual([]);
});

test("a rejecting rate_limit_event also gives the reset time", async () => {
	const until = Math.floor(NOW / 1000) + 60;
	const { runner } = await setup({ script: [{}, { error: "You've hit your limit", rejectUntil: until }] });

	expect(await ask(runner)).toEqual({ kind: "limited", until: until * 1000 });
});

test("a limit message that does not parse holds the run with one card", async () => {
	const { runner, shim, state } = await setup({ script: [{}, { error: "You've hit your limit, try later" }] });

	expect((await ask(runner)).kind).toBe("held");
	expect(state.faults.list().map((c) => c.code)).toEqual(["limit-unparsed"]);
	expect(shim.calls()).toHaveLength(2);
});

test.each([
	["try later", undefined],
	["usage limit, resets at 2026-11-08T00:00:00Z", Date.parse("2026-11-08T00:00:00Z")],
])("a limit message %p resets at %p", (message, until) => {
	expect(parseLimit(message)).toBe(until);
});

test("a refresh-lock error runs again on a new session id", async () => {
	const cleared = await setup({ script: [{}, { error: "OAuth token refresh failed: lock held by another process" }, {}] });
	const outcome = await ask(cleared.runner);

	expect(outcome.kind === "finished" && succeeded(outcome)).toBe(true);

	const ids = cleared.shim.calls().map((c) => c.argv[c.argv.indexOf("--session-id") + 1]);

	expect(new Set(ids.slice(1)).size).toBe(2);
});

test("a refresh-lock error that keeps coming stops after three tries", async () => {
	const stuck = await setup({ script: [{}, { error: "refresh lock timeout" }] });
	const last = await ask(stuck.runner);

	expect(last.kind === "finished" && last.isError).toBe(true);
	expect(stuck.shim.calls()).toHaveLength(1 + 3);
});

test("a Claude Code under the floor starts no run and makes no model call", async () => {
	const { runner, shim, state, check } = await setup({ version: "2.1.315" });

	expect(check.kind).toBe("held");
	expect(state.faults.list().map((c) => c.code)).toEqual(["claude-too-old"]);
	expect((await ask(runner)).kind).toBe("held");
	expect(shim.calls()).toHaveLength(0);
});

test("a start check without the hope plugin, as bare mode answers, starts zero runs and shows one card", async () => {
	for (const answer of [{ plugins: [], error: "Not logged in" }, { plugins: ["other"] }]) {
		const { runner, shim, state, check } = await setup({ script: [answer] });

		expect(check.kind).toBe("held");
		expect((await ask(runner)).kind).toBe("held");
		expect(shim.calls()).toHaveLength(1);
		expect(state.faults.list().map((c) => c.code)).toEqual(["start-check-failed"]);
	}
});

test("the start check and a run use the same flags", async () => {
	const { runner, shim } = await setup();

	await ask(runner);

	const [check, run] = shim.calls();
	const without = (argv: string[] = []) => argv.filter((_, i) => !["--session-id", "--json-schema", "--effort", "--model"].includes(argv[i - 1] ?? ""));

	expect(without(check?.argv)).toEqual(without(run?.argv));
});

test("an API key in the environment is passed on and allowed; a changed credential shows one card and runs go on", async () => {
	const login = await setup();

	expect(login.state.faults.list()).toHaveLength(0);

	const shim = makeShim({ script: [{ keySource: "ANTHROPIC_API_KEY" }] });
	const keyed = await startRunner({ state: login.state, model: MODEL, binary: shim.binary, env: { ...shim.env, ANTHROPIC_API_KEY: "sk-test" } });

	expect(keyed.check.kind).toBe("finished");
	expect(login.state.faults.list().map((c) => c.code)).toEqual(["credential-changed"]);
	expect((await ask(keyed.runner)).kind).toBe("finished");
	expect(JSON.parse(readFileSync(join(login.state.dir, "credentials.json"), "utf8")).credential).toBe("login");
});

test("a run past the token cap is killed mid-run and leaves no claude process", async () => {
	const capped = await setup({ script: [{}, { spend: 5000, hang: true }] });

	expect(await ask(capped.runner, { tokenCap: 1000 })).toEqual({ kind: "over-cap", tokens: 5001 });
	await until(() => !isAlive(capped.shim.calls()[1]?.pid ?? 0));
});

test("an aborted run is killed mid-run and leaves no claude process", async () => {
	const aborted = await setup({ script: [{}, { hang: true }] });
	const controller = new AbortController();
	const pending = ask(aborted.runner, { signal: controller.signal });

	await until(() => aborted.shim.calls().length >= 2);
	controller.abort();

	const outcome = await pending;

	expect(outcome.kind === "finished" && outcome.subtype).toBe("no-result");
	await until(() => !isAlive(aborted.shim.calls()[1]?.pid ?? 0));
});

test("a 200 KB body goes on stdin whole, and argv stays small", async () => {
	const body = `${"x".repeat(1000)}\n`.repeat(200);
	const { runner, shim } = await setup();

	await ask(runner, { prompt: body });

	const call = shim.calls()[1];
	const hash = new Bun.CryptoHasher("sha256").update(body).digest("hex");

	expect(call?.stdinBytes).toBe(Buffer.byteLength(body));
	expect(call?.stdinSha).toBe(hash);
	expect(JSON.stringify(call?.argv).length).toBeLessThan(2000);
});

test("stderr written while a long stream-json line streams never splits the line", async () => {
	const { runner } = await setup({ script: [{}, { stderrNoise: true, structured: { text: "y".repeat(200_000) } }] });
	const outcome = await ask(runner);

	expect(outcome.kind === "finished" && succeeded(outcome)).toBe(true);
	expect(outcome.kind === "finished" && outcome.structured).toEqual({ text: "y".repeat(200_000) });
});

test("the session id is set ahead and the run reports it back", async () => {
	const { runner, shim } = await setup();
	const seen: string[] = [];
	const sessionId = "22222222-2222-4222-8222-222222222222";
	const outcome = await ask(runner, { sessionId, onSession: (id) => seen.push(id) });

	expect(seen).toEqual([sessionId]);
	expect(shim.calls()[1]?.argv).toContain(sessionId);
	expect(outcome.kind === "finished" && outcome.sessionId).toBe(sessionId);
});
