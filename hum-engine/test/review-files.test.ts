import { expect, test } from "bun:test";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { gitIn } from "../src/adapters/git.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { readReviewFiles } from "../src/worker/review-files.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

/** A clone of a repo whose main holds a rules file, a scenario, a secret, folders of rules, of config and of links, and a link to the rules. */
const repo = new WorkRepo();

for (const [path, content] of Object.entries({
	"AGENTS.md": "Reuse first.\n",
	"scenarios/a.md": "Given a user\n",
	"secrets/key.md": "k\n",
	"docs/x.md": "x\n",
	"docs/y.md": "y\n",
	"config/app.md": "app\n",
	"config/.env": "k\n",
	"linked/a.md": "a\n",
}))
	repo.put({ path, content });

symlinkSync("AGENTS.md", join(repo.owner, "link.md"));

symlinkSync("../AGENTS.md", join(repo.owner, "linked", "rules.md"));

sh(repo.owner, ["add", "link.md", "linked/rules.md"]);

sh(repo.owner, ["commit", "-q", "-m", "link the rules"]);

sh(repo.owner, ["push", "-q", "origin", "main"]);

const git = gitIn(repo.worker("review"), { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

const policy = { reviewReads: { paths: ["AGENTS.md"], maxBytes: 100 }, strictPaths: ["secrets/**", "**/.env*"] };

test.each([
	["scenarios/a.md, AGENTS.md", [["AGENTS.md", "Reuse first.\n"], ["scenarios/a.md", "Given a user\n"]]],
	["docs", [["AGENTS.md", "Reuse first.\n"], ["docs/x.md", "x\n"], ["docs/y.md", "y\n"]]],
	["docs/y.md, docs", [["AGENTS.md", "Reuse first.\n"], ["docs/y.md", "y\n"], ["docs/x.md", "x\n"]]],
])("a review whose item reads %s reads the repo's own files, then each file the item names, once, as the base holds it", async (reads, files) => {
	const read = await readReviewFiles(git, "origin/main", { body: `Do it.\n\nreads: ${reads}` }, policy);

	expect(read.ok && read.files.map(({ path, bytes }) => [path, new TextDecoder().decode(bytes)])).toEqual(files);
});

test.each([
	["gone.md", "gone.md", "git does not track it on origin/main"],
	["link.md", "link.md", "it is not a regular file"],
	["linked", "linked/rules.md", "it is not a regular file"],
	["secrets/key.md", "secrets/key.md", "strictPaths marks it as data or secrets"],
	["config", "config/.env", "strictPaths marks it as data or secrets"],
	["../outside.md", "../outside.md", "it is not a path inside the repo"],
])("a review whose item names %s cannot read %s: %s", async (named, path, why) => {
	expect(await readReviewFiles(git, "origin/main", { body: `reads: ${named}` }, policy)).toEqual({ ok: false, why: `the review cannot read ${path}: ${why}` });
});
