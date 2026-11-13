import { existsSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { type Git, push } from "../adapters/git.ts";
import type { Evidence } from "../state/saved.ts";

/** The files a pull request body shows, by extension: a picture inline, a video as a link. */
const KINDS: ReadonlyMap<string, "image" | "video"> = new Map([
	[".png", "image"],
	[".jpg", "image"],
	[".jpeg", "image"],
	[".gif", "image"],
	[".webp", "image"],
	[".mp4", "video"],
	[".mov", "video"],
	[".webm", "video"],
]);

const MOST_MEGABYTES = 10;

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** Where an item's evidence is kept: a ref, never a branch, so no branch rule and no merge reaches it. */
export const evidenceRef = (item: string): string => `refs/hum/evidence/${item}`;

/**
 * Keeps the one picture or video a run saved in `folder` to show its change at work: a commit of that file alone,
 * force-pushed to the item's evidence ref, and linked on GitHub by that commit. Says why it was left out where it
 * cannot be kept; a name with a folder in it is read from `folder` all the same.
 */
export const keepEvidence = async ({ git, folder, file, item, repo }: { readonly git: Git; readonly folder: string; readonly file: string; readonly item: string; readonly repo: string | undefined }): Promise<Evidence> => {
	const name = basename(file);
	const path = join(folder, name);
	const kind = KINDS.get(extname(name).toLowerCase());

	if (kind === undefined) return { left: `${name} is no picture or video` };

	if (!existsSync(path)) return { left: `${name} is not in the folder for evidence` };

	if (statSync(path).size > MOST_MEGABYTES * BYTES_PER_MEGABYTE) return { left: `${name} is over ${MOST_MEGABYTES} MB` };

	if (repo === undefined) return { left: "the repo is not on GitHub, where a pull request would show it" };

	const blob = (await git.raw(["hash-object", "-w", path])).trim();
	const tree = (await git.raw(["mktree"], `100644 blob ${blob}\t${name}\n`)).trim();
	const commit = (await git.raw(["commit-tree", tree, "-m", `hum: evidence for ${item}`])).trim();
	const pushed = await push(git, ["--force", "origin", `${commit}:${evidenceRef(item)}`]);

	if (pushed.kind !== "pushed") return { left: `the push of ${name} did not land${pushed.kind === "refused" ? `: ${pushed.said}` : ""}` };

	return { kind, url: `https://github.com/${repo}/blob/${commit}/${encodeURIComponent(name)}?raw=true` };
};

/** Evidence as a pull request body shows it: a picture inline, a video as a link, or why the run's file was left out. */
export const evidenceMarkdown = (evidence: Evidence): string => {
	if ("left" in evidence) return `The run's evidence was left out: ${evidence.left}.`;

	return evidence.kind === "image" ? `![The change at work](${evidence.url})` : `[A video of the change at work](${evidence.url})`;
};
