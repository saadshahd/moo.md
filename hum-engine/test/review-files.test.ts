import { expect, test } from "bun:test";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { gitIn } from "../src/adapters/git.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { readReviewFiles } from "../src/worker/review-files.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

/** A clone of a repo whose main holds a rules file, a scenario, a secret, a folder and a link to the rules. */
const repo = new WorkRepo();

for (const [path, content] of Object.entries({ "AGENTS.md": "Reuse first.\n", "scenarios/a.md": "Given a user\n", "secrets/key.md": "k\n", "docs/x.md": "x\n" })) repo.put({ path, content });

symlinkSync("AGENTS.md", join(repo.owner, "link.md"));

sh(repo.owner, ["add", "link.md"]);

sh(repo.owner, ["commit", "-q", "-m", "link the rules"]);

sh(repo.owner, ["push", "-q", "origin", "main"]);

const git = gitIn(repo.worker("review"), { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

const policy = { reviewReads: { paths: ["AGENTS.md"], maxBytes: 100 }, strictPaths: ["secrets/**"] };

test("a review reads the repo's own files, then the ones the item names, as the base holds them", async () => {
	const read = await readReviewFiles(git, "origin/main", { body: "Do it.\n\nreads: scenarios/a.md, AGENTS.md" }, policy);

	expect(read.ok && read.files.map(({ path, bytes }) => [path, new TextDecoder().decode(bytes)])).toEqual([
		["AGENTS.md", "Reuse first.\n"],
		["scenarios/a.md", "Given a user\n"],
	]);
});

test.each([
	["gone.md", "git does not track it on origin/main"],
	["link.md", "it is not a regular file"],
	["docs", "it is not a regular file"],
	["secrets/key.md", "strictPaths marks it as data or secrets"],
	["../outside.md", "it is not a path inside the repo"],
])("a review whose item names %s cannot read it: %s", async (path, why) => {
	expect(await readReviewFiles(git, "origin/main", { body: `reads: ${path}` }, policy)).toEqual({ ok: false, why: `the review cannot read ${path}: ${why}` });
});
