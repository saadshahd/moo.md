import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { gitIn } from "../adapters/git.ts";

const commonDirOf = async (folder: string): Promise<string> => realpathSync(resolve(folder, (await gitIn(folder).raw(["rev-parse", "--git-common-dir"])).trim()));

const gitDirOf = async (folder: string): Promise<string> => realpathSync(resolve(folder, (await gitIn(folder).raw(["rev-parse", "--git-dir"])).trim()));

/**
 * Whether `folder` is a linked worktree of the repo at `repo`. Claude Code trusts a worktree of a trusted repo and
 * refuses a repo of its own: a clone shares no git directory with the repo, and a repo's own folder is no linked worktree.
 */
export const isWorktreeOf = async (repo: string, folder: string): Promise<boolean> => {
	const [repoCommon, folderCommon, folderDir] = await Promise.all([commonDirOf(repo), commonDirOf(folder), gitDirOf(folder)]);

	return repoCommon === folderCommon && folderDir !== folderCommon;
};
