import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeRunner, parseLimit, type RunnerOptions, runArgs, succeeded, TIER_MODELS } from "../src/adapters/claude-p.ts";
import { openState } from "../src/state/open.ts";
import { makeShim, type ShimSpec } from "./fixtures/shim.ts";

const NOW = 1_800_000_000_000;

const setup = (spec: ShimSpec = {}, extra: Partial<RunnerOptions> & { clock?: { at: number } } = {}) => {
	const shim = makeShim(spec);
	const state = openState(mkdtempSync(join(tmpdir(), "hum-runner-")));
	const { clock = { at: NOW }, ...rest } = extra;
	const runner = new ClaudeRunner({ state, binary: shim.binary, env: shim.env, now: () => clock.at, sleep: async () => {}, random: () => 0.5, ...rest });

	return { shim, state, runner, clock };
};

const ask = (runner: ClaudeRunner, over: Partial<Parameters<ClaudeRunner["run"]>[0]> = {}) =>
	runner.run({ prompt: "do it", cwd: tmpdir(), model: TIER_MODELS.light, effort: "low", schema: { type: "object" }, ...over });

test("the flag set holds the five flags and never --bare, --resume or --continue", () => {
	const args = runArgs({ model: "m", effort: "low", schema: { type: "object" }, sessionId: "11111111-1111-4111-8111-111111111111" });

	for (const flag of ["--model", "--effort", "--json-schema", "--settings", "--session-id"]) expect(args).toContain(flag);

	for (const banned of ["--bare", "--resume", "--continue", "-r", "-c"]) expect(args).not.toContain(banned);
	expect(args.slice(0, 4)).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
});

test("R4: the usage-limit message parses to limited(until), and no call is made until then", async () => {
	const until = Math.floor(NOW / 1000) + 3600;
	const { runner, shim, clock } = setup({ script: [{}, { error: `Claude usage limit reached|${until}` }, {}] });

	expect((await runner.start()).kind).toBe("finished");

	const limited = await ask(runner);

	expect(limited).toEqual({ kind: "limited", until: until * 1000 });
	expect(shim.calls()).toHaveLength(2);

	expect(await ask(runner)).toEqual({ kind: "limited", until: until * 1000 });
	expect(shim.calls()).toHaveLength(2);

	clock.at = until * 1000 + 1;

	const after = await ask(runner);

	expect(after.kind === "finished" && succeeded(after)).toBe(true);
	expect(shim.calls()).toHaveLength(3);
});

test("R4: a rejecting rate_limit_event also gives the reset time", async () => {
	const until = Math.floor(NOW / 1000) + 60;
	const { runner } = setup({ script: [{}, { error: "You've hit your limit", rejectUntil: until }] });

	await runner.start();

	expect(await ask(runner)).toEqual({ kind: "limited", until: until * 1000 });
});

test("R4: a limit message that does not parse holds the run with one card", async () => {
	const { runner, shim, state } = setup({ script: [{}, { error: "You've hit your limit, try later" }] });

	await runner.start();

	const held = await ask(runner);

	expect(held.kind).toBe("held");
	expect(state.faults.list().map((c) => c.code)).toEqual(["limit-unparsed"]);
	expect(shim.calls()).toHaveLength(2);
	expect(parseLimit("try later")).toBeUndefined();
	expect(parseLimit("usage limit, resets at 2026-11-08T00:00:00Z")).toBe(Date.parse("2026-11-08T00:00:00Z"));
});

test("R5: a refresh-lock error is retried with jitter and the run succeeds", async () => {
	const waits: number[] = [];
	const { runner, shim } = setup({ script: [{}, { error: "OAuth token refresh failed: lock held by another process" }, {}] }, { sleep: async (ms) => void waits.push(ms) });

	await runner.start();

	const outcome = await ask(runner);

	expect(outcome.kind === "finished" && succeeded(outcome)).toBe(true);
	expect(shim.calls()).toHaveLength(3);
	expect(waits).toEqual([2000]);

	// A retry is a new session, so the saved id changes with it.
	const ids = shim.calls().map((c) => c.argv[c.argv.indexOf("--session-id") + 1]);

	expect(new Set(ids.slice(1)).size).toBe(2);
});

test("R5: a lock error that never clears stops after the bounded tries", async () => {
	const { runner, shim } = setup({ script: [{}, { error: "refresh lock timeout" }] });

	await runner.start();

	const outcome = await ask(runner);

	expect(outcome.kind === "finished" && outcome.isError).toBe(true);
	expect(shim.calls()).toHaveLength(1 + 3);
});

test("R5: a Claude Code under the floor starts no run and makes no model call", async () => {
	const { runner, shim, state } = setup({ version: "2.1.315" });

	expect((await runner.start()).kind).toBe("held");
	expect(shim.calls()).toHaveLength(0);
	expect(state.faults.list().map((c) => c.code)).toEqual(["claude-too-old"]);
	expect((await ask(runner)).kind).toBe("held");
	expect(shim.calls()).toHaveLength(0);
});

test("V1: a bare-mode answer (no plugins, auth failure) starts zero runs and shows one card", async () => {
	const { runner, shim, state } = setup({ script: [{ plugins: [], error: "Not logged in" }] });

	expect((await runner.start()).kind).toBe("held");
	expect((await ask(runner)).kind).toBe("held");
	expect((await ask(runner)).kind).toBe("held");
	expect(shim.calls()).toHaveLength(1);
	expect(state.faults.list().map((c) => c.code)).toEqual(["start-check-failed"]);
});

test("V1: a success without the hope plugin starts no run either", async () => {
	const { runner, state } = setup({ script: [{ plugins: ["other"] }] });

	expect((await runner.start()).kind).toBe("held");
	expect(state.faults.list()).toHaveLength(1);
});

test("V1: the start check and a run use the same flags", async () => {
	const { runner, shim } = setup();

	await runner.start();
	await ask(runner);

	const [check, run] = shim.calls();
	const without = (argv: string[] = []) => argv.filter((_, i) => argv[i - 1] !== "--session-id" && argv[i - 1] !== "--json-schema" && argv[i - 1] !== "--effort" && argv[i - 1] !== "--model");

	expect(without(check?.argv)).toEqual(without(run?.argv));
});

test("E6: an API key is allowed; a changed credential shows one card and runs go on", async () => {
	const login = setup();

	await login.runner.start();
	expect(login.state.faults.list()).toHaveLength(0);

	const key = new ClaudeRunner({ state: login.state, binary: makeShim({ script: [{ keySource: "ANTHROPIC_API_KEY" }] }).binary, env: makeShim().env });
	const shim = makeShim({ script: [{ keySource: "ANTHROPIC_API_KEY" }] });
	const keyed = new ClaudeRunner({ state: login.state, binary: shim.binary, env: shim.env });
	const started = await keyed.start();

	expect(started.kind).toBe("finished");
	expect(login.state.faults.list().map((c) => c.code)).toEqual(["credential-changed"]);

	const outcome = await keyed.run({ prompt: "x", cwd: tmpdir(), model: "m", effort: "low", schema: {} });

	expect(outcome.kind).toBe("finished");
	expect(key).toBeDefined();
	expect(JSON.parse(readFileSync(join(login.state.dir, "credentials.json"), "utf8")).credential).toBe("login");
});

test("E6: an API key in the environment reaches the process untouched", async () => {
	const shim = makeShim();
	const state = openState(mkdtempSync(join(tmpdir(), "hum-runner-")));
	const runner = new ClaudeRunner({ state, binary: shim.binary, env: { ...shim.env, ANTHROPIC_API_KEY: "sk-test" } });

	expect((await runner.start()).kind).toBe("finished");
});

test("E1: a run past the token cap is killed mid-run and no claude process is left", async () => {
	const { runner, shim } = setup({ script: [{}, { spend: 5000, hang: true }] });

	await runner.start();

	const started = Date.now();
	const outcome = await ask(runner, { tokenCap: 1000 });

	expect(outcome).toEqual({ kind: "over-cap", tokens: 5001 });
	expect(Date.now() - started).toBeLessThan(20_000);

	const pid = shim.calls()[1]?.pid ?? 0;

	await Bun.sleep(300);
	expect(() => process.kill(pid, 0)).toThrow();
});

test("E1: an abort kills the run", async () => {
	const { runner, shim } = setup({ script: [{}, { hang: true }] });

	await runner.start();

	const controller = new AbortController();
	const pending = ask(runner, { signal: controller.signal });

	await Bun.sleep(500);
	controller.abort();

	const outcome = await pending;

	expect(outcome.kind === "finished" && outcome.subtype).toBe("no-result");

	const pid = shim.calls()[1]?.pid ?? 0;

	await Bun.sleep(300);
	expect(() => process.kill(pid, 0)).toThrow();
});

test("V8: a 200 KB body goes on stdin whole, and argv stays small", async () => {
	const body = `${"x".repeat(1000)}\n`.repeat(200);
	const { runner, shim } = setup();

	await runner.start();
	await ask(runner, { prompt: body });

	const call = shim.calls()[1];
	const hash = new Bun.CryptoHasher("sha256").update(body).digest("hex");

	expect(body.length).toBeGreaterThanOrEqual(200 * 1001);
	expect(call?.stdinBytes).toBe(Buffer.byteLength(body));
	expect(call?.stdinSha).toBe(hash);
	expect(JSON.stringify(call?.argv).length).toBeLessThan(2000);
});

test("the session id is set ahead and the run reports it back", async () => {
	const { runner, shim } = setup();
	const seen: string[] = [];

	await runner.start();

	const outcome = await ask(runner, { sessionId: "22222222-2222-4222-8222-222222222222", onSession: (id) => seen.push(id) });

	expect(seen).toEqual(["22222222-2222-4222-8222-222222222222"]);
	expect(shim.calls()[1]?.argv).toContain("22222222-2222-4222-8222-222222222222");
	expect(outcome.kind === "finished" && outcome.sessionId).toBe("22222222-2222-4222-8222-222222222222");
});
