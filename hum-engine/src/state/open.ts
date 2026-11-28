import { join, resolve } from "node:path";
import { gitIn } from "../adapters/git.ts";
import { KindFile } from "../config/kind-file.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { EventLog } from "./events.ts";
import { Faults } from "./faults.ts";
import { type Codec, Items } from "./items.ts";
import { Break, BrokenCommit, Merge, PossibleRepeat, Proof, RepeatGroup, ReviewNote } from "../loop/records.ts";
import { Choice } from "../status/format.ts";
import { MergedCase } from "../measure/cases.ts";
import { OpKeys } from "./ops.ts";
import { Records } from "./records.ts";
import { RunRecords } from "./runs.ts";
import { EngineUpdate, FiledFollowUp, FiledPart, ItemKind, Landing, Learned, Limit, Parked, PullRequestText, QueuedQuestion, ReadyList, SavedPlan, SavedRepro, SavedTalk, Review, SettledAnswer, SettledNote, SettledRequest, Slot, Spent, Verdict } from "./saved.ts";

/** Names under the state folder that other modules address by name. */
export const STATUS_FILE = "status.json";
export const WAITS_FILE = "waits.json";
export const LOOKED_FILE = "looked.json";
export const HEARTBEAT_FILE = "heartbeat.json";
export const INBOX_DIR = "inbox";
export const STOPS_DIR = "stops";
export const SLOTS_DIR = "slots";

/** Publish's own git repo, beside the state, never saved with it. */
export const PUBLISH_DIR = "publish";

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
		statusPath: join(dir, STATUS_FILE),
		/** Every wait on the owner, built from the status file each time it is written. */
		waitsPath: join(dir, WAITS_FILE),
		/** When the owner last looked at the changes merged without them; only the panel writes it. */
		lookedPath: join(dir, LOOKED_FILE),
		/** The worker's heartbeat, one file the service unit reads. */
		heartbeatPath: join(dir, HEARTBEAT_FILE),
		/** The answer hook drops one file here per posted answer; its content is the item id. */
		inbox: join(dir, INBOX_DIR),
		/** A background run's Stop hook drops one file here per stop: the run's session id and transcript path. */
		stops: join(dir, STOPS_DIR),
		faults,
		items: new Items(join(dir, "items"), faults, now, codec),
		events: new EventLog(join(dir, "events"), now, faults, codec.engineVersion),
		ops: new OpKeys(join(dir, "ops"), now),
		runs: new RunRecords(join(dir, "runs"), now),
		parked: new Records(join(dir, "parked"), Parked),
		spent: new Records(join(dir, "spent"), Spent),
		/** Earlier kinds by `<machine id>@<version>`, for `items.restore`. */
		kinds: new Records(join(dir, "kinds"), KindFile),
		limit: new Records(join(dir, "limit"), Limit),
		ready: new Records(join(dir, "ready"), ReadyList),
		/** The run slots, by name. */
		slots: new Records(join(dir, SLOTS_DIR), Slot),
		landings: new Records(join(dir, "landings"), Landing),
		/** Path rules by glob. */
		learned: new Records(join(dir, "learned"), Learned),
		/** Each item's kind, by item id. */
		itemKinds: new Records(join(dir, "item-kinds"), ItemKind),
		plans: new Records(join(dir, "plans"), SavedPlan),
		/** What the owner settled in each item's ideate and shape rows, by item. */
		talks: new Records(join(dir, "talks"), SavedTalk),
		verdicts: new Records(join(dir, "verdicts"), Verdict),
		/** Every review run's answer on each item's change, by its run's name or, at landing, by when it answered. */
		reviews: new Records(join(dir, "reviews"), Review),
		/** The pull request text the latest build or fix run wrote, by item. */
		pullRequests: new Records(join(dir, "pull-requests"), PullRequestText),
		/** Questions by item, waiting for room under the daily cap or asked within the day. */
		questions: new Records(join(dir, "questions"), QueuedQuestion),
		/** Follow-up items a pass filed within the day, by the item filed. */
		followUps: new Records(join(dir, "follow-ups"), FiledFollowUp),
		/** The check each fix item's repro run wrote, by item. */
		repros: new Records(join(dir, "repros"), SavedRepro),
		/** The parts splits filed, by the item filed; kept while the part lives. */
		parts: new Records(join(dir, "parts"), FiledPart),
		/** Choices made without the owner, by item and time. */
		choices: new Records(join(dir, "choices"), Choice),
		/** Each answer's disposition, by item and ordinal. */
		answers: new Records(join(dir, "answers"), SettledAnswer),
		/** Each owner's request's disposition, by item and ordinal. */
		requests: new Records(join(dir, "requests"), SettledRequest),
		/** Each owner's note to a step and what became of it, by item and ordinal; the thread holds its text. */
		stepNotes: new Records(join(dir, "step-notes"), SettledNote),
		/** Review notes, by source and source id. */
		notes: new Records(join(dir, "notes"), ReviewNote),
		/** Notes that state one rule, by the key of the first. */
		repeats: new Records(join(dir, "repeats"), RepeatGroup),
		possibleRepeats: new Records(join(dir, "possible-repeats"), PossibleRepeat),
		/** Merged changes, by item. */
		merges: new Records(join(dir, "merges"), Merge),
		/** Tests of the base that failed after a merge, by item. */
		breaks: new Records(join(dir, "breaks"), Break),
		/** The label git's rule gives each commit on the base that broke, by sha. */
		labels: new Records(join(dir, "labels"), BrokenCommit),
		/** What proving a check item cost, by item. */
		proofs: new Records(join(dir, "proofs"), Proof),
		/** Engine versions hum could not update to yet, by version. */
		engineUpdates: new Records(join(dir, "engine-updates"), EngineUpdate),
		/** The labelled case each merged item gives the judges its change was put to, by item. */
		cases: new Records(join(dir, "cases"), MergedCase),
	};
};

export type State = ReturnType<typeof openState>;
