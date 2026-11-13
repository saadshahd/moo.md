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

/**
 * The three jobs of a CI wake in the owner's checkout, each on a fresh runner's state folder, as the workflow runs them:
 * gather, then work after the checkout fetched what gather left on the remote, then publish with gather's output.
 * Returns the first job that failed, else publish.
 */
const wake = (o: ReturnType<typeof ownerRepo>, args: string[] = [], env: Record<string, string> = {}) => {
	const folder = tempDir("wake");
	const [inbox, outbox, output] = [join(folder, "inbox"), join(folder, "outbox"), join(folder, "output")];

	writeFileSync(output, "");

	const gather = hum(o, ["wake", "gather", "--inbox", inbox], { ...env, GITHUB_OUTPUT: output });

	if (gather.code !== 0) return gather;

	rmSync(stateDir(o), { recursive: true, force: true });
	sh(o.repo.owner, ["fetch", "-q", "origin"]);

	const work = hum(o, ["wake", "work", "--inbox", inbox, "--outbox", outbox], env);

	if (work.code !== 0) return work;

	rmSync(stateDir(o), { recursive: true, force: true });

	const gathered = readFileSync(output, "utf8").split("\n")[1] ?? "";

	return hum(o, ["wake", "publish", "--outbox", outbox, ...args], { ...env, HUM_GATHERED: gathered });
};

test("a wake on a schedule event: the item merges, the tick and hum's state are recorded on the remote, and each job exits 0", () => {
	const o = owner({ items: { a: { writeForItem: true } } });

	o.item("a");

	const run = wake(o, ["--event", "schedule"]);

	expect(run.err).toBe("");
	expect(run.code).toBe(0);
	expect(sh(o.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
	expect(sh(o.repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim().split("\n")).toEqual([CI_STATE_REF, CI_TICK_REF]);
	expect(sh(o.repo.remote, ["ls-tree", "-r", "--name-only", CI_STATE_REF])).toContain("merges/");
});

test("a wake on a comment event records no tick, and the next wake starts from the state it saved, which it could not replace otherwise", () => {
	const o = owner({});

	expect(wake(o, ["--event", "issue_comment"]).code).toBe(0);
	expect(sh(o.repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim()).toBe(CI_STATE_REF);

	const saved = sh(o.repo.remote, ["rev-parse", CI_STATE_REF]).trim();

	rmSync(stateDir(o), { recursive: true, force: true });
	expect(wake(o, ["--event", "issue_comment"]).code).toBe(0);
	expect(sh(o.repo.remote, ["rev-parse", CI_STATE_REF]).trim()).not.toBe(saved);
});

test("a wake with a rejected token exits 1, annotates the job and writes its summary", () => {
	// Only the work job makes a start check; the run after it meets the rejected token.
	const o = owner({ script: [{}, { error: "Failed to authenticate. API Error: 401 Invalid bearer token" }] });
	const summary = join(tempDir("summary"), "summary.md");

	writeFileSync(summary, "");
	o.item("a");

	const run = wake(o, ["--event", "workflow_dispatch"], { GITHUB_STEP_SUMMARY: summary });

	expect(run.code).toBe(1);
	expect(run.out).toContain("::error title=hum token-rejected::");
	expect(run.out).toContain("claude setup-token");
	expect(readFileSync(summary, "utf8")).toContain("token-rejected");
	// The item waits where it is.
	expect(sh(o.repo.remote, ["show", "main:.hum/work/a.md"])).toContain("state: ready");
});

test("a wake with a config that names no checks says what is missing and exits 1", () => {
	const o = owner({}, {}, (raw) => void Object.assign(raw.hum, { checks: [] }));
	const run = wake(o);

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
