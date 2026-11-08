import { x } from "tinyexec";
import { PermanentError } from "../adapter-api.ts";
import { SHIPPED_DEFAULTS } from "../config/schema.ts";

/** No hook runs: the hooks path points nowhere, whatever the clone's own config says. */
const HOOKS_OFF = "core.hooksPath=/dev/null";

const CONFLICT = /non-fast-forward|fetch first|already exists|stale info|failed to update ref|cannot lock ref/i;
const REFUSED = /remote rejected|declined|protected|GH006|denied|not permitted/i;
const ABSENT = /does not exist|not a valid object name/i;

const ANCESTOR = 0;
const NOT_ANCESTOR = 1;

export type GitResult = { readonly code: number; readonly stdout: string; readonly stderr: string };

export type Git = {
	/** Runs git; a non-zero exit is a result, not a throw. `input` is its stdin, which is closed either way. */
	readonly run: (args: readonly string[], input?: string) => Promise<GitResult>;
	/** Runs git and returns what it printed; a non-zero exit throws `GitFailed` with git's own words. */
	readonly raw: (args: readonly string[], input?: string) => Promise<string>;
};

export class GitFailed extends Error {
	override name = "GitFailed";

	constructor(
		readonly args: readonly string[],
		readonly result: GitResult,
	) {
		super(`git ${args.join(" ")} exited ${result.code}: ${(result.stderr || result.stdout).trim()}`);
	}
}

/** The remote refused the push: a protected branch, a hook, a permission. Retrying cannot help. */
export class PushRefused extends PermanentError {
	override name = "PushRefused";
}

export type PushOutcome = "pushed" | "conflict";

/** The author and committer of the commits hum makes. */
export type GitIdentity = { readonly name: string; readonly email: string };

export type GitOptions = {
	/** The owner's `commitIdentity` setting; reads need none. */
	readonly identity?: GitIdentity;
	/** More variables, such as a scratch index or a commit date. */
	readonly env?: Readonly<Record<string, string>>;
};

const identitySettings = ({ name, email }: GitIdentity): string[] => [`user.name=${name}`, `user.email=${email}`];

/** git in `cwd` with hooks off. */
export const gitIn = (cwd: string, { identity = SHIPPED_DEFAULTS.commitIdentity, env = {} }: GitOptions = {}): Git => {
	const run = async (args: readonly string[], input = ""): Promise<GitResult> => {
		const { exitCode, stdout, stderr } = await x("git", ["-c", HOOKS_OFF, ...identitySettings(identity).flatMap((setting) => ["-c", setting]), ...args], {
			nodeOptions: { cwd, env: { ...process.env, ...env } },
			stdin: input,
		});

		return { code: exitCode ?? -1, stdout, stderr };
	};

	const raw = async (args: readonly string[], input?: string): Promise<string> => {
		const result = await run(args, input);

		if (result.code !== 0) throw new GitFailed(args, result);

		return result.stdout;
	};

	return { run, raw };
};

/** The arguments for `git push` with hooks off, for a command line handed straight to git. */
export const pushArgs = (rest: readonly string[]): string[] => ["-c", HOOKS_OFF, "push", "--no-verify", ...rest];

/**
 * Pushes. `conflict` means another writer moved the ref first and a retry can win.
 * A refusal throws `PushRefused` with the remote's own words; any other failure throws `GitFailed`.
 */
export const push = async (git: Git, rest: readonly string[]): Promise<PushOutcome> => {
	const args = ["push", "--no-verify", ...rest];
	const result = await git.run(args);
	const said = `${result.stderr}${result.stdout}`.trim();

	if (result.code === 0) return "pushed";

	if (CONFLICT.test(said)) return "conflict";

	if (REFUSED.test(said)) throw new PushRefused(`git push refused: ${said}`);

	throw new GitFailed(args, result);
};

/** Whether `ancestor` is reachable from `descendant`. git answers by exit code alone. */
export const isAncestor = async (git: Git, ancestor: string, descendant: string): Promise<boolean> => {
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
