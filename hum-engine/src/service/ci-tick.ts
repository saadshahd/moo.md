import { type Git, pushHooksOff } from "../adapters/git.ts";

/** R2: where the scheduled workflow leaves its last tick. A ref holds no file, so no branch or checkout changes. */
export const CI_TICK_REF = "refs/hum/ticks/ci";

const IDENTITY = { GIT_AUTHOR_NAME: "hum", GIT_AUTHOR_EMAIL: "hum@users.noreply.github.com", GIT_COMMITTER_NAME: "hum", GIT_COMMITTER_EMAIL: "hum@users.noreply.github.com" };

/** R2: the scheduled workflow records its tick as an empty commit dated now, force-pushed to `CI_TICK_REF`. */
export const recordCiTick = async (git: Git, repo: string, remote: string, at: number): Promise<void> => {
	const when = `${Math.floor(at / 1000)} +0000`;
	const tree = await git(["mktree"], { cwd: repo });
	const commit = await git(["commit-tree", tree.stdout.trim(), "-m", `hum ci tick ${new Date(at).toISOString()}`], { cwd: repo, env: { ...IDENTITY, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });

	if (tree.code !== 0 || commit.code !== 0) throw new Error(`could not make the tick commit: ${tree.stderr}${commit.stderr}`.trim());

	await pushHooksOff(git, repo, ["--force", remote, `${commit.stdout.trim()}:${CI_TICK_REF}`]);
};

/** R2: the time of the last recorded tick, or undefined when the scheduled workflow has never run or the remote cannot be read. */
export const readCiTick = async (git: Git, repo: string, remote: string): Promise<number | undefined> => {
	const fetched = await git(["fetch", "--quiet", "--no-tags", remote, `+${CI_TICK_REF}:${CI_TICK_REF}`], { cwd: repo });

	if (fetched.code !== 0) return undefined;

	const at = Number((await git(["log", "-1", "--format=%ct", CI_TICK_REF], { cwd: repo })).stdout.trim());

	return Number.isFinite(at) && at > 0 ? at * 1000 : undefined;
};
