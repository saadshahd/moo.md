import { isValidCron } from "cron-validator";
import isGitRefNameValid from "is-git-ref-name-valid";
import { z } from "zod";
import shippedConfig from "../../defaults/hum.json" with { type: "json" };

/** The `hum.json` schema version this engine writes. */
export const SCHEMA_VERSION = 1;

/** The schema versions this engine reads, each migrated up to `SCHEMA_VERSION` by `migrateConfig`. */
export const READABLE_SCHEMA_VERSIONS: readonly number[] = [1];

/** Parts the engine ships; the owner adds roles, never these. */
export const FIXED_PARTS = [
	"owner",
	"worker",
	"scheduler",
	"checks",
	"work-source",
	"saved-state",
	"service-unit",
	"run-slots",
	"model-call",
] as const;

export const PURPOSES = ["plan", "build", "fix", "review"] as const;
export const SIZES = ["small", "medium", "large"] as const;
export const TIERS = ["light", "standard", "top"] as const;
export const EFFORTS = ["low", "medium", "high"] as const;

/** A machine state tagged with either of these waits on something outside the run. */
export const WAIT_TAG = "wait";

/** A state tagged with this waits on the owner; it is also a wait. */
export const OWNER_WAIT_TAG = "owner-wait";

/** A state tagged with this ends the item without finishing it. */
export const STUCK_TAG = "stuck";

const name = z.string().min(1);

/** Any item id appended to a branch prefix; the prefix is valid when the branch it makes is. */
const SAMPLE_ITEM_ID = "0";

const isBranchPrefix = (prefix: string): boolean => isGitRefNameValid(`refs/heads/${prefix}${SAMPLE_ITEM_ID}`);

const branchPrefix = z
	.string()
	.endsWith("/", "a branch prefix ends with '/'")
	.refine(isBranchPrefix, "a branch prefix followed by an item id must make a valid git branch name");

export const MERGE_METHODS = ["merge", "squash", "rebase"] as const;

export type MergeMethod = (typeof MERGE_METHODS)[number];

/** Who reviews a change before it merges: no one, a fresh agent review run, or that run and then the owner. */
export const REVIEWS = ["none", "agent", "owner"] as const;

/** When a merged change ships: at once, or once the proof its path names arrives. */
export const RELEASES = ["at-once", "after-proof"] as const;

/** What a break after merge becomes: follow-up work, or a block on the path. */
export const BREAKS = ["follow-up", "block"] as const;

/** Each place a model's judgment decides, measured on its own labelled set. */
export const BOUNDARIES = ["kind", "alignment", "plan-outcome", "review-verdict", "reply-option"] as const;

export type Boundary = (typeof BOUNDARIES)[number];

/** The categories of a change's merge risk, each graded 1 (sound) to 3 (a concern). */
export const GRADED = ["impact", "verification", "rollback", "errorDetection", "alignment"] as const;

const isRegExp = (source: string): boolean => {
	try {
		return new RegExp(source).source.length > 0;
	} catch {
		return false;
	}
};

const pattern = z.string().min(1).refine(isRegExp, "a pattern is a valid regular expression");

const date = z.iso.date();

/** When a refresh step runs: after every return, or only when a lockfile changed since the slot was last installed. */
export const REFRESH_WHEN = ["always", "lockfile-changed"] as const;

/** Whether a slot gets its own services, or every slot shares one set and gets its own database. */
export const SLOT_SERVICES = ["per-slot", "shared"] as const;

const RefreshStep = z.strictObject({ run: name, when: z.enum(REFRESH_WHEN) });

/** The three commands that make a slot usable, each a shell command run in the slot with the slot's environment. */
export const SlotRecipe = z.strictObject({
	prepare: z.array(name).describe("Run once when a slot is made: install dependencies, start or attach services, seed data."),
	refresh: z.array(RefreshStep).describe("Run after each return, once the slot is reset to the latest base: reinstall when a lockfile changed, reset the data."),
	ready: z.array(name).describe("Run after prepare and each refresh; a slot where one fails leaves the pool."),
});

const seconds = z.int().positive();

const count = z.int().positive();

const SERVICE_LABEL = /^[A-Za-z0-9._-]+$/;

const isInsideRepo = (path: string): boolean => !path.startsWith("/") && !path.endsWith("/") && !path.split("/").includes("..");

const commitIdentity = z.strictObject({ name, email: name });

const backoff = z
	.strictObject({ firstSeconds: z.number().positive(), maxSeconds: z.number().positive() })
	.refine(({ firstSeconds, maxSeconds }) => firstSeconds <= maxSeconds, "the first pause is at most the longest pause");

const fraction = z.number().gt(0).lt(1);

const Launch = z.union([
	z.strictObject({ glob: name, level: name, from: date, until: date }).refine(({ from, until }) => from < until, "a launch ends after it starts"),
	z.strictObject({ glob: name, level: name, base: name }),
]);

export type Launch = z.infer<typeof Launch>;

export type SlotRecipe = z.infer<typeof SlotRecipe>;

/** Every setting an owner may change, each described for the schema's readers. `defaults/hum.json` holds the shipped value of each. */
const Shipped = z.object({
	runBranchPrefix: branchPrefix.describe("Each run builds on the branch this prefix and its item id make."),
	claimPrefix: branchPrefix.describe("A claim is the first push of the branch this prefix and its item id make."),
	readyLabel: name.describe("The label that marks an issue ready for hum."),
	mergeMethod: z.enum(MERGE_METHODS).describe("How a released pull request merges."),
	models: z.record(z.enum(TIERS), name).describe("The model id each tier of a kind's table runs on."),
	runners: count.describe("The most runs that go at once."),
	tickIntervalSeconds: seconds.describe("The time between worker ticks; each tick writes the heartbeat and renews the claims in flight."),
	drainTimeoutSeconds: seconds.describe("How long a worker that has seen an update lets its runs finish before it stops them."),
	claimExpirySeconds: seconds.describe("How long a claim lasts unless its holder renews it."),
	latestVersionCacheSeconds: seconds.describe("How long the newest published engine version is kept before it is read again."),
	maxFixRuns: z.int().nonnegative().describe("Fix runs an item gets after failed checks before it ends stuck."),
	serviceLabel: z.string().regex(SERVICE_LABEL, "a service label is letters, digits, dot, dash and underscore").describe("The service unit's label, and the name its file takes."),
	maxCrashes: count.describe("Worker crashes within crashWindowSeconds that stop the service's restarts."),
	crashWindowSeconds: seconds.describe("The window in which maxCrashes crashes stop the service's restarts."),
	workerDownTicks: count.describe("Ticks without a heartbeat before the worker-down card shows."),
	tokenWarnDays: count.describe("Days before the CI token's year ends that the expiry card shows."),
	ciSchedule: z.string().refine((schedule) => isValidCron(schedule), "a cron schedule has five valid fields").describe("The cron schedule of the scheduled CI workflow."),
	ciTickCacheSeconds: seconds.describe("How long the scheduled workflow's last tick is kept before the remote is read again."),
	commitIdentity: commitIdentity.describe("The author and committer of every commit hum makes itself."),
	itemsDir: z.string().min(1).refine(isInsideRepo, "the items folder is a path inside the repo, without a leading or trailing '/'").describe("The folder of the repo that holds the markdown items."),
	providerTimeoutSeconds: seconds.describe("How long a failing provider call is retried before one card shows."),
	providerBackoff: backoff.describe("The pause before a provider call's first retry, doubled each retry up to the longest pause."),
	mergedShown: count.describe("Merged changes the status file lists."),
	statusReadTimeoutSeconds: seconds.describe("How long a read for the status file, such as the newest published version, may take before it is left out."),
	mergeTries: count.describe("Tries to merge a change when the base branch moves under it."),
	writeRaceRetries: z.int().nonnegative().describe("Retries of a markdown write that another writer's push beat."),
	itemReadsAtOnce: count.describe("Item files the markdown source reads at once; each read is a git process."),
	restartBackoff: backoff.describe("The pause before the service's first restart of a crashed worker, doubled each crash up to the longest pause."),
	restartDelaySeconds: seconds.describe("Seconds the service manager waits before it starts a failed start script again."),
	ciWakeTimeoutMinutes: count.describe("Minutes a CI wake may run before GitHub stops it."),
	strictPaths: z.array(name).describe("Globs of data and secrets: a change touching one takes the strictest level."),
	launches: z
		.array(Launch)
		.describe("Raises a path to a level for a launch: between two dates, from 'from' up to 'until', or while the base branch matches 'base'."),
	sizeRange: z
		.strictObject({ changes: count, fewest: count, middle: fraction })
		.describe("A path's usual size: the middle share of the lines its last 'changes' merged changes touched. A change above it goes one level up; a path with fewer than 'fewest' changes has no range."),
	loosenedCheck: z
		.strictObject({ added: z.array(pattern), removed: z.array(pattern) })
		.describe("A change whose added or removed lines match one of these loosens a check and goes one level up; empty lists turn the rule off."),
	changeLabels: z
		.strictObject({ fixWindow: count, fixSubject: pattern, revertSubject: pattern, revertTrailer: pattern })
		.describe("How hum labels a merged change from git: reverted by a commit whose trailer names it or whose subject reverts its subject; fixed by a fix commit within the next 'fixWindow' merged changes on its files that names it or changes its lines."),
	historyDepth: count.describe("Commits of the base branch hum reads for size ranges and fix counts."),
	lockfiles: z.array(name).describe("Lockfiles where a changed line naming the engine package changes hum itself."),
	hookPaths: z.array(name).describe("Globs of tracked git hooks; a change to one changes hum itself."),
	diffLimit: count.describe("The most characters of a change's diff one prompt carries."),
	failureTail: count.describe("The last characters of the checks' output a fix run reads."),
	kindMeanings: z.record(name, z.string().min(1)).describe("One line per kind saying what work it holds; the cheap model call reads these to pick an item's kind."),
	fallbackKind: name.describe("The kind an item runs as when neither its source nor the model call names one."),
	docsOnly: z
		.strictObject({ kind: name, paths: z.array(name) })
		.describe("An item of this kind whose change touches a path outside these globs moves to its real kind."),
	decisionModel: name.describe("The model id of the cheap model call, made through claude -p."),
	modelCallTimeoutSeconds: seconds.describe("How long a cheap model call may take before it counts as an abstention."),
	measuredModels: z
		.record(z.enum(BOUNDARIES), z.record(name, z.number().min(0).max(1)))
		.describe("Per model-judgment boundary, the rate each model id scored on its labelled set; a pick from an id below 'minJudgeRate', or not measured, counts as an abstention."),
	minJudgeRate: z.number().min(0).max(1).describe("The lowest measured rate at which hum trusts a model's pick at a boundary; below it the call abstains."),
	questionLimits: z
		.strictObject({ cells: count, wordCells: count })
		.describe("The most terminal cells a question holds, and the most any one word of it holds; a longer question is replaced by a short one and its text rides folded."),
	questionTimeoutHours: count.describe("Hours after a question that an item with no saved wait still counts as unanswered; past them the item ends stuck."),
	priorityLabels: z.array(name).describe("Item labels that put its question first under the daily cap, highest first."),
	undoableLevels: z.array(name).describe("Levels at which a choice that touches only the change's own files is made without the owner."),
	ownerBranchPrefix: branchPrefix.describe("The branch prefix of a pull request that lands a commit the owner wrote, such as an answer."),
	backgroundRuns: z.boolean().describe("Whether a run on the Mac is a Claude Code background agent, listed in agent view, instead of a claude -p process."),
	backgroundLaunchSeconds: z.number().positive().describe("How long a launch waits for the run it just started to appear in the agent list."),
	backgroundPollSeconds: z.number().positive().describe("The time between reads of a background run's transcript and job state."),
	deniedRunCommands: z.array(name).describe("Shell commands a background run may not run: each is denied as written, with any arguments."),
	runAutoMode: z
		.strictObject({ environment: z.array(z.string().min(1)), allow: z.array(z.string().min(1)), hardDeny: z.array(z.string().min(1)) })
		.describe("What auto mode's classifier is told about a background run: the situation it is in, what it allows, and what it always refuses; '$defaults' keeps Claude Code's own rules."),
	runSlots: z
		.strictObject({
			enabled: z.boolean(),
			pool: z.string().min(1),
			services: z.enum(SLOT_SERVICES),
			ports: z.strictObject({ base: count, stride: count }),
			projectPrefix: name,
			stepTimeoutSeconds: seconds,
			recipe: SlotRecipe,
		})
		.describe(
			"Prewarmed run slots on the Mac: worktrees of the owner's checkout that background runs work in, as many as 'runners'. 'pool' is the folder that holds them, relative to the checkout or absolute, and never inside .git, where Claude Code writes nothing; 'services' gives each slot its own services or one shared set with a database per slot; 'ports' starts each slot's block of ports; 'recipe' is the owner's own setup commands.",
		),
	mergeRisk: z
		.strictObject({
			weights: z.record(z.enum(GRADED), z.number().positive()),
			cuts: z.tuple([z.number().positive(), z.number().positive()]),
		})
		.describe("How the alignment grade raises a level: each category's grade, 1 to 3, times its weight, averaged; when the alignment call's grades move the average across a cut, the level goes one step up."),
});

/** The defaults hum ships with, read from the default `hum.json`. */
export const SHIPPED_DEFAULTS = Shipped.parse(shippedConfig);

/** The branch prefixes: every branch hum writes starts with one of them. */
export type Naming = Pick<z.infer<typeof Shipped>, "runBranchPrefix" | "claimPrefix">;

type Settings = typeof Shipped extends z.ZodObject<infer Fields> ? Fields : never;

const withShippedDefaults = (settings: Settings): { [Key in keyof Settings]: z.ZodDefault<Settings[Key]> } =>
	// SAFETY: `Object.fromEntries` loses the per-key types; each entry is its setting with its own shipped default.
	Object.fromEntries(Object.entries<z.ZodType>(settings).map(([key, setting]) => [key, setting.default(SHIPPED_DEFAULTS[key as keyof Settings])])) as never;

export const Role = z.strictObject({
	file: name,
	purpose: z.enum(PURPOSES),
	skills: z.array(name),
});

export const Level = z.strictObject({
	name,
	review: z.enum(REVIEWS),
	release: z.enum(RELEASES),
	onBreak: z.enum(BREAKS),
});

export type Level = z.infer<typeof Level>;

export const PathRule = z.strictObject({
	glob: name,
	level: name,
	/** By kind name, or `*` for every kind: what release waits for at a level that releases after proof. */
	proofs: z.record(name, name).optional(),
	/** At most `fixes` fixed or reverted changes among the path's last `of` merged changes; past it the path goes one level up. */
	limit: z.strictObject({ fixes: z.int().nonnegative(), of: count }).optional(),
});

export type PathRule = z.infer<typeof PathRule>;

export const HumConfig = z.strictObject({
	schemaVersion: z.literal(SCHEMA_VERSION),
	/** Risk levels, lowest first; the last is the strictest. */
	levels: z.array(Level).min(1),
	/** Risk level per path glob. */
	paths: z.array(PathRule),
	roles: z.record(name, Role),
	/** Each event type names the part that sends it. */
	events: z.record(name, z.strictObject({ source: name })),
	/** Kind names; each kind sits in `kinds/<name>.json`. */
	kinds: z.array(name).min(1),
	/** The owner's safety rule. */
	safety: z.record(z.string(), z.unknown()).optional(),
	dailyQuestionCap: z.number().int().positive().optional(),
	/** Adapter slot → adapter name. */
	integrations: z.record(name, name).optional(),
	/** The day `claude setup-token` made the CI token. Setup records it; the engine warns 30 days before the year ends. */
	ciToken: z.strictObject({ setUp: z.iso.date() }).optional(),
	...withShippedDefaults(Shipped.shape),
});

export type HumConfig = z.infer<typeof HumConfig>;

const Transition = z.strictObject({
	target: name.optional(),
	guard: z.strictObject({ type: name, params: z.unknown().optional() }).optional(),
	actions: z.array(z.strictObject({ type: name, params: z.unknown().optional() })).optional(),
	description: z.string().optional(),
});

const Transitions = z
	.union([Transition, z.array(Transition)])
	.transform((value) => (Array.isArray(value) ? value : [value]));

const StateNode = z.strictObject({
	type: z.enum(["atomic", "final"]).optional(),
	description: z.string().optional(),
	tags: z.array(name).optional(),
	/** A run: `src` names a role. */
	invoke: z
		.strictObject({ src: name, onDone: Transitions.optional(), onError: Transitions.optional() })
		.optional(),
	on: z.record(name, Transitions).optional(),
	always: Transitions.optional(),
	/** Numeric millisecond keys only: the timeout of a wait. */
	after: z.record(z.string().regex(/^\d+$/), Transitions).optional(),
	timeout: z.number().int().positive().optional(),
	onTimeout: Transitions.optional(),
	entry: z.array(z.strictObject({ type: name, params: z.unknown().optional() })).optional(),
	exit: z.array(z.strictObject({ type: name, params: z.unknown().optional() })).optional(),
});

export type StateNodeJSON = z.infer<typeof StateNode>;

/** A flat XState JSON machine: a version and a state map. */
export const MachineJSON = z.strictObject({
	id: name,
	version: name,
	initial: name,
	states: z.record(name, StateNode),
});

export type MachineJSON = z.infer<typeof MachineJSON>;

export const Kind = z.strictObject({
	/** Tier and effort by purpose, level and size; an omitted level or size matches all. */
	tiers: z.array(
		z.strictObject({
			purpose: z.enum(PURPOSES),
			level: name.optional(),
			size: z.enum(SIZES).optional(),
			tier: z.enum(TIERS),
			effort: z.enum(EFFORTS),
		}),
	),
	/** The token cap, and the machine state a run goes to when it passes the cap. */
	tokenCap: z.strictObject({ tokens: z.number().int().positive(), overCap: name }),
	/** Per earlier machine version: renamed or removed states, old name → new name. */
	stateMap: z.record(name, z.record(name, name)).optional(),
	machine: MachineJSON,
});

export type Kind = z.infer<typeof Kind>;

/**
 * Every part the owner may change, with the `hum.json` key that holds it.
 * Machines and the kinds' tables sit in `kinds/<name>.json`, listed by `kinds`.
 */
export const OWNER_CHANGEABLE = {
	machines: "kinds",
	roles: "roles",
	integrations: "integrations",
	"risk levels": "levels",
	"safety rule": "safety",
	"cheap model call": "decisionModel",
	"daily question cap": "dailyQuestionCap",
	"kinds' tables": "kinds",
	"run branch prefix": "runBranchPrefix",
	"claim prefix": "claimPrefix",
	"ready label": "readyLabel",
	"merge method": "mergeMethod",
	"model per tier": "models",
	"runner count": "runners",
	"tick interval": "tickIntervalSeconds",
	"drain timeout": "drainTimeoutSeconds",
	"claim expiry": "claimExpirySeconds",
	"latest-version cache": "latestVersionCacheSeconds",
	"fix runs": "maxFixRuns",
	"service label": "serviceLabel",
	"crash limit": "maxCrashes",
	"crash window": "crashWindowSeconds",
	"worker-down age": "workerDownTicks",
	"token warning lead": "tokenWarnDays",
	"CI schedule": "ciSchedule",
	"CI tick cache": "ciTickCacheSeconds",
	"commit identity": "commitIdentity",
	"items folder": "itemsDir",
	"provider timeout": "providerTimeoutSeconds",
	"provider backoff": "providerBackoff",
	"merged changes shown": "mergedShown",
	"status read timeout": "statusReadTimeoutSeconds",
	"merge tries": "mergeTries",
	"write race retries": "writeRaceRetries",
	"item reads at once": "itemReadsAtOnce",
	"restart backoff": "restartBackoff",
	"restart delay": "restartDelaySeconds",
	"CI wake timeout": "ciWakeTimeoutMinutes",
	"data and secrets paths": "strictPaths",
	"path rules": "paths",
	launches: "launches",
	"size range": "sizeRange",
	"loosened-check rule": "loosenedCheck",
	"change labels": "changeLabels",
	"history depth": "historyDepth",
	lockfiles: "lockfiles",
	"hook paths": "hookPaths",
	"diff limit": "diffLimit",
	"failure tail": "failureTail",
	"kind meanings": "kindMeanings",
	"fallback kind": "fallbackKind",
	"docs-only kind": "docsOnly",
	"model call timeout": "modelCallTimeoutSeconds",
	"measured models": "measuredModels",
	"judge rate bar": "minJudgeRate",
	"merge-risk weights": "mergeRisk",
	"question limits": "questionLimits",
	"question timeout": "questionTimeoutHours",
	"priority labels": "priorityLabels",
	"undoable levels": "undoableLevels",
	"owner branch prefix": "ownerBranchPrefix",
	"background runs": "backgroundRuns",
	"background poll": "backgroundPollSeconds",
	"background launch wait": "backgroundLaunchSeconds",
	"denied run commands": "deniedRunCommands",
	"run auto mode": "runAutoMode",
	"run slots": "runSlots",
} as const satisfies Record<string, string>;
