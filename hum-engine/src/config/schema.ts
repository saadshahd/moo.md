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

const Shipped = z.object({ runBranchPrefix: branchPrefix, claimPrefix: branchPrefix, readyLabel: name, mergeMethod: z.enum(MERGE_METHODS) });

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
} as const satisfies Record<string, string>;
