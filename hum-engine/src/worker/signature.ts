import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { installedEngine } from "../engine.ts";
import { EVALS_DIR } from "../measure/remeasure.ts";
import { isMissing } from "../state/fs.ts";

const Package = z.looseObject({ version: z.string().min(1) });

/** What the repo installs. Each tick the worker compares its engine version with the one it runs, and its hash with the one at its start; a change in either makes it drain and exit. */
export type Signature = { readonly engineVersion: string; readonly hash: string };

const LOCKFILES = ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

const isInside = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}/`);

/**
 * Every file under `folder` of `root`, hidden ones too, as paths from `root` in a stable order, without the folders
 * `skipped` names: the items, which every claim, answer and merge changes, and the eval results each measurement
 * adds to, are no config.
 */
const filesUnder = ({ root, folder, skipped }: { readonly root: string; readonly folder: string; readonly skipped: readonly string[] }): string[] =>
	existsSync(join(root, folder))
		? [...new Bun.Glob("**").scanSync({ cwd: join(root, folder), dot: true, onlyFiles: true })].flatMap((path) => (skipped.some((skip) => isInside(join(folder, path), skip)) ? [] : [join(folder, path)])).sort()
		: [];

/** The engine version installed in the owner's repo, else `fallback` (the running one). */
export const installedVersion = (repo: string, fallback: string): string => {
	try {
		return Package.safeParse(JSON.parse(readFileSync(join(installedEngine(repo), "package.json"), "utf8"))).data?.version ?? fallback;
	} catch (error) {
		if (error instanceof Error && isMissing(error)) return fallback;

		throw error;
	}
};

/** The installed engine version and one hash of the lockfile, `.hum/` (without its items and eval results) and `adapters/`. */
export const signatureOf = ({ repo, fallbackVersion, itemsDir }: { readonly repo: string; readonly fallbackVersion: string; readonly itemsDir: string }): Signature => {
	const hash = createHash("sha256");
	const skipped = [itemsDir, join(".hum", EVALS_DIR)];
	const files = [...LOCKFILES.filter((name) => existsSync(join(repo, name))), ...filesUnder({ root: repo, folder: ".hum", skipped }), ...filesUnder({ root: repo, folder: "adapters", skipped })];

	for (const file of files) hash.update(relative(repo, join(repo, file))).update("\0").update(readFileSync(join(repo, file))).update("\0");

	return { engineVersion: installedVersion(repo, fallbackVersion), hash: hash.digest("hex") };
};
