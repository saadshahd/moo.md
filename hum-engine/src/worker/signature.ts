import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { isMissing } from "../state/fs.ts";

const Package = z.looseObject({ version: z.string().min(1) });

/** What the worker compares each tick with the one at its start. A change in either makes it drain and exit. */
export type Signature = { readonly engineVersion: string; readonly hash: string };

const LOCKFILES = ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

const isInside = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}/`);

/** Every file under `folder` of `root`, hidden ones too, as paths from `root` in a stable order, without the items folder: every claim, answer and merge changes it, and it is no config. */
const filesUnder = (root: string, folder: string, itemsDir: string): string[] =>
	existsSync(join(root, folder))
		? [...new Bun.Glob("**").scanSync({ cwd: join(root, folder), dot: true, onlyFiles: true })].flatMap((path) => (isInside(join(folder, path), itemsDir) ? [] : [join(folder, path)])).sort()
		: [];

/** The engine version installed in the owner's repo, else `fallback` (the running one). */
export const installedVersion = (repo: string, fallback: string): string => {
	try {
		return Package.safeParse(JSON.parse(readFileSync(join(repo, "node_modules", "@moo.md", "hum", "package.json"), "utf8"))).data?.version ?? fallback;
	} catch (error) {
		if (error instanceof Error && isMissing(error)) return fallback;

		throw error;
	}
};

/** The installed engine version and one hash of the lockfile, `.hum/` (without its items) and `adapters/`. */
export const signatureOf = (repo: string, fallbackVersion: string, itemsDir: string): Signature => {
	const hash = createHash("sha256");
	const files = [...LOCKFILES.filter((name) => existsSync(join(repo, name))), ...filesUnder(repo, ".hum", itemsDir), ...filesUnder(repo, "adapters", itemsDir)];

	for (const file of files) hash.update(relative(repo, join(repo, file))).update("\0").update(readFileSync(join(repo, file))).update("\0");

	return { engineVersion: installedVersion(repo, fallbackVersion), hash: hash.digest("hex") };
};
