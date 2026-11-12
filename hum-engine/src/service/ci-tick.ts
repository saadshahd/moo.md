import { type GitIdentity, gitIn, push, whenGitFailed } from "../adapters/git.ts";
import { SECOND_MS } from "../time.ts";

/** Where the scheduled workflow leaves its last tick. A ref holds no file, so no branch or checkout changes. */
export const CI_TICK_REF = "refs/hum/ticks/ci";

/** The scheduled workflow records its tick as an empty commit dated now, force-pushed to `CI_TICK_REF`. */
export const recordCiTick = async ({ repo, remote, at, identity, timeoutMs }: { readonly repo: string; readonly remote: string; readonly at: number; readonly identity: GitIdentity; readonly timeoutMs: number }): Promise<void> => {
	const when = `${Math.floor(at / SECOND_MS)} +0000`;
	const git = gitIn(repo, { identity, timeoutMs, env: { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
	const tree = (await git.raw(["hash-object", "-w", "-t", "tree", "/dev/null"])).trim();
	const commit = (await git.raw(["commit-tree", tree, "-m", `hum ci tick ${new Date(at).toISOString()}`])).trim();

	await push(git, ["--force", remote, `${commit}:${CI_TICK_REF}`]);
};

/** The time of the last recorded tick, or undefined when the scheduled workflow has never run or the remote cannot be read. */
export const readCiTick = async ({ repo, remote, timeoutMs }: { readonly repo: string; readonly remote: string; readonly timeoutMs: number }): Promise<number | undefined> => {
	const git = gitIn(repo, { timeoutMs });

	const fetched = await git.raw(["fetch", "--quiet", "--no-tags", remote, `+${CI_TICK_REF}:${CI_TICK_REF}`]).then(() => true, whenGitFailed(false));

	if (!fetched) return undefined;

	const at = Number((await git.raw(["log", "-1", "--format=%ct", CI_TICK_REF])).trim());

	return Number.isFinite(at) && at > 0 ? at * SECOND_MS : undefined;
};
