import { afterEach, expect, test } from "bun:test";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CI_STATE_REF } from "../src/service/ci-state.ts";
import { CI_TICK_REF } from "../src/service/ci-tick.ts";
import { readStatus } from "../src/status/file.ts";
import { MAIN, ownerRepo } from "./fixtures/owner-repo.ts";
import { sh } from "./fixtures/work-repo.ts";
import { tempDir } from "./fixtures/temp.ts";

const owners: ReturnType<typeof ownerRepo>[] = [];

const owner = (...args: Parameters<typeof ownerRepo>) => {
	const o = ownerRepo(...args);

	owners.push(o);

	return o;
};

afterEach(() => {
	for (const o of owners.splice(0)) rmSync(o.repo.root, { recursive: true, force: true });
});

const hum = (o: ReturnType<typeof ownerRepo>, args: string[], env: Record<string, string> = {}) => {
	const run = Bun.spawnSync(["bun", MAIN, ...args], { cwd: o.repo.owner, env: { ...o.env, ...env } });

	return { code: run.exitCode, out: run.stdout.toString(), err: run.stderr.toString() };
};

const stateDir = (o: ReturnType<typeof ownerRepo>) => join(o.repo.owner, ".git", "hum");

test("hum wake on a schedule event: the item merges, the tick and hum's state are recorded on the remote, and the job exits 0", () => {
	const o = owner({ items: { a: { commitForItem: true } } });

	o.item("a");

	const run = hum(o, ["wake", "--event", "schedule"]);

	expect(run.err).toBe("");
	expect(run.code).toBe(0);
	expect(sh(o.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
	expect(sh(o.repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim().split("\n")).toEqual([CI_STATE_REF, CI_TICK_REF]);
	expect(sh(o.repo.remote, ["ls-tree", "-r", "--name-only", CI_STATE_REF])).toContain("merges/");
});

test("hum wake on a comment event records no tick, and the next wake starts from the state it saved", () => {
	const o = owner({});

	expect(hum(o, ["wake", "--event", "issue_comment"]).code).toBe(0);
	expect(sh(o.repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim()).toBe(CI_STATE_REF);

	const saved = sh(o.repo.remote, ["rev-parse", CI_STATE_REF]).trim();

	rmSync(stateDir(o), { recursive: true, force: true });
	expect(hum(o, ["wake", "--event", "issue_comment"]).code).toBe(0);
	expect(sh(o.repo.owner, ["rev-parse", CI_STATE_REF]).trim()).toBe(saved);
});

test("hum wake with a rejected token exits 1, annotates the job and writes its summary", () => {
	const o = owner({ script: [{}, { error: "Failed to authenticate. API Error: 401 Invalid bearer token" }] });
	const summary = join(tempDir("summary"), "summary.md");

	writeFileSync(summary, "");
	o.item("a");

	const run = hum(o, ["wake", "--event", "workflow_dispatch"], { GITHUB_STEP_SUMMARY: summary });

	expect(run.code).toBe(1);
	expect(run.out).toContain("::error title=hum token-rejected::");
	expect(run.out).toContain("claude setup-token");
	expect(readFileSync(summary, "utf8")).toContain("token-rejected");
	// The item waits where it is.
	expect(sh(o.repo.remote, ["show", "main:.hum/work/a.md"])).toContain("state: ready");
});

test("hum wake with a config that names no checks says what is missing and exits 1", () => {
	const o = owner({}, {}, (raw) => void Object.assign(raw.hum, { checks: [] }));
	const run = hum(o, ["wake"]);

	expect(run.code).toBe(1);
	expect(run.err).toContain("names no checks");
});

test("hum serve reads its crash limit from the config, restarts a worker that refuses the config until then, shows one card and exits 0", () => {
	const o = owner({}, {}, (raw) => void Object.assign(raw.hum, { maxCrashes: 2, levels: [] }));
	const run = hum(o, ["serve"]);
	const status = readStatus(join(stateDir(o), "status.json"));

	expect(run.code).toBe(0);
	expect(run.err).toContain("hum serve: gave-up");
	expect(status.ok && status.status.cards.map((c) => c.code)).toEqual(["worker-down"]);
	expect(readdirSync(join(stateDir(o), "faults"))).toHaveLength(1);
});
