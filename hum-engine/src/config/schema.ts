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

const seconds = z.int().positive();

const count = z.int().positive();

const SERVICE_LABEL = /^[A-Za-z0-9._-]+$/;

const CRON_FIELDS = /^(\S+\s+){4}\S+$/;

const isInsideRepo = (path: string): boolean => !path.startsWith("/") && !path.endsWith("/") && !path.split("/").includes("..");

const commitIdentity = z.strictObject({ name, email: name });

const Shipped = z.object({
	runBranchPrefix: branchPrefix,
	claimPrefix: branchPrefix,
	readyLabel: name,
	mergeMethod: z.enum(MERGE_METHODS),
	models: z.record(z.enum(TIERS), name),
	runners: z.int().positive(),
	tickIntervalSeconds: seconds,
	drainTimeoutSeconds: seconds,
	claimExpirySeconds: seconds,
	latestVersionCacheSeconds: seconds,
	maxFixRuns: z.int().nonnegative(),
	serviceLabel: z.string().regex(SERVICE_LABEL, "a service label is letters, digits, dot, dash and underscore"),
	maxCrashes: count,
	crashWindowSeconds: seconds,
	workerDownTicks: count,
	tokenWarnDays: count,
	ciSchedule: z.string().regex(CRON_FIELDS, "a cron schedule has five fields"),
	ciTickCacheSeconds: seconds,
	commitIdentity,
	itemsDir: z.string().min(1).refine(isInsideRepo, "the items folder is a path inside the repo, without a leading or trailing '/'"),
});

/** The defaults hum ships with, read from the default `hum.json`. */
export const SHIPPED_DEFAULTS = Shipped.parse(shippedConfig);

/** The branch prefixes: every branch hum writes starts with one of them. */
export type Naming = Pick<z.infer<typeof Shipped>, "runBranchPrefix" | "claimPrefix">;

export const Role = z.strictObject({
	file: name,
	purpose: z.enum(PURPOSES),
	skills: z.array(name),
});

export const HumConfig = z.strictObject({
	schemaVersion: z.literal(SCHEMA_VERSION),
	/** Risk levels, lowest first. */
	levels: z.array(name).min(1),
	/** Risk level per path glob. */
	paths: z.array(z.strictObject({ glob: name, level: name })),
	roles: z.record(name, Role),
	/** Each event type names the part that sends it. */
	events: z.record(name, z.strictObject({ source: name })),
	/** Kind names; each kind sits in `kinds/<name>.json`. */
	kinds: z.array(name).min(1),
	/** The owner's safety rule. */
	safety: z.record(z.string(), z.unknown()).optional(),
	/** The cheap model call: the owner's decision model, else Haiku through `claude -p`. */
	decisionModel: name.optional(),
	dailyQuestionCap: z.number().int().positive().optional(),
	/** Adapter slot → adapter name. */
	integrations: z.record(name, name).optional(),
	/** The day `claude setup-token` made the CI token. Setup records it; the engine warns 30 days before the year ends. */
	ciToken: z.strictObject({ setUp: z.iso.date() }).optional(),
	/** Each run builds on the branch this prefix and its item id make. */
	runBranchPrefix: Shipped.shape.runBranchPrefix.default(SHIPPED_DEFAULTS.runBranchPrefix),
	/** A claim is the first push of the branch this prefix and its item id make. */
	claimPrefix: Shipped.shape.claimPrefix.default(SHIPPED_DEFAULTS.claimPrefix),
	/** The label that marks an issue ready for hum. */
	readyLabel: Shipped.shape.readyLabel.default(SHIPPED_DEFAULTS.readyLabel),
	/** How a released pull request merges. */
	mergeMethod: Shipped.shape.mergeMethod.default(SHIPPED_DEFAULTS.mergeMethod),
	/** The model id each tier of a kind's table runs on. */
	models: Shipped.shape.models.default(SHIPPED_DEFAULTS.models),
	/** The most runs that go at once. */
	runners: Shipped.shape.runners.default(SHIPPED_DEFAULTS.runners),
	/** The time between worker ticks; each tick writes the heartbeat and renews the claims in flight. */
	tickIntervalSeconds: Shipped.shape.tickIntervalSeconds.default(SHIPPED_DEFAULTS.tickIntervalSeconds),
	/** How long a worker that has seen an update lets its runs finish before it stops them. */
	drainTimeoutSeconds: Shipped.shape.drainTimeoutSeconds.default(SHIPPED_DEFAULTS.drainTimeoutSeconds),
	/** How long a claim lasts unless its holder renews it. */
	claimExpirySeconds: Shipped.shape.claimExpirySeconds.default(SHIPPED_DEFAULTS.claimExpirySeconds),
	/** How long the newest published engine version is kept before it is read again. */
	latestVersionCacheSeconds: Shipped.shape.latestVersionCacheSeconds.default(SHIPPED_DEFAULTS.latestVersionCacheSeconds),
	/** Fix runs an item gets after failed checks before it ends stuck. */
	maxFixRuns: Shipped.shape.maxFixRuns.default(SHIPPED_DEFAULTS.maxFixRuns),
	/** The service unit's label, and the name its file takes. */
	serviceLabel: Shipped.shape.serviceLabel.default(SHIPPED_DEFAULTS.serviceLabel),
	/** Worker crashes within `crashWindowSeconds` that stop the service's restarts. */
	maxCrashes: Shipped.shape.maxCrashes.default(SHIPPED_DEFAULTS.maxCrashes),
	crashWindowSeconds: Shipped.shape.crashWindowSeconds.default(SHIPPED_DEFAULTS.crashWindowSeconds),
	/** Ticks without a heartbeat before the worker-down card shows. */
	workerDownTicks: Shipped.shape.workerDownTicks.default(SHIPPED_DEFAULTS.workerDownTicks),
	/** Days before the CI token's year ends that the expiry card shows. */
	tokenWarnDays: Shipped.shape.tokenWarnDays.default(SHIPPED_DEFAULTS.tokenWarnDays),
	/** The cron schedule of the scheduled CI workflow. */
	ciSchedule: Shipped.shape.ciSchedule.default(SHIPPED_DEFAULTS.ciSchedule),
	/** How long the scheduled workflow's last tick is kept before the remote is read again. */
	ciTickCacheSeconds: Shipped.shape.ciTickCacheSeconds.default(SHIPPED_DEFAULTS.ciTickCacheSeconds),
	/** The author and committer of every commit hum makes itself. */
	commitIdentity: Shipped.shape.commitIdentity.default(SHIPPED_DEFAULTS.commitIdentity),
	/** The folder of the repo that holds the markdown items. */
	itemsDir: Shipped.shape.itemsDir.default(SHIPPED_DEFAULTS.itemsDir),
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
} as const satisfies Record<string, string>;
