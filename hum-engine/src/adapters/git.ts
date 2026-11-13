import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "../exec.ts";

/** No hook runs: the hooks path points nowhere, whatever the clone's own config says. */
const HOOKS_OFF = "core.hooksPath=/dev/null";

/** The words git uses when another push moved the ref first; git 2.50 and later say `incorrect old value provided` when two pushes race at the update. */
const CONFLICT = /non-fast-forward|fetch first|already exists|stale info|failed to update ref|cannot lock ref|incorrect old value/i;
const REFUSED = /remote rejected|declined|protected|GH006|denied|not permitted/i;
const ABSENT = /does not exist|not a valid object name/i;

/** Patch text as git writes it, whatever external diff tool or colour the environment sets: `GIT_EXTERNAL_DIFF` replaces it otherwise. */
export const PATCH = ["--no-ext-diff", "--no-color"] as const;

const ANCESTOR = 0;
const NOT_ANCESTOR = 1;

type GitResult = { readonly code: number; readonly stdout: string; readonly stderr: string };

export type Git = {
	/** Runs git; a non-zero exit is a result, not a throw, but a run past its time limit throws `CommandTimedOut`. `input` is its stdin, which is closed either way. */
	readonly run: (args: readonly string[], input?: string) => Promise<GitResult>;
	/** Runs git and returns what it printed; a non-zero exit throws `GitFailed` with git's own words. */
	readonly raw: (args: readonly string[], input?: string) => Promise<string>;
	/** As `raw`, with what git printed as bytes, which reading it as text would change. */
	readonly bytes: (args: readonly string[], input?: string) => Promise<Buffer>;
};

class GitFailed extends Error {
	override name = "GitFailed";

	constructor(
		readonly args: readonly string[],
		readonly result: GitResult,
	) {
		super(`git ${args.join(" ")} exited ${result.code}: ${(result.stderr || result.stdout).trim()}`);
	}
}

/** For `.catch`: git failing with its own words is the fallback; a call that ran out of time stays an error. */
export const whenGitFailed =
	<T>(fallback: T) =>
	(error: Error): T => {
		if (error instanceof GitFailed) return fallback;

		throw error;
	};

/** `conflict`: another writer moved the ref first, and a retry can win. `refused`: the remote said no, in `said`, and no retry helps. */
export type PushOutcome = { readonly kind: "pushed" } | { readonly kind: "conflict" } | { readonly kind: "refused"; readonly said: string };

/** The author and committer of the commits hum makes. */
export type GitIdentity = { readonly name: string; readonly email: string };

export type GitOptions = {
	/** The owner's `commandTimeoutSeconds` in milliseconds; a call that runs longer is stopped and throws `CommandTimedOut`. */
	readonly timeoutMs: number;
	/** The owner's `commitIdentity` setting. Without it git commits as its own config says, so every call that commits passes it. */
	readonly identity?: GitIdentity;
	/** More variables, such as a scratch index or a commit date. */
	readonly env?: Readonly<Record<string, string>>;
};

/** The variables that make git credit a commit to `identity`, over any git config the clone or the machine holds. */
export const identityEnv = ({ name, email }: GitIdentity) => ({
	GIT_AUTHOR_NAME: name,
	GIT_AUTHOR_EMAIL: email,
	GIT_COMMITTER_NAME: name,
	GIT_COMMITTER_EMAIL: email,
});

const NAME_KEY = "user.name";
const EMAIL_KEY = "user.email";

export type GitIdentityRead =
	| { readonly found: true; readonly identity: GitIdentity }
	/** `missing` names each git config key that holds nothing. */
	| { readonly found: false; readonly missing: readonly string[] };

const configValue = async (git: Git, key: string): Promise<string> => (await git.run(["config", "--get", key])).stdout.trim();

/** The owner's name and email from git config, the repo's own over the user's. Read with a `git` that has no identity of its own. */
export const readGitIdentity = async (git: Git): Promise<GitIdentityRead> => {
	const name = await configValue(git, NAME_KEY);
	const email = await configValue(git, EMAIL_KEY);
	const missing = [...(name === "" ? [NAME_KEY] : []), ...(email === "" ? [EMAIL_KEY] : [])];

	return missing.length === 0 ? { found: true, identity: { name, email } } : { found: false, missing };
};

/** git in `cwd` with hooks off. */
export const gitIn = (cwd: string, { identity, env = {}, timeoutMs }: GitOptions): Git => {
	/** Runs git, its stdout piped back as text, or written to `stdout` where that names an open file. */
	const spawn = async (args: readonly string[], input: string, stdout: "pipe" | number = "pipe"): Promise<GitResult> => {
		const result = await exec("git", ["-c", HOOKS_OFF, ...args], {
			timeoutMs,
			nodeOptions: { cwd, env: { ...(identity && identityEnv(identity)), ...env }, stdio: ["pipe", stdout, "pipe"] },
			stdin: input,
		});

		return { code: result.exitCode ?? -1, stdout: result.stdout, stderr: result.stderr };
	};

	const succeeded = (args: readonly string[], result: GitResult): GitResult => {
		if (result.code !== 0) throw new GitFailed(args, result);

		return result;
	};

	const run = (args: readonly string[], input = ""): Promise<GitResult> => spawn(args, input);

	const raw = async (args: readonly string[], input = ""): Promise<string> => succeeded(args, await spawn(args, input)).stdout;

	const bytes = async (args: readonly string[], input = ""): Promise<Buffer> => {
		const folder = mkdtempSync(join(tmpdir(), "hum-git-"));
		const file = join(folder, "stdout");
		const fd = openSync(file, "w");

		try {
			succeeded(args, await spawn(args, input, fd));

			return readFileSync(file);
		} finally {
			closeSync(fd);
			rmSync(folder, { recursive: true, force: true });
		}
	};

	return { run, raw, bytes };
};

/** Every config entry git reads in the folder, with the file each came from: reading config runs nothing. */
const CONFIG_READ = ["config", "--list", "--show-origin"] as const;

/** The key of one `--show-origin` line, `<origin>\t<key>=<value>`, without its value. */
const keyOf = (line: string): string => line.slice(line.indexOf("\t") + 1).split("=")[0] ?? line;

/**
 * `git` that runs nothing once the config git reads has changed since this was made. A run in the same folder can
 * write config that git runs as code, such as core.fsmonitor, a filter or a credential helper, and hum's git would
 * run it with hum's environment. A change throws, naming each key; no value is shown, as one may hold a secret.
 */
export const withConfigPinned = async (git: Git): Promise<Git> => {
	const read = async (): Promise<ReadonlySet<string>> => new Set((await git.raw(CONFIG_READ)).split("\n").filter(Boolean));
	const pinned = await read();

	const unchanged = async (): Promise<void> => {
		const now = await read();
		const changed = [...new Set([...now].filter((line) => !pinned.has(line)).concat([...pinned].filter((line) => !now.has(line))).map(keyOf))];

		if (changed.length > 0) throw new Error(`the git config hum reads changed since hum checked the folder out: ${changed.join(", ")}. A run may have written config that git runs as code, so hum runs no more git in this folder.`);
	};

	return {
		run: async (args, input) => (await unchanged(), git.run(args, input)),
		raw: async (args, input) => (await unchanged(), git.raw(args, input)),
		bytes: async (args, input) => (await unchanged(), git.bytes(args, input)),
	};
};

/** The arguments for `git push` with hooks off, for a command line handed straight to git. */
export const pushArgs = (rest: readonly string[]): string[] => ["-c", HOOKS_OFF, "push", "--no-verify", ...rest];

/** Pushes. A refusal is an outcome that carries the remote's own words; any other failure throws `GitFailed`. */
export const push = async (git: Git, rest: readonly string[]): Promise<PushOutcome> => {
	const args = ["push", "--no-verify", ...rest];
	const result = await git.run(args);
	const said = `${result.stderr}${result.stdout}`.trim();

	if (result.code === 0) return { kind: "pushed" };

	if (CONFLICT.test(said)) return { kind: "conflict" };

	if (REFUSED.test(said)) return { kind: "refused", said: `git push refused: ${said}` };

	throw new GitFailed(args, result);
};

/** Whether `ancestor` is reachable from `descendant`. git answers by exit code alone. */
export const isAncestor = async (git: Git, { ancestor, descendant }: { readonly ancestor: string; readonly descendant: string }): Promise<boolean> => {
	const args = ["merge-base", "--is-ancestor", ancestor, descendant];
	const result = await git.run(args);

	if (result.code === ANCESTOR || result.code === NOT_ANCESTOR) return result.code === ANCESTOR;

	throw new GitFailed(args, result);
};

/** What git printed for one object, or undefined when the object does not exist. */
export const readOrAbsent = async (git: Git, args: readonly string[]): Promise<string | undefined> => {
	const result = await git.run(args);

	if (result.code === 0) return result.stdout;

	if (ABSENT.test(result.stderr)) return undefined;

	throw new GitFailed(args, result);
};
