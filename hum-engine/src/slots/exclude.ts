import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gitIn, whenGitFailed } from "../adapters/git.ts";
import { commonDirOf } from "./worktree.ts";

const GLOB_CHARACTER = /[\\*?[]/g;

/** The `info/exclude` line for `prefix`, a folder's path from the repo root that ends in `/`: it matches that folder and nothing else. */
const patternOf = (prefix: string): string => `/${prefix.replace(GLOB_CHARACTER, "\\$&")}`;

/**
 * Keeps an existing `folder` out of git when it lies inside the checkout `repo`: its pattern goes into `info/exclude` of the
 * git common dir, which every worktree of the repo reads, and which git status and oxlint honour. A pattern already
 * there stays the only one. A folder outside the repo, or in another repo, is left alone.
 */
export const excludeFromRepo = async (repo: string, folder: string, timeoutMs: number): Promise<void> => {
	const [found, prefix] = (await gitIn(folder, { timeoutMs }).raw(["rev-parse", "--git-common-dir", "--show-prefix"]).catch(whenGitFailed(""))).split("\n");

	if (!found || !prefix) return;

	const common = realpathSync(resolve(folder, found));

	if (common !== (await commonDirOf(repo, timeoutMs))) return;

	const exclude = join(common, "info", "exclude");
	const pattern = patternOf(prefix);
	const text = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";

	if (text.split("\n").includes(pattern)) return;

	mkdirSync(dirname(exclude), { recursive: true });
	appendFileSync(exclude, `${text === "" || text.endsWith("\n") ? "" : "\n"}${pattern}\n`);
};
