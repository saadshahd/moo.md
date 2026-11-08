import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import type { SlotRecipe } from "../config/schema.ts";

/** Where owners keep a script that sets up a working environment, in the order a repo's own convention is preferred. */
export const ENV_SCRIPTS = ["bin/setup", "script/setup", "scripts/setup", "scripts/setup.sh", "bin/env", "scripts/env", "scripts/env.sh"] as const;

const isRunnable = (path: string): boolean => {
	try {
		accessSync(path, constants.X_OK);

		return true;
	} catch {
		return false;
	}
};

/**
 * The slot recipe a repo already holds. When the owner has an environment script of their own, the recipe calls it
 * and rebuilds nothing; a repo with none gets an empty recipe for setup to fill from its other evidence.
 */
export const proposeRecipe = (repo: string): SlotRecipe => {
	const script = ENV_SCRIPTS.find((candidate) => isRunnable(join(repo, candidate)));

	return { prepare: script === undefined ? [] : [`./${script}`], refresh: [], ready: [] };
};
