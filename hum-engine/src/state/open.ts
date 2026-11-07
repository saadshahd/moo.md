import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { Faults } from "./faults.ts";
import { EventLog } from "./events.ts";
import { type Codec, Items } from "./items.ts";
import { OpKeys } from "./ops.ts";
import { RunRecords } from "./runs.ts";

/** On the Mac and in a clone, state lives in the repo's git common dir, so every worktree shares it. */
export const defaultStateDir = (cwd: string): string => {
	const found = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" });

	if (found.status !== 0) throw new Error(`${cwd} is not inside a git repository: ${found.stderr.trim()}`);

	return join(resolve(cwd, found.stdout.trim()), "hum");
};

export type StateOptions = Codec & { readonly now?: () => number };

/** Everything the engine saves between runs, under one folder. */
export const openState = (dir: string, { now = Date.now, ...codec }: StateOptions = {}) => {
	const faults = new Faults(join(dir, "faults"), now);

	return {
		dir,
		/** U1: the one status file for the repo. */
		statusPath: join(dir, "status.json"),
		faults,
		items: new Items(join(dir, "items"), faults, now, codec),
		events: new EventLog(join(dir, "events"), now),
		ops: new OpKeys(join(dir, "ops"), now),
		runs: new RunRecords(join(dir, "runs"), now),
	};
};

export type State = ReturnType<typeof openState>;
