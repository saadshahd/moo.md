import { join, resolve } from "node:path";
import { gitIn } from "../adapters/git.ts";
import { Kind } from "../config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { EventLog } from "./events.ts";
import { Faults } from "./faults.ts";
import { type Codec, Items } from "./items.ts";
import { Break, Merge, PossibleRepeat, Proof, RepeatGroup, ReviewNote } from "../loop/records.ts";
import { Choice } from "../status/format.ts";
import { OpKeys } from "./ops.ts";
import { Records } from "./records.ts";
import { RunRecords } from "./runs.ts";
import { ItemKind, Landing, Learned, Limit, Parked, PullRequestText, QueuedQuestion, ReadyList, SavedPlan, SettledAnswer, Slot, Spent, Verdict } from "./saved.ts";

/** On the Mac and in a clone, state lives in the repo's git common dir, so every worktree shares it. */
export const defaultStateDir = async (cwd: string): Promise<string> => {
	const found = await gitIn(cwd, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }).run(["rev-parse", "--git-common-dir"]);

	if (found.code !== 0) throw new Error(`${cwd} is not inside a git repository: ${found.stderr.trim()}`);

	return join(resolve(cwd, found.stdout.trim()), "hum");
};

export type StateOptions = Codec & { readonly now: () => number };

/** Everything the engine saves between runs, under one folder. */
export const openState = (dir: string, { now, ...codec }: StateOptions) => {
	const faults = new Faults(join(dir, "faults"), now);

	return {
		dir,
		/** The one status file for the repo. */
		statusPath: join(dir, "status.json"),
		/** The worker's heartbeat, one file the service unit reads. */
		heartbeatPath: join(dir, "heartbeat.json"),
		/** The answer hook drops one file here per posted answer; its content is the item id. */
		inbox: join(dir, "inbox"),
		/** A background run's Stop hook drops one file here per stop: the run's session id and transcript path. */
		stops: join(dir, "stops"),
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
		/** The run slots, by name. */
		slots: new Records(join(dir, "slots"), Slot),
		landings: new Records(join(dir, "landings"), Landing),
		/** Path rules by glob. */
		learned: new Records(join(dir, "learned"), Learned),
		/** Each item's kind, by item id. */
		itemKinds: new Records(join(dir, "item-kinds"), ItemKind),
		plans: new Records(join(dir, "plans"), SavedPlan),
		verdicts: new Records(join(dir, "verdicts"), Verdict),
		/** The pull request text the latest build or fix run wrote, by item. */
		pullRequests: new Records(join(dir, "pull-requests"), PullRequestText),
		/** Questions by item, waiting for room under the daily cap or asked within the day. */
		questions: new Records(join(dir, "questions"), QueuedQuestion),
		/** Choices made without the owner, by item and time. */
		choices: new Records(join(dir, "choices"), Choice),
		/** Each answer's disposition, by item and ordinal. */
		answers: new Records(join(dir, "answers"), SettledAnswer),
		/** Review notes, by source and source id. */
		notes: new Records(join(dir, "notes"), ReviewNote),
		/** Notes that state one rule, by the key of the first. */
		repeats: new Records(join(dir, "repeats"), RepeatGroup),
		possibleRepeats: new Records(join(dir, "possible-repeats"), PossibleRepeat),
		/** Merged changes, by item. */
		merges: new Records(join(dir, "merges"), Merge),
		/** Tests of the base that failed after a merge, by item. */
		breaks: new Records(join(dir, "breaks"), Break),
		/** What proving a check item cost, by item. */
		proofs: new Records(join(dir, "proofs"), Proof),
	};
};

export type State = ReturnType<typeof openState>;
