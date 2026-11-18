import { expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitIn } from "../src/adapters/git.ts";
import type { HumConfig } from "../src/config/schema.ts";
import { growthLabelsOf } from "../src/decide/growth.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";
import { sh } from "./fixtures/work-repo.ts";

/** transferwise/selective's byte ratchet: agent context and the other docs are each summed on their own, and either growing needs `grow`. */
const SELECTIVE: HumConfig["growthLabels"] = [
	{ label: "grow", paths: ["AGENTS.md", ".claude/**", ".github/**"], except: [] },
	{ label: "grow", paths: ["**/*.md"], except: ["AGENTS.md", ".claude/**", ".github/**", "docs/specs/**", ".planning/PROJECT.md"] },
];

const RANGE = { base: "main", head: "change" };

/** Writes each file and commits them all on the branch checked out. */
const commit = (repo: string, files: Readonly<Record<string, string>>): void => {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(repo, path)), { recursive: true });
		writeFileSync(join(repo, path), text);
	}

	sh(repo, ["add", "-A"]);
	sh(repo, ["commit", "-q", "--allow-empty", "-m", "change"]);
};

/** A repo whose `main` holds `base` and whose `change` branch, cut from it, holds `change` on top and is checked out. */
const repoWith = (base: Readonly<Record<string, string>>, change: Readonly<Record<string, string>>) => {
	const repo = tempDir("growth");

	sh(repo, ["init", "-q", "-b", "main"]);
	commit(repo, base);
	sh(repo, ["checkout", "-q", "-b", "change"]);
	commit(repo, change);

	return { repo, git: gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }) };
};

const BASE = { "README.md": "r".repeat(100), "AGENTS.md": "a".repeat(50), "docs/specs/one.md": "s", "src/app.ts": "x" };

test("a change that grows one rule's files needs its label, though another rule's files with that label lose more", async () => {
	const { git } = repoWith(BASE, { "README.md": "r".repeat(80), "AGENTS.md": "a".repeat(60) });

	expect(await growthLabelsOf(git, RANGE, SELECTIVE)).toEqual(["grow"]);
	expect(await growthLabelsOf(git, RANGE, [{ label: "grow", paths: ["**/*.md"], except: [] }])).toEqual([]);
});

test("a change that shrinks the guarded files, or grows only excepted, unguarded or non-regular files, needs no label", async () => {
	const { repo, git } = repoWith(BASE, { "README.md": "r".repeat(99), "docs/specs/one.md": "s".repeat(500), "src/app.ts": "x".repeat(500) });

	expect(await growthLabelsOf(git, RANGE, SELECTIVE)).toEqual([]);

	// A symlink is no regular file, and selective's ratchet counts none.
	mkdirSync(join(repo, ".claude"));
	symlinkSync("a-target-whose-name-is-long.md", join(repo, ".claude", "link.md"));
	commit(repo, {});

	expect(await growthLabelsOf(git, RANGE, SELECTIVE)).toEqual([]);
});

test("only the change's own files count: guarded files the base gained after the change left it need no label", async () => {
	const { repo, git } = repoWith(BASE, { "src/app.ts": "y" });

	sh(repo, ["checkout", "-q", "main"]);
	commit(repo, { "AGENTS.md": "a".repeat(5000) });

	expect(await growthLabelsOf(git, RANGE, SELECTIVE)).toEqual([]);
});

test("without a rule no git runs", async () => {
	const ran = () => Promise.reject(new Error("git ran"));

	expect(await growthLabelsOf({ run: ran, raw: ran, bytes: ran }, RANGE, [])).toEqual([]);
});
