import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Git, gitIn } from "../src/adapters/git.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import type { Verdict } from "../src/state/saved.ts";
import { carriedVerdict, patchOf, rebaseOnto } from "../src/worker/land.ts";
import { configWith } from "./fixtures/config.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

/** The test config, with the prose globs hum ships: the test config counts every path as docs. */
const config = configWith((raw) => void (raw.hum.docsOnly = SHIPPED_DEFAULTS.docsOnly));

/** A worker clone on a run branch off main, and a commit on it of one file. */
const runClone = () => {
	const repo = new WorkRepo();
	const clone = repo.worker("run");
	const git = gitIn(clone, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	sh(clone, ["checkout", "-q", "-b", "run"]);

	const commit = (path: string): string => {
		mkdirSync(join(clone, dirname(path)), { recursive: true });
		writeFileSync(join(clone, path), `${path}\n`);
		sh(clone, ["add", "-A"]);
		sh(clone, ["commit", "-q", "-m", `add ${path}`]);

		return sh(clone, ["rev-parse", "HEAD"]).trim();
	};

	/** The owner pushes `path` to main, and the clone fetches it; returns the new main. */
	const moveBase = (path: string): string => {
		repo.put({ path, content: "moved\n" });
		sh(clone, ["fetch", "-q", "origin"]);

		return sh(clone, ["rev-parse", "origin/main"]).trim();
	};

	return { clone, git, commit, moveBase };
};

const patchAt = (git: Git): Promise<string> => patchOf({ git, base: "main", dir: config.hum.itemsDir, id: "x" });

const verdictAt = (head: string, patch: string, event: string): Verdict => ({ item: "x", head, patch, event, reason: "r", cites: [], models: ["m"] });

test("a verdict holds for its change rebased onto a moved base, and an approval holds past a later change of prose alone", async () => {
	const { clone, git, commit, moveBase } = runClone();
	const reviewed = commit("src/a.ts");
	const patch = await patchAt(git);
	const changes = verdictAt(reviewed, patch, "request-changes");

	sh(clone, ["rebase", "-q", moveBase("lib/b.ts")]);

	const rebased = sh(clone, ["rev-parse", "HEAD"]).trim();

	expect(await carriedVerdict({ git, config }, changes, { head: rebased, patch: await patchAt(git) })).toEqual({ ...changes, head: rebased });

	const approval = verdictAt(rebased, patch, "approve");
	const prose = commit("docs/note.md");
	const prosePatch = await patchAt(git);

	expect(await carriedVerdict({ git, config }, approval, { head: prose, patch: prosePatch })).toEqual({ ...approval, head: prose, patch: prosePatch });
	expect(await carriedVerdict({ git, config }, changes, { head: prose, patch: prosePatch })).toBeUndefined();

	const code = commit("src/c.ts");

	expect(await carriedVerdict({ git, config }, approval, { head: code, patch: await patchAt(git) })).toBeUndefined();
});

test("a base that moved only in folders the change leaves alone takes the change rebased with no check run; a move beside it or at the top runs the checks", async () => {
	const { clone, git, commit, moveBase } = runClone();
	const rebase = (onto: string) => rebaseOnto({ git, clone, env: {}, checks: ["false"], config, base: "main" }, onto);

	commit("src/a.ts");

	const elsewhere = moveBase("lib/b.ts");

	expect(await rebase(elsewhere)).toBeUndefined();
	expect(sh(clone, ["merge-base", "--is-ancestor", elsewhere, "HEAD"])).toBe("");
	expect(await rebase(moveBase("src/c.ts"))).toContain("the checks fail on the newest main");
	expect(await rebase(moveBase("package.json"))).toContain("the checks fail on the newest main");
});
