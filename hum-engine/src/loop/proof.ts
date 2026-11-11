import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Git } from "../adapters/git.ts";
import { runChecks } from "../worker/checks.ts";
import type { ReviewNote } from "./records.ts";

export type ProofOptions = {
	/** The repo the commits are in. */
	readonly git: Git;
	/** The check item's commit: the base with the new check on it. */
	readonly head: string;
	readonly base: string;
	/** The notes whose commits the check must fail on. */
	readonly notes: readonly ReviewNote[];
	/** The repo's checks, which include the new one. */
	readonly checks: readonly string[];
	readonly timeoutMs: number;
	readonly now: () => number;
};

export type ProofResult = {
	readonly passed: boolean;
	readonly reason?: string;
	/** Worktrees made: one per note commit and one for the head. */
	readonly worktrees: number;
	readonly ms: number;
};

const isCommit = async (git: Git, sha: string): Promise<boolean> => (await git.run(["cat-file", "-e", `${sha}^{commit}`])).code === 0;

/** The files the check item adds or changes against the base. */
const checkFiles = async (git: Git, base: string, head: string): Promise<string[]> =>
	(await git.raw(["diff", "--name-only", "--diff-filter=AM", `${base}...${head}`])).split("\n").filter(Boolean);

/** Runs `body` in a detached worktree at `sha`, removed afterwards whatever happens. */
export const inWorktreeAt = async <T>(git: Git, sha: string, body: (folder: string) => Promise<T>): Promise<T> => {
	const folder = mkdtempSync(join(tmpdir(), "hum-proof-"));

	try {
		await git.raw(["worktree", "add", "--detach", "--quiet", folder, sha]);

		return await body(folder);
	} finally {
		await git.run(["worktree", "remove", "--force", folder]);
		rmSync(folder, { recursive: true, force: true });
	}
};

/**
 * A check is real when it fails on the commit each note pointed at and passes on the base with the check on it. Each
 * note's commit is checked out with the check's files laid over it. A note that points at no commit cannot be proved
 * and counts against the check.
 */
export const proveCheck = async ({ git, head, base, notes, checks, timeoutMs, now }: ProofOptions): Promise<ProofResult> => {
	const started = now();
	let worktrees = 0;

	const done = (reason?: string): ProofResult => ({ passed: reason === undefined, reason, worktrees, ms: now() - started });

	const files = await checkFiles(git, base, head);
	const commits = [...new Set(notes.map(({ change }) => change))];
	const provable = (await Promise.all(commits.map(async (sha) => ((await isCommit(git, sha)) ? [sha] : [])))).flat();

	if (provable.length === 0) return done("no note points at a commit the check can run on");

	for (const sha of provable) {
		const failure = await inWorktreeAt(git, sha, async (folder) => {
			worktrees++;
			await git.raw(["-C", folder, "checkout", head, "--", ...files]);

			return runChecks(checks, folder, { timeoutMs });
		});

		if (failure === undefined) return done(`the check passes on ${sha}, the commit a note points at`);
	}

	const failure = await inWorktreeAt(git, head, async (folder) => {
		worktrees++;

		return runChecks(checks, folder, { timeoutMs });
	});

	return failure === undefined ? done() : done(`the checks fail on the check item's own commit: ${failure.slice(0, 300)}`);
};
