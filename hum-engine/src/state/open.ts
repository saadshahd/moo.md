import { join, resolve } from "node:path";
import { gitIn } from "../adapters/git.ts";
import { Kind } from "../config/schema.ts";
import { EventLog } from "./events.ts";
import { Faults } from "./faults.ts";
import { type Codec, Items } from "./items.ts";
import { OpKeys } from "./ops.ts";
import { Records } from "./records.ts";
import { RunRecords } from "./runs.ts";
import { Limit, Parked, ReadyList, Spent, Landing, Learned } from "./saved.ts";

/** On the Mac and in a clone, state lives in the repo's git common dir, so every worktree shares it. */
export const defaultStateDir = async (cwd: string): Promise<string> => {
	const found = await gitIn(cwd).run(["rev-parse", "--git-common-dir"]);

	if (found.code !== 0) throw new Error(`${cwd} is not inside a git repository: ${found.stderr.trim()}`);

	return join(resolve(cwd, found.stdout.trim()), "hum");
};

export type StateOptions = Codec & { readonly now?: () => number };

/** Everything the engine saves between runs, under one folder. */
export const openState = (dir: string, { now = Date.now, ...codec }: StateOptions = {}) => {
	const faults = new Faults(join(dir, "faults"), now);

	return {
		dir,
		/** The one status file for the repo. */
		statusPath: join(dir, "status.json"),
		/** The worker's heartbeat, one file the service unit reads. */
		heartbeatPath: join(dir, "heartbeat.json"),
		/** The answer hook drops one file here per posted answer; its content is the item id. */
		inbox: join(dir, "inbox"),
		faults,
		items: new Items(join(dir, "items"), faults, now, codec),
		events: new EventLog(join(dir, "events"), now),
		ops: new OpKeys(join(dir, "ops"), now),
		runs: new RunRecords(join(dir, "runs"), now),
		parked: new Records(join(dir, "parked"), Parked),
		spent: new Records(join(dir, "spent"), Spent),
		/** Earlier kinds by `<machine id>@<version>`, for `items.restore`. */
		kinds: new Records(join(dir, "kinds"), Kind),
		limit: new Records(join(dir, "limit"), Limit),
		ready: new Records(join(dir, "ready"), ReadyList),
		landings: new Records(join(dir, "landings"), Landing),
		/** Path rules by glob. */
		learned: new Records(join(dir, "learned"), Learned),
	};
};

export type State = ReturnType<typeof openState>;
