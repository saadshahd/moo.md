import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { markdownAdapter } from "../src/adapters/markdown.ts";
import { FakePulls } from "./fixtures/fake-pulls.ts";
import { markdownSettings, sh, WorkRepo } from "./fixtures/work-repo.ts";

const ANSWER = '"kind":"answer"';

const world = () => {
	const repo = new WorkRepo();
	const github = new FakePulls();
	const adapter = markdownAdapter({ repo: repo.worker("w"), base: "main", ...markdownSettings, pulls: github.client() }, { report: () => {}, now: Date.now });

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
	expect(github.pulls).toEqual([]);
});

test("where the base needs a pull request, each answer goes through its own that merges itself, and the base stays as it was", async () => {
	const { repo, github, adapter, id } = world();

	github.requiresPullRequest = true;

	await adapter.answers?.answer(id, { text: "first" });
	await adapter.answers?.answer(id, { text: "second" });

	expect(repo.show(id)).not.toContain(ANSWER);
	expect(branches(repo.remote)).toHaveLength(2);
	expect(github.pulls.map((pull) => [pull.base, pull.autoMerge])).toEqual([
		["main", true],
		["main", true],
	]);
});

test("a push the remote refuses goes through a pull request when the repo is on GitHub", async () => {
	const { repo, github, adapter, id } = world();
	const hook = join(repo.remote, "hooks", "pre-receive");

	mkdirSync(dirname(hook), { recursive: true });
	writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do case "$ref" in refs/heads/main) echo "GH006: Protected branch update failed" >&2; exit 1;; esac; done\n`);
	chmodSync(hook, 0o755);

	await adapter.answers?.answer(id, { text: "yes" });

	expect(github.pulls).toHaveLength(1);
	expect(branches(repo.remote)).toHaveLength(1);
});
