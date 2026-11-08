import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRunner } from "../../src/adapters/claude-p.ts";
import { markdownAdapter } from "../../src/adapters/markdown.ts";
import type { Config } from "../../src/config/load.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { openState } from "../../src/state/open.ts";
import { PLAN_MARK, runBranch, runThinPath, type ThinPathOptions } from "../../src/worker/thin-path.ts";
import { configWith } from "../fixtures/config.ts";
import { WorkRepo, itemFile, markdownSettings, sh } from "../fixtures/work-repo.ts";
import { makeShim, type ShimSpec } from "../fixtures/shim.ts";

const NOW = 1_800_000_000_000;
const TTL = SHIPPED_DEFAULTS.claimExpirySeconds * 1000;
const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const clean of cleanups.splice(0)) clean();
});

const world = async (spec: ShimSpec, { config = configWith(), checks = ["test -f docs/note.md"] }: { config?: Config; checks?: string[] } = {}) => {
	const repo = new WorkRepo();
	const clock = { at: NOW };
	const now = () => clock.at;
	const shim = makeShim(spec);
	const state = openState(mkdtempSync(join(tmpdir(), "hum-thin-")), { now });
	const reports: string[] = [];
	const adapter = markdownAdapter({ ...markdownSettings, repo: repo.worker("w") }, { report: (f) => reports.push(f.code), now });
	const { check, runner } = await startRunner({ state, model: config.hum.models.light, binary: shim.binary, env: shim.env, now });

	cleanups.push(() => rmSync(repo.root, { recursive: true, force: true }), () => rmSync(state.dir, { recursive: true, force: true }));

	expect(check.kind).toBe("finished");

	const options = (over: Partial<ThinPathOptions> = {}): ThinPathOptions => ({
		workSource: adapter.workSource!,
		questions: adapter.questions!,
		state,
		runner,
		config,
		kind: "docs",
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

test("failed checks go to a fix run, and the fix run gets the failure", async () => {
	const w = await world({ script: [{}, { commit: { "docs/note.md": "BAD\n" } }, { commit: { "docs/note.md": "good\n" }, saveStdin: join(tmpdir(), `hum-fix-stdin-${process.pid}`) }] }, { checks: ["! grep -q BAD docs/note.md"] });
	const id = w.repo.seed("Write the note");

	expect(await runThinPath(w.options())).toEqual({ outcome: "merged", item: id });
	expect(w.shim.calls()).toHaveLength(3);
	expect(readFileSync(join(tmpdir(), `hum-fix-stdin-${process.pid}`), "utf8")).toContain("The checks failed");
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

test("a change to a path no rule matches is not merged by the thin path", async () => {
	const w = await world({ script: [{}, { commit: { "src/x.ts": "x\n", "docs/note.md": "hello\n" } }] });
	const id = w.repo.seed("Write the note");
	const before = sh(w.repo.remote, ["rev-parse", "main"]);
	const result = await runThinPath(w.options());

	expect(result).toMatchObject({ outcome: "review", item: id });
	expect(sh(w.repo.remote, ["rev-parse", "main"])).toBe(before);
	expect(w.repo.show(id)).toContain("state: ready");
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

test("a claim another worker holds is lost, and no run starts", async () => {
	const w = await world({ script: [{}, NOTE] });
	const id = w.repo.seed("Write the note");

	expect((await w.adapter.workSource!.claim(id, "worker-2", TTL)).won).toBe(true);
	expect(await runThinPath(w.options({ itemId: id }))).toEqual({ outcome: "lost", item: id });
	expect(w.shim.calls()).toHaveLength(1);
});
