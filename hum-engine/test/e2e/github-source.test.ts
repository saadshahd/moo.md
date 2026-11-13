import { expect, test } from "bun:test";
import { existsSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AdapterContext, gitHubClient, githubAdapter } from "../../src/index.ts";
import { guarded, guardTimings } from "../../src/adapters/guard.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../../src/exec.ts";
import { runThinPath } from "../../src/worker/thin-path.ts";
import { FakeGitHub } from "../fixtures/fake-github.ts";
import { sh, WorkRepo } from "../fixtures/work-repo.ts";
import { gitIn } from "../../src/adapters/git.ts";
import { dropEvidence, evidenceMarkdown, evidenceRef, keepEvidence } from "../../src/worker/evidence.ts";
import { pushRunBranch } from "../../src/worker/signed-push.ts";
import { OWNER } from "../fixtures/identity.ts";
import { tempDir } from "../fixtures/temp.ts";
import { workerWorld } from "../fixtures/worker-world.ts";
import { ItemId } from "../../src/adapter-api.ts";

const NOTE = { write: { "docs/note.md": "hello\n" } };

/** The pull request a build run writes under the repo's rules, naming a picture it saved. */
const WRITTEN = { title: "Write the note", body: "## Context\nThe item asks for a note in docs, so readers find it there.\n\n## Testing\ntest -f docs/note.md passes.", evidence: "note.png" };

/** A worker world whose items are issues on a fake GitHub, with the change's git branches on the world's bare remote. */
const issuesWorld = async ({ requiresPullRequest, requiresSignatures = false }: { readonly requiresPullRequest: boolean; readonly requiresSignatures?: boolean }) => {
	const w = await workerWorld({ script: [{}, { ...NOTE, saveEvidence: WRITTEN.evidence, structured: { status: "done", pullRequest: WRITTEN } }] }, { checks: ["test -f docs/note.md"] });
	const github = new FakeGitHub();
	const context: AdapterContext = { report: () => {}, now: Date.now, env: process.env };
	const client = gitHubClient({ token: "fake-token", fetch: github.fetch, spaced: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	const issues = guarded(
		githubAdapter({ repo: github.repo, base: "main", client, claimPrefix: SHIPPED_DEFAULTS.claimPrefix, readyLabel: SHIPPED_DEFAULTS.readyLabel, mergeMethod: SHIPPED_DEFAULTS.mergeMethod, ownerLogins: [], timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }, context),
		{ provider: "github", faults: w.state.faults, ...guardTimings(w.config.hum) },
	);

	github.requiresPullRequest = requiresPullRequest;
	github.requiresSignatures = requiresSignatures;
	github.gitRemote = w.repo.remote;

	// A ruleset that requires signatures refuses every git push to a branch: none of hum's own commits is signed.
	const refused = requiresSignatures ? w.repo.refusePushes({ refs: "refs/heads/*", said: "GH013: Repository rule violations found. Commits must have verified signatures." }) : () => 0;
	const id = ItemId.parse(String(github.seed("Write the note")));
	const pass = () => runThinPath(w.thinPath({ workSource: issues.workSource!, questions: issues.questions!, pulls: github.client(), commits: github.commits(), itemId: id }));

	return { w, github, issues, id, pass, refused };
};

test("an issue lands through a pull request: no item file is marked, the pull request names the item, and once it merges the issue closes and is never listed again", async () => {
	const { w, github, issues, id, pass } = await issuesWorld({ requiresPullRequest: true });

	expect(await pass()).toMatchObject({ outcome: "landing", item: id });

	const [pull] = github.pulls();

	// The build run wrote the pull request under the repo's rules; hum adds its evidence line, its word on the merge and the item after it.
	expect(pull?.title).toBe(WRITTEN.title);
	expect(pull?.body).toStartWith(WRITTEN.body);
	expect(pull?.body).toContain("The run's evidence was left out: the repo is not on GitHub");
	expect(pull?.body).toEndWith(`Item ${id}.`);
	expect(sh(w.repo.remote, ["ls-tree", "-r", "--name-only", pull?.head ?? ""]).split("\n")).not.toContain(join(SHIPPED_DEFAULTS.itemsDir, `${id}.md`));
	expect(github.issueState(Number(id))).toBe("OPEN");

	github.checksPass(pull?.number ?? 0);

	expect(await pass()).toEqual({ outcome: "merged", item: id });
	expect(github.issueState(Number(id))).toBe("CLOSED");
	expect(await issues.workSource!.listReady()).toEqual([]);
	expect(w.state.merges.get(id)).toBeDefined();
});

test("an issue whose base takes a push lands on main and closes, with no item file in the repo, as hum's commit under the run's pull request title", async () => {
	const { w, github, id, pass } = await issuesWorld({ requiresPullRequest: false });

	expect(await pass()).toEqual({ outcome: "merged", item: id });
	expect(sh(w.repo.remote, ["show", "main:docs/note.md"])).toBe("hello\n");
	expect(existsSync(join(w.repo.owner, SHIPPED_DEFAULTS.itemsDir, `${id}.md`))).toBe(false);
	expect(sh(w.repo.remote, ["log", "--format=%s %an", "-1", "main"]).trim()).toBe(`${WRITTEN.title} ${w.config.hum.commitIdentity.name}`);
	expect(github.pulls()).toEqual([]);
	expect(github.issueState(Number(id))).toBe("CLOSED");
});

test("a run's picture of its change is kept alone on the item's evidence ref, never a branch, and linked by its commit", async () => {
	const repo = new WorkRepo();
	const clone = repo.worker("run");
	const folder = tempDir("evidence");

	writeFileSync(join(folder, "shot.png"), "\u0089PNG\r\n");

	const kept = await keepEvidence({ git: gitIn(clone, { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), folder, file: "shot.png", item: "7", repo: "me/scratch" });
	const commit = sh(repo.remote, ["rev-parse", evidenceRef("7")]).trim();

	expect(kept).toEqual({ kind: "image", url: `https://github.com/me/scratch/blob/${commit}/shot.png?raw=true` });
	expect(sh(repo.remote, ["ls-tree", "--name-only", commit]).trim()).toBe("shot.png");
	expect(sh(repo.remote, ["for-each-ref", "--format=%(refname)", "refs/heads"]).trim()).toBe("refs/heads/main");
	expect(evidenceMarkdown(kept)).toBe(`![The change at work](${"url" in kept ? kept.url : ""})`);
	expect(await keepEvidence({ git: gitIn(clone, { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), folder, file: "notes.txt", item: "7", repo: "me/scratch" })).toEqual({ left: "notes.txt is no picture or video" });
});

test("a run's evidence that is a link is left out, so no file the link names is pushed", async () => {
	const repo = new WorkRepo();
	const folder = tempDir("evidence");

	writeFileSync(join(folder, "secret.txt"), "token\n");
	symlinkSync(join(folder, "secret.txt"), join(folder, "shot.png"));

	expect(await keepEvidence({ git: gitIn(repo.worker("run"), { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), folder, file: "shot.png", item: "7", repo: "me/scratch" })).toEqual({ left: "shot.png is no plain file" });
	expect(sh(repo.remote, ["for-each-ref", "refs/hum"]).trim()).toBe("");
});

test("a merged item's evidence ref is taken off the remote, and taking it off again does nothing", async () => {
	const repo = new WorkRepo();
	const git = gitIn(repo.worker("run"), { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const folder = tempDir("evidence");

	writeFileSync(join(folder, "shot.png"), "\u0089PNG\r\n");
	await keepEvidence({ git, folder, file: "shot.png", item: "7", repo: "me/scratch" });
	await dropEvidence(git, { remote: "origin", item: "7" });
	await dropEvidence(git, { remote: "origin", item: "7" });

	expect(sh(repo.remote, ["for-each-ref", "refs/hum"]).trim()).toBe("");
});

test("where main requires signed commits, the change reaches its branch as one commit GitHub made, with the run's tree, and the pull request lands that", async () => {
	const { w, github, id, pass, refused } = await issuesWorld({ requiresPullRequest: true, requiresSignatures: true });

	expect(await pass()).toMatchObject({ outcome: "landing", item: id });

	const [pull] = github.pulls();
	const commits = sh(w.repo.remote, ["rev-list", `main..${pull?.head}`]).split("\n").filter(Boolean);

	expect(commits).toHaveLength(1);
	expect(github.signed.has(commits[0] ?? "")).toBe(true);
	expect(sh(w.repo.remote, ["show", `${pull?.head}:docs/note.md`])).toBe("hello\n");
	expect(refused()).toBe(0);
	expect(w.state.landings.get(id)?.head).toBe(commits[0]);
});

test("where main requires signed commits and takes a push, main moves to GitHub's signed commit as a fast-forward, and no git push is made to a branch", async () => {
	const { w, github, id, pass, refused } = await issuesWorld({ requiresPullRequest: false, requiresSignatures: true });

	expect(await pass()).toEqual({ outcome: "merged", item: id });

	const tip = sh(w.repo.remote, ["rev-parse", "main"]).trim();

	expect(github.signed.has(tip)).toBe(true);
	expect(sh(w.repo.remote, ["show", "main:docs/note.md"])).toBe("hello\n");
	expect(refused()).toBe(0);
	expect(github.issueState(Number(id))).toBe("CLOSED");
});

test("where main requires signed commits, a binary file reaches GitHub's commit byte for byte", async () => {
	const repo = new WorkRepo();
	const github = new FakeGitHub();
	const clone = repo.worker("run");
	const git = gitIn(clone, { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const bytes = Buffer.from(Array.from({ length: 256 }, (_, at) => at));

	github.requiresSignatures = true;
	github.gitRemote = repo.remote;
	writeFileSync(join(clone, "logo.bin"), bytes);
	writeFileSync(join(clone, "note.md"), "hello\n");
	await git.raw(["checkout", "-q", "-b", "hum/run/9"]);
	await git.raw(["add", "logo.bin", "note.md"]);
	await git.raw(["commit", "-q", "-m", "add a logo"]);

	expect(await pushRunBranch({ git, base: "main", pulls: github.client(), commits: github.commits() }, "hum/run/9")).toEqual({ kind: "pushed" });
	expect(Bun.spawnSync(["git", "show", "hum/run/9:logo.bin"], { cwd: repo.remote }).stdout).toEqual(bytes);
});

test("a change GitHub's API cannot carry, such as an executable bit, fails loud and leaves the remote's branches as they were", async () => {
	const repo = new WorkRepo();
	const github = new FakeGitHub();
	const clone = repo.worker("run");
	const git = gitIn(clone, { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	github.requiresSignatures = true;
	github.gitRemote = repo.remote;
	writeFileSync(join(clone, "run.sh"), "#!/bin/sh\n", { mode: 0o755 });
	await git.raw(["checkout", "-q", "-b", "hum/run/9"]);
	await git.raw(["add", "run.sh"]);
	await git.raw(["commit", "-q", "-m", "add a script"]);

	await expect(pushRunBranch({ git, base: "main", pulls: github.client(), commits: github.commits() }, "hum/run/9")).rejects.toThrow("an executable bit, a link or a submodule");
	expect(sh(repo.remote, ["for-each-ref", "--format=%(refname)", "refs/heads"]).trim()).toBe("refs/heads/main");
});
