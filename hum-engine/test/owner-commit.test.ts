import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { markdownAdapter } from "../src/adapters/markdown.ts";
import { landOwnerCommit } from "../src/adapters/owner-commit.ts";
import { FakeGitHub } from "./fixtures/fake-github.ts";
import { markdownSettings, sh, WorkRepo } from "./fixtures/work-repo.ts";

const ANSWER = '"kind":"answer"';

/** An owner's commit on a repo that is not on GitHub, where a push is the only way to land. */
const OFF_GITHUB = { sha: "0123456789abcdef", base: "main", label: "7", title: "t", body: "b", branchPrefix: "hum/owner/", mergeMethod: "squash" as const, alwaysPullRequest: false, labels: [] };

const world = (over: Partial<typeof markdownSettings> = {}) => {
	const repo = new WorkRepo();
	const github = new FakeGitHub();
	const adapter = markdownAdapter({ repo: repo.worker("w"), base: "main", ...markdownSettings, ...over, pulls: github.client() }, { report: () => {}, now: Date.now, env: process.env });

	return { repo, github, adapter, id: repo.seed("asked") };
};

const branches = (remote: string): string[] =>
	sh(remote, ["for-each-ref", "--format=%(refname:short)", "refs/heads/hum/owner/"])
		.split("\n")
		.filter(Boolean);

test("where the base needs no pull request, the owner's answer is pushed to it", async () => {
	const { repo, github, adapter, id } = world();

	await adapter.answers?.answer(id, { text: "yes" });

	expect(repo.show(id)).toContain(ANSWER);
	expect(github.pulls()).toEqual([]);
});

test("where the base needs a pull request, each answer goes through its own that merges itself, and the base stays as it was", async () => {
	const { repo, github, adapter, id } = world();

	github.requiresPullRequest = true;

	await adapter.answers?.answer(id, { text: "first" });
	await adapter.answers?.answer(id, { text: "second" });

	expect(repo.show(id)).not.toContain(ANSWER);
	expect(branches(repo.remote)).toHaveLength(2);
	expect(github.pulls().map((pull) => [pull.base, pull.autoMerge])).toEqual([
		["main", true],
		["main", true],
	]);
});

test("with alwaysPullRequest on, an answer goes through a pull request that merges itself though the base takes a push", async () => {
	const { repo, github, adapter, id } = world({ alwaysPullRequest: true });

	await adapter.answers?.answer(id, { text: "yes" });

	expect(repo.show(id)).not.toContain(ANSWER);
	expect(github.pulls().map((pull) => [pull.base, pull.autoMerge])).toEqual([["main", true]]);
});

test("an answer's pull request gets each growth label whose files the answer grows, and no other", async () => {
	const { github, adapter, id } = world({
		growthLabels: [
			{ label: "grow", paths: [".hum/**"], except: [] },
			{ label: "src", paths: ["src/**"], except: [] },
		],
	});

	github.requiresPullRequest = true;
	await adapter.answers?.answer(id, { text: "yes" });

	expect(github.pulls().map((pull) => pull.labels)).toEqual([["grow"]]);
});

test("a push the remote refuses goes through a pull request when the repo is on GitHub", async () => {
	const { repo, github, adapter, id } = world();
	const hook = join(repo.remote, "hooks", "pre-receive");

	mkdirSync(dirname(hook), { recursive: true });
	writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do case "$ref" in refs/heads/main) echo "GH006: Protected branch update failed" >&2; exit 1;; esac; done\n`);
	chmodSync(hook, 0o755);

	await adapter.answers?.answer(id, { text: "yes" });

	expect(github.pulls()).toHaveLength(1);
	expect(branches(repo.remote)).toHaveLength(1);
});

test("off GitHub, a push the remote refuses lands nothing and hands back the remote's words", async () => {
	const refused = { kind: "refused" as const, said: "git push refused: GH006: Protected branch update failed" };

	expect(await landOwnerCommit({ ...OFF_GITHUB, push: async () => refused })).toEqual({ via: "refused", said: refused.said });
});

test("off GitHub with alwaysPullRequest on, nothing is pushed and the refusal says why", async () => {
	const pushed: string[][] = [];

	expect(await landOwnerCommit({ ...OFF_GITHUB, alwaysPullRequest: true, push: async (refspecs) => (pushed.push([...refspecs]), { kind: "pushed" }) })).toEqual({ via: "refused", said: "alwaysPullRequest is on, and main is not on GitHub" });
	expect(pushed).toEqual([]);
});
