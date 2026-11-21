import { APP_TOKEN_MINUTES, WAKE_OWN_ENV } from "./wake-job.ts";
import { isProsePurpose, PROSE_STATES } from "../decide/prose.ts";
import { z } from "zod";
import { GUARD_PARAMS, kindMachine, nextStates, reachedFrom } from "./machine.ts";
import type { Problem } from "./refusal.ts";
import {
	FIXED_PARTS,
	type HumConfig,
	isRunPart,
	type Kind,
	type Naming,
	OWNER_WAIT_TAG,
	type PathRule,
	SIZES,
	STUCK_TAG,
	type StateNodeJSON,
	WAIT_TAG,
} from "./schema.ts";

/** What the checks read besides the config: the installed plugins' skills, as a role names them (`hope:intent`); absent where no role runs, so no role's skills are checked. */
export type CheckEnv = { readonly installedSkills?: ReadonlySet<string> };

type Transitions = StateNodeJSON["onTimeout"];

const isWait = (node: StateNodeJSON) => node.tags?.includes(WAIT_TAG) || node.tags?.includes(OWNER_WAIT_TAG);
const isTerminal = (node: StateNodeJSON) => node.type === "final" || node.tags?.includes(STUCK_TAG);

const doesSettle = (value: Transitions) =>
	(value ?? []).some((t) => t.target !== undefined || (t.actions?.length ?? 0) > 0);

/** Whether a wait ends on its own: a timeout with an action that settles it, or a delay that does. */
const hasTimeoutAction = (node: StateNodeJSON): boolean => (doesSettle(node.onTimeout) && node.timeout !== undefined) || Object.values(node.after ?? {}).some(doesSettle);

/** Events xstate sends itself, which no config declares. */
const isXstateEvent = (event: string): boolean => event.startsWith("xstate.") || event.startsWith("@xstate.");

/** Every state is reachable and reaches done or stuck; every wait has a timeout and an action. */
const graphProblems = (kind: string, config: Kind): Problem[] => {
	const { states, initial } = config.machine;
	const forward = nextStates(config);
	const backward = new Map<string, string[]>();

	for (const [source, targets] of forward) for (const target of targets) backward.set(target, [...(backward.get(target) ?? []), source]);

	const reachable = reachedFrom(initial, forward);
	const terminal = Object.entries(states).flatMap(([name, node]) => (isTerminal(node) ? [name] : []));
	const finishing = new Set(terminal.flatMap((state) => [...reachedFrom(state, backward)]));

	return Object.entries(states).flatMap(([state, node]): Problem[] => [
		...(reachable.has(state) ? [] : [{ problem: "unreachable-state", kind, state } as const]),
		...(finishing.has(state) ? [] : [{ problem: "dead-end-state", kind, state } as const]),
		...(isWait(node) && !hasTimeoutAction(node) ? [{ problem: "wait-without-timeout", kind, state } as const] : []),
	]);
};

/** Every transition a state holds, wherever it holds one. */
const transitionsOf = (node: StateNodeJSON) => [...Object.values(node.on ?? {}), ...Object.values(node.after ?? {}), node.always ?? [], node.onTimeout ?? [], node.invoke?.onDone ?? [], node.invoke?.onError ?? []].flat();

const isGuard = (type: string): type is keyof typeof GUARD_PARAMS => Object.hasOwn(GUARD_PARAMS, type);

/** Every guard a transition names is one the engine has, with the params it takes. */
const guardProblems = (kind: string, { machine }: Kind): Problem[] =>
	Object.entries(machine.states).flatMap(([state, node]) =>
		transitionsOf(node).flatMap(({ guard }): Problem[] => {
			if (guard === undefined) return [];

			if (!isGuard(guard.type)) return [{ problem: "unknown-guard", kind, state, guard: guard.type }];

			const params = GUARD_PARAMS[guard.type].safeParse(guard.params);

			return params.success ? [] : [{ problem: "guard-params", kind, state, guard: guard.type, why: z.prettifyError(params.error) }];
		}),
	);

const kindProblems = (kind: string, config: Kind, hum: HumConfig): Problem[] => {
	const { states } = config.machine;
	const problems: Problem[] = [];

	if (!(config.tokenCap.overCap in states)) {
		problems.push({ problem: "unknown-state", kind, state: config.tokenCap.overCap, why: "tokenCap.overCap" });
	}

	/** Each role a state runs, by name, with its purpose. */
	const runs = new Map<string, string>();

	for (const [state, node] of Object.entries(states)) {
		if (node.invoke) {
			const role = hum.roles[node.invoke.src];

			if (role) runs.set(node.invoke.src, role.purpose);
			else if (!isRunPart(node.invoke.src)) {
				problems.push({ problem: "unknown-run-source", kind, state, src: node.invoke.src });
			}

			if (role && node.tags?.includes(OWNER_WAIT_TAG)) {
				problems.push({ problem: "run-and-owner-wait", kind, state });
			}

			const unsure = role && isProsePurpose(role.purpose) ? PROSE_STATES[role.purpose].unsure : undefined;

			if (unsure !== undefined && node.on?.[unsure] === undefined) {
				problems.push({ problem: "unsure-unhandled", kind, state, role: node.invoke.src, event: unsure });
			}
		}
	}

	/* A design run starts a row of each pick role a choice names, so a kind that runs one runs them all. */
	if ([...runs.values()].includes("design")) for (const [role, { purpose }] of Object.entries(hum.roles)) if (purpose === "pick") runs.set(role, purpose);

	const levels = levelNames(hum);

	for (const row of config.tiers) {
		if (row.level !== undefined && !levels.has(row.level)) {
			problems.push({ problem: "unknown-level", level: row.level });
		}

		if (row.role !== undefined && hum.roles[row.role]?.purpose !== row.purpose) {
			problems.push({ problem: "tier-role-mismatch", kind, role: row.role, purpose: row.purpose });
		}
	}

	for (const [role, purpose] of runs) {
		for (const level of levels) {
			for (const size of SIZES) {
				if (!pickTier(config, { role, purpose, level, size })) {
					problems.push({ problem: "tier-table-gap", kind, role, purpose, level, size });
				}
			}
		}
	}

	const guards = guardProblems(kind, config);

	if (guards.length > 0) return [...problems, ...guards];

	try {
		kindMachine(config);
	} catch (error) {
		return [...problems, { problem: "machine-rejected", kind, why: error instanceof Error ? error.message : String(error) }];
	}

	return [...problems, ...graphProblems(kind, config)];
};

type TierRow = Kind["tiers"][number];

/** How closely a row fits: a row that names its role outranks any that does not, then each of level and size it names counts one. */
const fitOf = ({ role, level, size }: TierRow): number => 3 * Number(role !== undefined) + Number(level !== undefined) + Number(size !== undefined);

/** The most specific tier row for a run of `role`, or undefined when the table has a gap. A row that names another role never fits. */
export const pickTier = (kind: Pick<Kind, "tiers">, key: { role: string; purpose: string; level: string; size: string }): TierRow | undefined =>
	kind.tiers
		.filter(
			(row) =>
				row.purpose === key.purpose &&
				(row.role === undefined || row.role === key.role) &&
				(row.level === undefined || row.level === key.level) &&
				(row.size === undefined || row.size === key.size),
		)
		.sort((a, b) => fitOf(b) - fitOf(a))[0];

/** Every event has a source and a handler, and every event a machine waits on has a source. */
const eventProblems = (hum: HumConfig, kinds: Readonly<Record<string, Kind>>): Problem[] => {
	const parts = new Set<string>([...FIXED_PARTS, ...Object.keys(hum.roles)]);
	const handled = new Set(Object.values(kinds).flatMap((kind) => Object.values(kind.machine.states).flatMap((node) => Object.keys(node.on ?? {}))));

	return [
		...Object.entries(hum.events).flatMap(([event, { source }]): Problem[] => [
			...(parts.has(source) ? [] : [{ problem: "event-without-source", event, source } as const]),
			...(handled.has(event) ? [] : [{ problem: "event-without-handler", event } as const]),
		]),
		...[...handled].flatMap((event): Problem[] =>
			event in hum.events || isXstateEvent(event) ? [] : [{ problem: "event-without-source", event, source: undefined }],
		),
	];
};

/** A plugin's skill is named `<plugin>:<skill>`; a bare name is the repo's or the user's own, which no plugin list holds. */
const isPluginSkill = (skill: string): boolean => skill.includes(":");

/** Each plugin skill a role names is in an installed plugin, where roles run. */
const skillProblems = (hum: HumConfig, { installedSkills }: CheckEnv): Problem[] =>
	installedSkills === undefined
		? []
		: Object.entries(hum.roles).flatMap(([role, { skills }]) => skills.flatMap((skill): Problem[] => (isPluginSkill(skill) && !installedSkills.has(skill) ? [{ problem: "missing-skill", skill, role }] : [])));

/** A run branch could then share a name, or a folder, with a claim branch. */
const doPrefixesOverlap = ({ runBranchPrefix, claimPrefix }: Naming): boolean =>
	runBranchPrefix.startsWith(claimPrefix) || claimPrefix.startsWith(runBranchPrefix);

const namingProblems = (hum: HumConfig): Problem[] =>
	doPrefixesOverlap(hum) ? [{ problem: "overlapping-prefixes", run: hum.runBranchPrefix, claim: hum.claimPrefix }] : [];

const levelNames = (hum: HumConfig): ReadonlySet<string> => new Set(hum.levels.map(({ name }) => name));

const ALL_KINDS = "*";

/** A path whose level releases only after proof names a proof for every kind, or for each kind there is. */
const doesProveEveryKind = (rule: PathRule, kinds: readonly string[]): boolean =>
	rule.proofs?.[ALL_KINDS] !== undefined || kinds.every((kind) => rule.proofs?.[kind] !== undefined);

const pathProblems = (hum: HumConfig): Problem[] => {
	const levels = levelNames(hum);
	const afterProof = new Set(hum.levels.filter(({ release }) => release === "after-proof").map(({ name }) => name));

	return [
		...[...hum.paths, ...hum.launches, ...Object.values(hum.kindFloors).map((level) => ({ level }))].flatMap(({ level }): Problem[] => (levels.has(level) ? [] : [{ problem: "unknown-level", level }])),
		...hum.paths.flatMap((rule): Problem[] =>
			afterProof.has(rule.level) && !doesProveEveryKind(rule, hum.kinds) ? [{ problem: "path-without-proof", glob: rule.glob, level: rule.level }] : [],
		),
	];
};

/** The default kind, where the owner names one, is one of the kinds. */
const defaultKindProblems = ({ defaultKind, kinds }: HumConfig): Problem[] => (defaultKind === null || kinds.includes(defaultKind) ? [] : [{ problem: "unknown-default-kind", kind: defaultKind }]);

/** `ciEnv` sets none of the env the wake's jobs set themselves. */
const wakeEnvProblems = ({ ciEnv }: HumConfig): Problem[] =>
	Object.keys(ciEnv).flatMap((name): Problem[] => (WAKE_OWN_ENV.has(name) ? [{ problem: "wake-env-taken", name }] : []));

/** Publish keeps less than the App token's hour in hand, so it has time left to merge. */
const mergeMarginProblems = ({ ciMergeMarginMinutes }: HumConfig): Problem[] =>
	ciMergeMarginMinutes < APP_TOKEN_MINUTES ? [] : [{ problem: "merge-margin-fills-token-hour", minutes: ciMergeMarginMinutes, tokenMinutes: APP_TOKEN_MINUTES }];

/** The proof a path names for a kind: its own, else the one for every kind. */
export const proofFor = (rule: PathRule, kind: string): string | undefined => rule.proofs?.[kind] ?? rule.proofs?.[ALL_KINDS];

/** Every config check at start and on every change; returns all problems found. */
export const checkConfig = (
	hum: HumConfig,
	kinds: Readonly<Record<string, Kind>>,
	roleFiles: ReadonlySet<string>,
	env: CheckEnv,
): Problem[] => [
	...Object.values(hum.roles)
		.flatMap(({ file }): Problem[] => (roleFiles.has(file) ? [] : [{ problem: "missing-file", file }])),
	...pathProblems(hum),
	...defaultKindProblems(hum),
	...Object.entries(kinds).flatMap(([name, kind]) => kindProblems(name, kind, hum)),
	...eventProblems(hum, kinds),
	...skillProblems(hum, env),
	...namingProblems(hum),
	...wakeEnvProblems(hum),
	...mergeMarginProblems(hum),
];
