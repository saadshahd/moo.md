import { docsJudge, scriptedJudge, SOUND } from "../fixtures/judge.ts";
import type { Runner } from "../../src/adapters/claude-p.ts";
import { type ModelCall, modelCallOver } from "../../src/adapters/model-call.ts";
import { afterEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBackgroundRunner } from "../../src/adapters/claude-bg.ts";
import { startRunner } from "../../src/adapters/claude-p.ts";
import { markdownAdapter } from "../../src/adapters/markdown.ts";
import type { Config } from "../../src/config/load.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { SlotPool } from "../../src/slots/pool.ts";
import { openState } from "../../src/state/open.ts";
import { type Checkout, PLAN_MARK, runBranch, runThinPath, type ThinPathOptions } from "../../src/worker/thin-path.ts";
import { configWith } from "../fixtures/config.ts";
import { WorkRepo, itemFile, markdownSettings, sh } from "../fixtures/work-repo.ts";
import { makeShim, type ShimSpec } from "../fixtures/shim.ts";
import { BASE, poolConfig } from "../fixtures/slot-world.ts";
import { FakePulls } from "../fixtures/fake-pulls.ts";

const NOW = 1_800_000_000_000;
const TTL = SHIPPED_DEFAULTS.claimExpirySeconds * 1000;
const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const clean of cleanups.splice(0)) clean();
});

const world = async (spec: ShimSpec, { config = configWith(), checks = ["test -f docs/note.md"], background = false }: { config?: Config; checks?: string[]; background?: boolean } = {}) => {
	const repo = new WorkRepo();
	const clock = { at: NOW };
	const now = () => clock.at;
	const shim = makeShim(spec);
	const state = openState(mkdtempSync(join(tmpdir(), "hum-thin-")), { now });
	const reports: string[] = [];
	const adapter = markdownAdapter({ ...markdownSettings, repo: repo.worker("w") }, { report: (f) => reports.push(f.code), now });
	const runnerOptions = { state, model: config.hum.models.light, binary: shim.binary, env: shim.env, now };
	const { check, runner } = background ? await startBackgroundRunner({ ...runnerOptions, config: { ...config.hum, backgroundPollSeconds: 0.05 }, repo: repo.owner }) : await startRunner(runnerOptions);

	cleanups.push(() => rmSync(repo.root, { recursive: true, force: true }), () => rmSync(state.dir, { recursive: true, force: true }));

	expect(check.kind).toBe("finished");

	const options = (over: Partial<ThinPathOptions> = {}): ThinPathOptions => ({
		workSource: adapter.workSource!,
		questions: adapter.questions!,
		state,
		runner,
		config,
		judge: docsJudge,
		remote: repo.remote,
		checks,
		holder: "worker-1",
		workDir: mkdtempSync(join(tmpdir(), "hum-thin-work-")),
		...over,
	});

	return { repo, clock, shim, state, adapter, reports, options };
};

const NOTE = { commit: { "docs/note.md": "hello\n" } };

test("the thin path: item → claude -p shim commit → checks → low-risk merge, state done in the same change", async () => {
	const stdinCopy = join(tmpdir(), `hum-body-stdin-${process.pid}`);
	const w = await world({ script: [{}, { ...NOTE, saveStdin: stdinCopy }] });
	const body = `${"y".repeat(99)}\n`.repeat(2100);
	const id = w.repo.add("big", itemFile("Write the note", "ready", body));
	const result = await runThinPath(w.options());

	expect(result).toEqual({ outcome: "merged", item: id });

	// A body over 200 KB reaches the run on stdin whole.
	expect(body.length).toBeGreaterThan(200_000);
	expect(readFileSync(stdinCopy, "utf8")).toContain(body.trim());

	// One change on main: the run's commit and the item's state.
	expect(sh(w.repo.remote, ["show", "main:docs/note.md"])).toBe("hello\n");
	expect(w.repo.show(id)).toContain("state: done");
	expect(sh(w.repo.remote, ["log", "--format=%s", "-3", "main"]).split("\n")).toEqual(["hum: finish " + id, "shim: the change", `add ${id}`, ""]);

	// The run branch and the claim branch are hum's, and distinct.
	const heads = sh(w.repo.remote, ["for-each-ref", "--format=%(refname)", "refs/heads/hum"]).split("\n").filter(Boolean);

	expect(heads.sort()).toEqual([`refs/heads/${runBranch(SHIPPED_DEFAULTS, id)}`, `refs/heads/${SHIPPED_DEFAULTS.claimPrefix}${id}`].sort());

	// The claude call: the session id saved ahead, no resume.
	const [, run] = w.shim.calls();

	expect(run?.argv).not.toContain("--resume");
	expect(w.state.runs.list(id)).toHaveLength(1);
	expect(w.state.runs.list(id)[0]?.sessionId).toBe(run?.argv[run.argv.indexOf("--session-id") + 1]);
	const tip = sh(w.repo.remote, ["rev-parse", "main"]).trim();

	expect(w.state.events.get({ source: "work-source", sourceId: `merged:${tip}`, itemId: id }).type).toBe("merged");
	// The finished item leaves no snapshot behind.
	expect(existsSync(w.state.items.path(id))).toBe(false);
});

test("the thin path through a background run: the build is a named agent, its commit lands, and the run is stopped and removed", async () => {
	const w = await world({ script: [{}, {}, NOTE] }, { background: true });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toEqual({ outcome: "merged", item: id });
	expect(sh(w.repo.remote, ["show", "main:docs/note.md"])).toBe("hello\n");

	const [record] = w.state.runs.list(id);
	const launches = w.shim.background().filter(({ cmd }) => cmd === "bg");

	expect(launches.map(({ name }) => name)).toEqual(["hum start check", record?.name]);
	expect(record?.sessionId).toBe(`aaaaaaa2-0000-4000-8000-000000000000`);
	expect(w.shim.background().map(({ cmd }) => cmd)).toEqual(["bg", "stop", "rm", "bg", "stop", "rm"]);
	expect(w.shim.agents()).toEqual([]);
});

test("the thin path through a background run in a slot: the build starts in the slot with the slot's environment, the change lands, and the slot is returned", async () => {
	const w = await world({ script: [{}, {}, NOTE] }, { background: true });
	const id = w.repo.seed("Write the note");
	const pool = mkdtempSync(join(tmpdir(), "hum-thin-pool-"));
	const slots = new SlotPool({ repo: w.repo.owner, state: w.state, config: poolConfig(pool, { runners: 1 }), base: BASE });

	cleanups.push(() => rmSync(pool, { recursive: true, force: true }));

	expect(await runThinPath(w.options({ checkout: slots.checkout }))).toEqual({ outcome: "merged", item: id });
	await slots.idle();

	const [slot] = slots.list();
	const [, build] = w.shim.background().filter(({ cmd }) => cmd === "bg");

	expect(build?.cwd).toBe(realpathSync(slot?.folder ?? ""));
	expect(JSON.parse(build?.settings ?? "{}").env).toMatchObject({ HUM_SLOT: "slot-1" });
	expect(slot).toMatchObject({ status: "free" });
	expect(sh(slot?.folder ?? "", ["branch", "--list", "hum/*"])).toBe("");
	expect(w.state.faults.list()).toEqual([]);
});

test("a run's working copy comes from the checkout it is given, on the remote's base branch", async () => {
	const w = await world({ script: [{}, NOTE] });
	const id = w.repo.seed("Write the note");
	const asked: { item: string; remote: string; base: string }[] = [];
	const given: string[] = [];

	const checkout: Checkout = async ({ item, remote, base }) => {
		const folder = mkdtempSync(join(tmpdir(), "hum-given-"));

		asked.push({ item, remote, base });
		await sh(tmpdir(), ["clone", "-q", "--branch", base, remote, folder]);

		return { folder, env: {}, giveBack: async () => void given.push(folder) };
	};

	expect(await runThinPath(w.options({ checkout }))).toEqual({ outcome: "merged", item: id });
	expect(asked).toEqual([{ item: id, remote: w.repo.remote, base: "main" }]);
	expect(given).toHaveLength(1);
});

test("a merged item is not picked up again after its claim expires", async () => {
	const w = await world({ script: [{}, NOTE] });
	const id = w.repo.seed("Write the note");

	await runThinPath(w.options());

	expect(await w.adapter.workSource!.listReady()).toEqual([]);

	w.clock.at += TTL + 1;

	expect(await w.adapter.workSource!.listReady()).toEqual([]);
	expect(await runThinPath(w.options())).toEqual({ outcome: "idle" });
	expect(w.shim.calls()).toHaveLength(2);
	expect(w.repo.show(id)).toContain("state: done");
});

test("a merge that keeps losing the race to the base stops after mergeTries pushes", async () => {
	const w = await world({ script: [{}, NOTE] }, { config: configWith((raw) => (raw.hum.mergeTries = 2)) });

	w.repo.seed("Write the note");
	const refused = w.repo.refuseMainPushes();

	await expect(runThinPath(w.options())).rejects.toThrow("another push moved main first");
	expect(refused()).toBe(2);
});

test("failed checks go to a fix run, and the fix run gets the failure", async () => {
	const w = await world({ script: [{}, { commit: { "docs/note.md": "BAD\n" } }, { commit: { "docs/note.md": "good\n" }, saveStdin: join(tmpdir(), `hum-fix-stdin-${process.pid}`) }] }, { checks: ["! grep -q BAD docs/note.md"] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toEqual({ outcome: "merged", item: id });
	expect(w.shim.calls()).toHaveLength(3);
	expect(readFileSync(join(tmpdir(), `hum-fix-stdin-${process.pid}`), "utf8")).toContain("## What to fix");
	expect(sh(w.repo.remote, ["show", "main:docs/note.md"])).toBe("good\n");
});

test("checks that never pass end in stuck after the fix limit, and main is untouched", async () => {
	const config = configWith((raw) => {
		raw.hum.maxFixRuns = 2;
	});

	const w = await world({ script: [{}, { commit: { "docs/note.md": "one\n" } }, { commit: { "docs/note.md": "two\n" } }, { commit: { "docs/note.md": "three\n" } }] }, { config, checks: ["false"] });
	const id = w.repo.seed("Write the note");
	const before = sh(w.repo.remote, ["rev-parse", "main"]);

	expect(await runThinPath(w.options())).toMatchObject({ outcome: "stuck", item: id });
	expect(w.shim.calls()).toHaveLength(1 + 1 + 2);

	// Stuck stays stuck, though the item file still says ready: no run, no claim.
	w.clock.at += TTL + 1;
	expect(await runThinPath(w.options({ itemId: id }))).toMatchObject({ outcome: "stuck", item: id });
	expect(w.shim.calls()).toHaveLength(1 + 1 + 2);
	expect(sh(w.repo.remote, ["rev-parse", "main"])).toBe(before);
});

test("a run that succeeds and commits nothing is not done", async () => {
	const w = await world({ script: [{}, {}] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toMatchObject({ outcome: "stuck", item: id });
});

test("a commit with an error subtype is not done", async () => {
	const w = await world({ script: [{}, { ...NOTE, error: "tool failed" }] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toMatchObject({ outcome: "stuck", item: id });
});

const OWNER_CONFIG = `${JSON.stringify({ schemaVersion: 1, paths: [{ glob: "docs/**", level: "low" }] }, null, "\t")}\n`;

const questionsOn = async (w: Awaited<ReturnType<typeof world>>, id: string) => (await w.adapter.workSource!.read(id)).thread.filter((entry) => entry.kind === "question");

test("a change to a path no rule places runs, waits unmerged and asks one question; the answer becomes a path rule, and the next change there is not unclear", async () => {
	const w = await world({ script: [{}, { commit: { "src/x.ts": "x\n", "docs/note.md": "hello\n" } }, { commit: { "src/y.ts": "y\n" } }] });

	w.repo.put(".hum/hum.json", OWNER_CONFIG);

	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toMatchObject({ outcome: "review", item: id, detail: "a changed path matches no path rule" });
	expect(() => sh(w.repo.remote, ["show", "main:src/x.ts"])).toThrow();
	expect(w.repo.show(id)).toContain("state: ready");
	expect((await questionsOn(w, id)).map((q) => q.text)).toEqual([expect.stringContaining("src/** match no path rule")]);

	await w.adapter.answers!.answer(id, { text: "low", option: "low" });
	w.state.parked.remove(id);

	const runs = w.shim.calls().length;

	expect(await runThinPath(w.options({ itemId: id }))).toEqual({ outcome: "merged", item: id });
	expect(w.shim.calls()).toHaveLength(runs);
	expect(JSON.parse(sh(w.repo.remote, ["show", "main:.hum/hum.json"])).paths).toEqual([{ glob: "docs/**", level: "low" }, { glob: "src/**", level: "low" }]);
	expect(sh(w.repo.remote, ["log", "-1", "--format=%B", w.state.learned.get("src/**")?.commit ?? "none"])).toContain(`The owner answered on item ${id}.`);

	const next = w.repo.seed("Add y");

	expect(await runThinPath(w.options({ itemId: next }))).toEqual({ outcome: "merged", item: next });
	expect(await questionsOn(w, next)).toEqual([]);
});

test("where the base needs a pull request, the answer's path rule travels in one, and a rerun waits on it without a second", async () => {
	const w = await world({ script: [{}, { commit: { "src/x.ts": "x\n", "docs/note.md": "hello\n" } }] });
	const github = new FakePulls();
	const pulls = github.client();

	w.repo.put(".hum/hum.json", OWNER_CONFIG);

	const id = w.repo.seed("Write the note");

	github.requiresPullRequest = true;
	expect(await runThinPath(w.options({ pulls }))).toMatchObject({ outcome: "landing", item: id });

	await w.adapter.answers!.answer(id, { text: "low", option: "low" });
	w.state.parked.remove(id);

	const landing = await runThinPath(w.options({ pulls, itemId: id }));
	const rulePull = github.pulls.find((pull) => pull.head.startsWith(SHIPPED_DEFAULTS.ownerBranchPrefix));

	expect(landing).toMatchObject({ outcome: "landing", item: id });
	expect(rulePull).toMatchObject({ base: "main", autoMerge: true });
	expect(w.state.learned.get("src/**")?.pull).toContain("/pull/");
	expect(JSON.parse(sh(w.repo.remote, ["show", "main:.hum/hum.json"])).paths).toEqual([{ glob: "docs/**", level: "low" }]);

	w.state.parked.remove(id);
	expect(await runThinPath(w.options({ pulls, itemId: id }))).toEqual(landing);
	expect(github.pulls.filter((pull) => pull.head.startsWith(SHIPPED_DEFAULTS.ownerBranchPrefix))).toHaveLength(1);
});

test("a run that needs the owner pushes its branch, asks, and ends; the answer starts a fresh run on that branch", async () => {
	const w = await world(
		{
			script: [
				{},
				{ commit: { "docs/part-one.md": "one\n" }, structured: { status: "needs-owner", question: "Which title?", plan: "Write two parts." } },
				{ commit: { "docs/note.md": "two\n" }, saveStdin: join(tmpdir(), `hum-resume-stdin-${process.pid}`) },
			],
		},
		{ checks: ["test -f docs/part-one.md"] },
	);

	const id = w.repo.seed("Write the note");
	const asked = await runThinPath(w.options());

	expect(asked).toEqual({ outcome: "asked", item: id, detail: "Which title?" });
	expect(sh(w.repo.remote, ["show", `${runBranch(SHIPPED_DEFAULTS, id)}:docs/part-one.md`])).toBe("one\n");

	const thread = (await w.adapter.workSource!.read(id)).thread;

	expect(thread.map((e) => e.kind)).toEqual(["comment", "question"]);
	expect(thread[0]?.text.startsWith(PLAN_MARK)).toBe(true);

	// Nothing happens until the owner answers.
	expect(await runThinPath(w.options({ itemId: id }))).toEqual({ outcome: "waiting", item: id });
	expect(w.shim.calls()).toHaveLength(2);

	await w.adapter.answers!.answer(id, { text: "Use Plain" });
	w.clock.at += TTL + 1;

	expect(await runThinPath(w.options({ itemId: id }))).toEqual({ outcome: "merged", item: id });

	const stdin = readFileSync(join(tmpdir(), `hum-resume-stdin-${process.pid}`), "utf8");

	for (const part of ["Which title?", "Use Plain", "Write two parts.", "docs/part-one.md"]) expect(stdin).toContain(part);

	for (const call of w.shim.calls()) {
		expect(call.argv).not.toContain("--resume");
		expect(call.argv).not.toContain("--continue");
	}

	expect(sh(w.repo.remote, ["show", "main:docs/part-one.md"])).toBe("one\n");
	expect(sh(w.repo.remote, ["show", "main:docs/note.md"])).toBe("two\n");
	expect(w.repo.show(id)).toContain("state: done");
});

test("a run that says a secret is missing asks about it only when the runner lacks the variable; otherwise the owner gets the plain question", async () => {
	const needs = (variable: string) => ({ commit: { "docs/part.md": "one\n" }, structured: { status: "needs-owner", question: "Is it set?", plan: "Publish.", reason: { kind: "missing-secret", variable } } });
	const w = await world({ script: [{}, needs("NPM_TOKEN"), needs("PATH")] });
	const lacking = w.repo.seed("Publish the note");

	expect(await runThinPath(w.options({ runnerVariables: new Set(["PATH"]) }))).toMatchObject({ outcome: "asked", item: lacking, detail: "Can you set NPM_TOKEN for the runner?" });

	const present = w.repo.seed("Publish the other note");

	expect(await runThinPath(w.options({ itemId: present, runnerVariables: new Set(["PATH"]) }))).toMatchObject({ outcome: "asked", item: present, detail: "Is it set?" });
});

test("a claim another worker holds is lost, and no run starts", async () => {
	const w = await world({ script: [{}, NOTE] });
	const id = w.repo.seed("Write the note");

	expect((await w.adapter.workSource!.claim(id, "worker-2", TTL)).won).toBe(true);
	expect(await runThinPath(w.options({ itemId: id }))).toEqual({ outcome: "lost", item: id });
	expect(w.shim.calls()).toHaveLength(1);
});

const GH013 = "remote: error: GH013: Repository rule violations found for refs/heads/main.";

test("where the base requires a pull request, a cleared change opens one with auto-merge; once GitHub merges it, a lapsed claim lands it without another run", async () => {
	const w = await world({ script: [{}, NOTE] });
	const github = new FakePulls();
	const pulls = github.client();
	const id = w.repo.seed("Write the note");
	const before = sh(w.repo.remote, ["rev-parse", "main"]);

	github.requiresPullRequest = true;
	expect(await runThinPath(w.options({ pulls }))).toMatchObject({ outcome: "landing", item: id });
	expect(github.pulls).toMatchObject([{ head: runBranch(SHIPPED_DEFAULTS, id), base: "main", autoMerge: true, state: "OPEN" }]);
	expect(sh(w.repo.remote, ["rev-parse", "main"])).toBe(before);
	expect(sh(w.repo.remote, ["show", `${runBranch(SHIPPED_DEFAULTS, id)}:.hum/work/${id}.md`])).toContain("state: done");

	const runs = w.shim.calls().length;

	github.checksPass(1);
	w.clock.at += TTL;
	expect(await runThinPath(w.options({ pulls, itemId: id }))).toEqual({ outcome: "merged", item: id });
	expect(w.shim.calls()).toHaveLength(runs);
	expect(w.state.landings.get(id)).toBeUndefined();
	expect(github.requests.filter((r) => r.startsWith("GET"))).toHaveLength(1);
});

test("a change that waits for the owner runs on its level's tier and opens the same pull request without auto-merge; the owner's approval arms it", async () => {
	const w = await world({ script: [{}, NOTE] }, { config: configWith((raw) => void (raw.hum.paths = [{ glob: "docs/**", level: "high" }])) });
	const github = new FakePulls();
	const pulls = github.client();
	const id = w.repo.add("note", itemFile("Write the note", "ready", "touches: docs/note.md"));

	github.requiresPullRequest = true;
	expect(await runThinPath(w.options({ pulls }))).toMatchObject({ outcome: "landing", item: id });
	expect(github.pulls).toMatchObject([{ autoMerge: false, state: "OPEN" }]);
	expect(w.shim.calls().at(-1)?.argv).toContain(SHIPPED_DEFAULTS.models.top);

	await w.adapter.answers!.answer(id, { text: "approve", option: "approve" });
	w.clock.at += TTL;
	expect(await runThinPath(w.options({ pulls, itemId: id }))).toMatchObject({ outcome: "landing", item: id });
	expect(github.pulls).toMatchObject([{ autoMerge: true }]);
});

test("a push the remote refuses goes through a pull request, after the branch's rules are read again", async () => {
	const w = await world({ script: [{}, NOTE] });
	const github = new FakePulls();
	const pulls = github.client();
	const id = w.repo.seed("Write the note");

	expect(await pulls.rules("main")).toEqual({ requiresPullRequest: false, mergeMethods: undefined });
	github.requiresPullRequest = true;

	const refused = w.repo.refuseMainPushes(GH013);

	expect(await runThinPath(w.options({ pulls }))).toMatchObject({ outcome: "landing", item: id });
	expect(refused()).toBe(1);
	expect(github.requests.filter((r) => r.startsWith("GET"))).toHaveLength(2);
	expect(github.pulls).toMatchObject([{ head: runBranch(SHIPPED_DEFAULTS, id), autoMerge: true }]);
});

test("a run that lowers its own level, bumps the engine pin and edits a workflow and a hook is held for the owner: no hook runs and the owner's config stays", async () => {
	const templates = mkdtempSync(join(tmpdir(), "hum-templates-"));
	const ran = join(templates, "pre-push-ran");
	const previous = process.env.GIT_TEMPLATE_DIR;

	mkdirSync(join(templates, "hooks"));
	writeFileSync(join(templates, "hooks", "pre-push"), `#!/bin/sh\ntouch ${ran}\nexit 1\n`);
	chmodSync(join(templates, "hooks", "pre-push"), 0o755);

	const lowered = `${JSON.stringify({ schemaVersion: 1, paths: [{ glob: "**", level: "low" }] }, null, "\t")}\n`;

	const w = await world({
		script: [
			{},
			{
				commit: {
					".hum/hum.json": lowered,
					"package.json": '{ "dependencies": { "@moo.md/hum": "9.9.9" } }\n',
					".github/workflows/ci.yml": "on: push\n",
					".husky/pre-push": "exit 0\n",
					"docs/note.md": "hello\n",
				},
			},
		],
	});

	const github = new FakePulls();
	const id = w.repo.seed("Write the note");

	w.repo.put(".hum/hum.json", OWNER_CONFIG);

	// Every clone hum makes from here on carries a pre-push hook that would fail and leave a mark.
	process.env.GIT_TEMPLATE_DIR = templates;
	cleanups.push(() => {
		process.env.GIT_TEMPLATE_DIR = previous;
		rmSync(templates, { recursive: true, force: true });
	});
	github.requiresPullRequest = true;
	expect(await runThinPath(w.options({ pulls: github.client() }))).toMatchObject({ outcome: "landing", item: id });
	expect(github.pulls).toMatchObject([{ autoMerge: false, state: "OPEN" }]);
	expect(existsSync(ran)).toBe(false);
	expect(() => sh(w.repo.remote, ["show", "main:docs/note.md"])).toThrow();
	expect(sh(w.repo.remote, ["show", "main:.hum/hum.json"])).toBe(OWNER_CONFIG);
});

const featureJudge = scriptedJudge({ kind: { kind: "feature" }, alignment: SOUND });

test("a feature runs its plan and review states: the plan run's ready plan reaches the build, a review that cites a changed line sends it to a fix, and an approval merges it", async () => {
	const fixStdin = join(tmpdir(), `hum-review-fix-${process.pid}`);
	const cite = { event: "request-changes", sure: true, reason: "The note says nothing.", cites: [{ file: "docs/note.md", line: 1 }] };
	const w = await world({ script: [{}, NOTE, { commit: { "docs/note.md": "hello, reader\n" }, saveStdin: fixStdin }], decisions: [{ event: "plan-ready", sure: true, reason: "Clear.", plan: { summary: "Write the note.", steps: ["Write it."], paths: ["docs/note.md"] } }, cite] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options({ judge: featureJudge }))).toEqual({ outcome: "merged", item: id });

	const [plan, review, approval] = w.shim.decisions();

	expect([plan?.purpose, review?.purpose, approval?.answer.event]).toEqual(["plan", "review", "approve"]);
	expect(readFileSync(fixStdin, "utf8")).toContain("docs/note.md:1");
	expect(w.shim.calls().find((call) => call.itemId === id)).toBeDefined();
	expect(review?.cwd).not.toContain("hum-run-");
	expect(review?.prompt).not.toContain("Write it.");
	expect(w.repo.show(id)).toContain("state: done");
});

test("a medium change waits for a fresh review run at landing: a request for changes holds it for the owner, an approval merges it", async () => {
	const cite = { event: "request-changes", sure: true, reason: "Wrong file.", cites: [{ file: "docs/note.md", line: 1 }] };
	const w = await world({ script: [{}, NOTE], decisions: [cite] }, { config: configWith((raw) => void (raw.hum.paths = [{ glob: "docs/**", level: "medium" }])) });
	const held = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toEqual({ outcome: "review", item: held, detail: "the review run answered request-changes: Wrong file." });

	const merged = w.repo.seed("Write it again");

	expect(await runThinPath(w.options({ itemId: merged }))).toEqual({ outcome: "merged", item: merged });
	expect(w.shim.decisions().map((d) => [d.purpose, d.answer.event])).toEqual([["review", "request-changes"], ["review", "approve"]]);
});

test("a review run at landing counts toward the item's total, and one that passes the kind's cap holds the change for the owner", async () => {
	const approve = { event: "approve", sure: true, reason: "Fine." };

	const config = configWith((raw) => {
		raw.hum.paths = [{ glob: "docs/**", level: "medium" }];
		raw.kinds.docs.tokenCap.tokens = 305;
	});

	const w = await world({ script: [{}, { ...NOTE, modelTokens: 300 }], decisions: [approve] }, { config });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toMatchObject({ outcome: "review", item: id, detail: expect.stringContaining("the review run passed the item's token cap (305)") });
	expect(w.state.spent.get(id)?.total).toBeGreaterThan(305);
});

test("a plan run that splits its item files each part as a ready item and lands the item as done with no change of its own", async () => {
	const w = await world({ script: [{}], decisions: [{ event: "needs-split", sure: true, reason: "Two jobs.", parts: ["Write part one", "Write part two"] }] }, { checks: ["true"] });
	const id = w.repo.seed("Write two parts");

	expect(await runThinPath(w.options({ judge: featureJudge }))).toEqual({ outcome: "merged", item: id });
	expect(w.repo.show(id)).toContain("state: done");
	expect((await w.adapter.workSource!.listReady()).map((ref) => ref.title)).toEqual(["Write part one", "Write part two"]);
	expect(w.shim.calls()).toHaveLength(1);
});

test("a docs item whose change touches code moves to its real kind and runs again from the plan, on the same branch", async () => {
	const config = configWith((raw) => void (raw.hum.docsOnly.paths = ["**/*.md"]));
	const asked: string[] = [];
	const judge = scriptedJudge({ kind: { kind: "docs" }, alignment: SOUND }, asked);
	const w = await world({ script: [{}, { commit: { "src/x.ts": "x\n", "docs/note.md": "hello\n" } }] }, { config });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options({ judge }))).toEqual({ outcome: "moved", item: id, kind: "feature" });
	expect(w.state.itemKinds.get(id)).toMatchObject({ kind: "feature", from: "fallback" });
	expect(asked).toEqual(["kind", "kind"]);

	await runThinPath(w.options({ judge, itemId: id }));

	expect(w.shim.decisions()[0]?.purpose).toBe("plan");
});

test("the alignment grade times out: the change is unclear and waits for the owner's review at its level, with no question", async () => {
	const hanging: Runner = { run: (request) => new Promise((resolve) => request.signal?.addEventListener("abort", () => resolve({ kind: "stopped" }))), limitedUntil: () => 0 };
	const alignment = modelCallOver(hanging, { model: "m", timeoutMs: 5, trusts: () => true });
	const judge: ModelCall = (question) => (question.boundary === "alignment" ? alignment(question) : docsJudge(question));
	const w = await world({ script: [{}, NOTE] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options({ judge }))).toEqual({ outcome: "review", item: id, detail: "the alignment call abstained: the call timed out" });
	expect(await questionsOn(w, id)).toEqual([]);
	expect(w.shim.decisions()).toEqual([]);
});

test("an alignment call below the bar gates nothing: the change still lands by its level, the grades are a pull request comment", async () => {
	const config = configWith((raw) => {
		raw.hum.measuredModels.alignment = { [raw.hum.decisionModel]: 0.68 };
	});

	const judge = scriptedJudge({ kind: { kind: "docs" }, alignment: { alignment: "concern", verification: "concern" } });
	const w = await world({ script: [{}, NOTE] }, { config });
	const github = new FakePulls();
	const id = w.repo.seed("Write the note");

	github.requiresPullRequest = true;
	expect(await runThinPath(w.options({ judge, pulls: github.client() }))).toMatchObject({ outcome: "landing", item: id });
	expect(github.pulls).toMatchObject([{ autoMerge: true }]);
	expect(github.requests).toContain("graphql Comment");
});

test("a review that leaves the change to the owner asks; the owner's approval lands it past its level's own review run, and a rejection sends it to a fix with the owner's words", async () => {
	const toOwner = { event: "needs-owner", sure: true, reason: "A matter of tone.", question: "Is the tone right?" };
	const ready = { event: "plan-ready", sure: true, reason: "Clear.", plan: { summary: "Write the note.", steps: ["Write it."], paths: ["docs/note.md"] } };
	const fixStdin = join(tmpdir(), `hum-owner-fix-${process.pid}`);
	const config = configWith((raw) => void (raw.hum.paths = [{ glob: "docs/**", level: "medium" }]));
	const w = await world({ script: [{}, NOTE, { commit: { "docs/other.md": "other\n" } }, { commit: { "docs/other.md": "other, softer\n" }, saveStdin: fixStdin }], decisions: [ready, toOwner, ready, toOwner] }, { config });
	const approved = w.repo.seed("Write the note");

	expect(await runThinPath(w.options({ judge: featureJudge }))).toEqual({ outcome: "asked", item: approved, detail: "Is the tone right?" });

	await w.adapter.answers!.answer(approved, { text: "yes", option: "approve" });

	expect(await runThinPath(w.options({ judge: featureJudge, itemId: approved }))).toEqual({ outcome: "merged", item: approved });

	const rejected = w.repo.seed("Write another note");

	expect(await runThinPath(w.options({ judge: featureJudge, itemId: rejected }))).toMatchObject({ outcome: "asked", item: rejected });

	await w.adapter.answers!.answer(rejected, { text: "Make it softer." });

	expect(await runThinPath(w.options({ judge: featureJudge, itemId: rejected }))).toEqual({ outcome: "merged", item: rejected });
	expect(readFileSync(fixStdin, "utf8")).toContain("Make it softer.");
});

test("a cheap choice a run reports is made without the owner, listed with its time, and the run goes on", async () => {
	const options = [{ word: "short", paths: ["docs/note.md"] }, { word: "long", paths: ["docs/note.md"] }];
	const choice = { status: "needs-owner", question: "Short or long?", plan: "Write it.", reason: { kind: "choice", options, default: "short" } };
	const w = await world({ script: [{}, { commit: { "docs/note.md": "one\n" }, structured: choice }, NOTE] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toEqual({ outcome: "merged", item: id });
	expect(w.state.choices.list()).toEqual([{ item: id, text: 'Chose "short" over long without you.', at: expect.any(Number) }]);
});
