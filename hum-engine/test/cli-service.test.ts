import { afterEach, expect, test } from "bun:test";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { CI_STATE_REF, restoreCiState, saveCiState } from "../src/service/ci-state.ts";
import { CI_TICK_REF } from "../src/service/ci-tick.ts";
import { TOKEN_LIFE_DAYS } from "../src/service/token.ts";
import type { FaultInput } from "../src/state/faults.ts";
import { doneByOf, foldItem } from "../src/state/item-log.ts";
import { openState } from "../src/state/open.ts";
import { readStatus } from "../src/status/file.ts";
import { DAY_MS } from "../src/time.ts";
import { OWNER } from "./fixtures/identity.ts";
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

/** The `hum` binary run in the owner's checkout with `args`, as `Bun.spawn` takes it. */
const humCommand = (o: ReturnType<typeof ownerRepo>, args: string[], env: Record<string, string> = {}) => ({ cmd: ["bun", MAIN, ...args], cwd: o.repo.owner, env: { ...o.env, ...env } });

const ran = (command: ReturnType<typeof humCommand>) => {
	const run = Bun.spawnSync(command);

	return { code: run.exitCode, out: run.stdout.toString(), err: run.stderr.toString() };
};

const hum = (o: ReturnType<typeof ownerRepo>, args: string[], env: Record<string, string> = {}) => ran(humCommand(o, args, env));

const stateDir = (o: ReturnType<typeof ownerRepo>) => join(o.repo.owner, ".git", "hum");

/**
 * The three jobs of one CI wake in the owner's checkout, each on a fresh runner's state folder, as the workflow runs
 * them: gather, then work after the checkout fetched what gather left on the remote, then publish with gather's output,
 * whose command is given to run.
 */
const wakeJobs = (o: ReturnType<typeof ownerRepo>, env: Record<string, string> = {}) => {
	const folder = tempDir("wake");
	const [inbox, outbox, output] = [join(folder, "inbox"), join(folder, "outbox"), join(folder, "output")];

	writeFileSync(output, "");

	return {
		gather: () => hum(o, ["wake", "gather", "--inbox", inbox], { ...env, GITHUB_OUTPUT: output }),
		work: () => {
			rmSync(stateDir(o), { recursive: true, force: true });
			sh(o.repo.owner, ["fetch", "-q", "origin"]);

			return hum(o, ["wake", "work", "--inbox", inbox, "--outbox", outbox], env);
		},
		publish: (args: string[] = []) => {
			rmSync(stateDir(o), { recursive: true, force: true });

			return humCommand(o, ["wake", "publish", "--outbox", outbox, ...args], { ...env, HUM_GATHERED: readFileSync(output, "utf8").split("\n")[1] ?? "" });
		},
	};
};

/** One CI wake: the first of its jobs that failed, else publish. */
const wake = (o: ReturnType<typeof ownerRepo>, args: string[] = [], env: Record<string, string> = {}) => {
	const jobs = wakeJobs(o, env);
	const gather = jobs.gather();

	if (gather.code !== 0) return gather;

	const work = jobs.work();

	return work.code === 0 ? ran(jobs.publish(args)) : work;
};

/** hum's state as the last job saved it on the remote. */
const savedState = async (o: ReturnType<typeof ownerRepo>) => {
	const dir = tempDir("saved-state");

	await restoreCiState({ repo: o.repo.owner, remote: o.repo.remote, dir, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	return openState(dir, { now: Date.now });
};

/** Adds `card` to hum's state on the remote, as an earlier engine saved it there. */
const keepCard = async (o: ReturnType<typeof ownerRepo>, card: FaultInput) => {
	const where = { repo: o.repo.owner, remote: o.repo.remote, dir: tempDir("kept-card"), timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS };
	const read = await restoreCiState(where);

	openState(where.dir, { now: Date.now }).faults.raise(card);
	await saveCiState({ ...where, ...read, identity: OWNER, at: Date.now() });
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

test("a publish job killed once its push moved main has saved the landing first; the next wake's gather records the merge with its commits, paths and way of reaching done and runs no check, its work job checks main, and nothing is pushed again", async () => {
	const o = owner({ items: { a: { writeForItem: true } } });

	o.item("a");

	const base = sh(o.repo.remote, ["rev-parse", "main"]).trim();
	const onMain = () => sh(o.repo.remote, ["rev-list", "--reverse", `${base}..main`]).split("\n").filter(Boolean);
	const pidFile = join(tempDir("kill"), "pid");
	const first = wakeJobs(o);

	expect(first.gather().code).toBe(0);
	expect(first.work().code).toBe(0);

	o.repo.killsOnPush(pidFile);
	const publish = Bun.spawn({ ...first.publish(), stdout: "ignore", stderr: "ignore" });

	writeFileSync(pidFile, String(publish.pid));
	await publish.exited;

	const pushed = onMain();

	expect(publish.signalCode).toBe("SIGKILL");
	expect(pushed).toHaveLength(2);
	expect((await savedState(o)).landings.get("a")).toMatchObject({ commits: pushed });

	const next = wakeJobs(o);

	expect(next.gather().code).toBe(0);

	const gathered = await savedState(o);

	expect(gathered.merges.get("a")).toMatchObject({ sha: pushed.at(-1), commits: pushed, paths: ["docs/a.md"], baseChecked: false });
	expect(doneByOf(foldItem(gathered.events.list("a")))).toBe("checks");
	expect(next.work().code).toBe(0);
	expect(ran(next.publish()).code).toBe(0);
	expect((await savedState(o)).merges.get("a")).toMatchObject({ baseChecked: true });
	expect(onMain()).toEqual(pushed);
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

test("a wake whose CI token is in its last weeks warns on each job, merges the item and exits 0", () => {
	const setUp = new Date(Date.now() - (TOKEN_LIFE_DAYS - SHIPPED_DEFAULTS.tokenWarnDays / 2) * DAY_MS).toISOString().slice(0, 10);
	const o = owner({ items: { a: { writeForItem: true } } }, {}, (raw) => void (raw.hum.ciToken = { setUp }));
	const jobs = wakeJobs(o);

	o.item("a");

	const gather = jobs.gather();

	expect(gather.code).toBe(0);
	expect(gather.out).toContain("::warning title=hum token-expiring::");
	expect(jobs.work().code).toBe(0);
	expect(ran(jobs.publish()).code).toBe(0);
	expect(sh(o.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
});

test("a wake whose saved state holds the signal card hum 0.7.0 kept for good runs every job, and its review-note loop clears the card", async () => {
	const o = owner({ items: { a: { writeForItem: true } } });

	expect(wake(o, ["--event", "issue_comment"]).code).toBe(0);
	await keepCard(o, { code: "signal-not-applied", item: ".ts", cause: "Hunks in .ts files are not parsed, so shared-identifier and same-glob-symbol did not run on them.", fix: "The other signals still decide." });
	rmSync(stateDir(o), { recursive: true, force: true });
	o.item("a");

	expect(wake(o, ["--event", "issue_comment"]).code).toBe(0);
	expect(sh(o.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
	expect((await savedState(o)).faults.list().map(({ code }) => code)).not.toContain("signal-not-applied");
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
