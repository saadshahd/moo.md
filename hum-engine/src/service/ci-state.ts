import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type GitIdentity, gitIn, push } from "../adapters/git.ts";
import { HEARTBEAT_FILE, INBOX_DIR, PUBLISH_DIR, SLOTS_DIR, STATUS_FILE, STOPS_DIR } from "../state/open.ts";

/** Where a CI wake keeps hum's state for the next one. A ref holds no file, so no branch or checkout changes. Anyone who can read the repo can read it. */
export const CI_STATE_REF = "refs/hum/state";

/** The state files a job keeps to itself: what the view and the service unit poll, what a Mac's hooks and slots leave, and publish's repo. */
const JOB_ONLY = [STATUS_FILE, HEARTBEAT_FILE, `${INBOX_DIR}/`, `${STOPS_DIR}/`, `${SLOTS_DIR}/`, `${PUBLISH_DIR}/`];

const isJobOnly = (path: string): boolean => JOB_ONLY.some((name) => (name.endsWith("/") ? path.startsWith(name) : path === name));

const NO_REF = /couldn't find remote ref/i;

type CiStateOptions = {
	/** The checkout whose git holds the objects. */
	readonly repo: string;
	readonly remote: string;
	/** The state folder. */
	readonly dir: string;
	readonly timeoutMs: number;
};

/** The state commit a wake read, which its save must replace; undefined where no wake saved before. */
export type CiStateRead = { readonly read: string | undefined };

/** A save lost the race: another wake saved after this one read, and hum never writes over that. */
export class CiStateRaced extends Error {
	override name = "CiStateRaced";
}

/** Runs `use` with a scratch git index, removed after. */
const withScratchIndex = async <T>(use: (env: { readonly GIT_INDEX_FILE: string }) => Promise<T>): Promise<T> => {
	const scratch = mkdtempSync(join(tmpdir(), "hum-state-index-"));

	try {
		return await use({ GIT_INDEX_FILE: join(scratch, "index") });
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
};

/** Writes the state the last wake saved into `dir`, and returns the commit read; a remote that holds none leaves `dir` as it is. */
export const restoreCiState = async ({ repo, remote, dir, timeoutMs }: CiStateOptions): Promise<CiStateRead> => {
	const git = gitIn(repo, { timeoutMs });
	const fetched = await git.run(["fetch", "--quiet", "--no-tags", remote, `+${CI_STATE_REF}:${CI_STATE_REF}`]);

	if (fetched.code !== 0 && NO_REF.test(fetched.stderr)) return { read: undefined };

	if (fetched.code !== 0) throw new Error(`hum could not read its saved state from ${remote}: ${fetched.stderr.trim()}`);

	const read = (await git.raw(["rev-parse", CI_STATE_REF])).trim();

	mkdirSync(dir, { recursive: true });
	await withScratchIndex(async (env) => {
		const indexed = gitIn(repo, { timeoutMs, env });

		await indexed.raw(["read-tree", read]);
		await indexed.raw(["checkout-index", "--all", "--force", `--prefix=${join(dir, "/")}`]);
	});

	return { read };
};

/** The tree of every state file the next wake needs, built through a scratch index so no work tree is touched. */
const stateTree = async ({ repo, dir, timeoutMs }: Omit<CiStateOptions, "remote">): Promise<string> => {
	const git = gitIn(repo, { timeoutMs });
	const files = existsSync(dir) ? [...new Bun.Glob("**").scanSync({ cwd: dir, onlyFiles: true, dot: true })].filter((path) => !isJobOnly(path)).sort() : [];

	if (files.length === 0) return (await git.raw(["hash-object", "-w", "-t", "tree", "/dev/null"])).trim();

	const blobs = (await git.raw(["hash-object", "-w", "--stdin-paths"], `${files.map((path) => join(dir, path)).join("\n")}\n`)).trim().split("\n");

	return withScratchIndex(async (env) => {
		const indexed = gitIn(repo, { timeoutMs, env });

		await indexed.raw(["update-index", "--add", "--index-info"], files.map((path, at) => `100644 ${blobs[at]}\t${path}\n`).join(""));

		return (await indexed.raw(["write-tree"])).trim();
	});
};

/**
 * Saves the state folder to the remote as one commit with no parent, so the ref never grows, in place of the commit
 * this wake read: a compare-and-swap, which throws `CiStateRaced` when another wake saved first. Returns the new read.
 */
export const saveCiState = async ({ read, identity, at, ...options }: CiStateOptions & CiStateRead & { readonly identity: GitIdentity; readonly at: number }): Promise<CiStateRead> => {
	const git = gitIn(options.repo, { identity, timeoutMs: options.timeoutMs });
	const commit = (await git.raw(["commit-tree", await stateTree(options), "-m", `hum state ${new Date(at).toISOString()}`])).trim();
	const pushed = await push(git, [`--force-with-lease=${CI_STATE_REF}:${read ?? ""}`, options.remote, `${commit}:${CI_STATE_REF}`]);

	if (pushed.kind === "conflict") throw new CiStateRaced(`another wake saved hum's state to ${CI_STATE_REF} after this one read it, so this wake's state was not saved`);

	if (pushed.kind === "refused") throw new Error(`${options.remote} refused hum's state at ${CI_STATE_REF}: ${pushed.said}`);

	return { read: commit };
};
