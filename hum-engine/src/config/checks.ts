import { toDirectedGraph } from "xstate/graph";
import { kindMachine } from "./machine.ts";
import type { Problem } from "./refusal.ts";
import {
	FIXED_PARTS,
	type HumConfig,
	type Kind,
	type Naming,
	OWNER_WAIT_TAG,
	type PathRule,
	SIZES,
	STUCK_TAG,
	type StateNodeJSON,
	WAIT_TAG,
} from "./schema.ts";

/** What the checks read besides the config: hope's installed skills, by bare name (`intent`, not `hope:intent`). */
export type CheckEnv = { readonly hopeSkills: ReadonlySet<string> };

type Transitions = StateNodeJSON["onTimeout"];

const FIXED = new Set<string>(FIXED_PARTS);

const isWait = (node: StateNodeJSON) => node.tags?.includes(WAIT_TAG) || node.tags?.includes(OWNER_WAIT_TAG);
const isTerminal = (node: StateNodeJSON) => node.type === "final" || node.tags?.includes(STUCK_TAG);

const settles = (value: Transitions) =>
	(value ?? []).some((t) => t.target !== undefined || (t.actions?.length ?? 0) > 0);

/** Every state is reachable and reaches done or stuck; every wait has a timeout and an action. */
const graphProblems = (kind: string, config: Kind): Problem[] => {
	const { states, initial } = config.machine;
	const graph = toDirectedGraph(kindMachine(config));
	const forward = new Map<string, string[]>();
	const backward = new Map<string, string[]>();

	for (const node of graph.children) {
		for (const edge of node.edges) {
			forward.set(edge.source.key, [...(forward.get(edge.source.key) ?? []), edge.target.key]);
			backward.set(edge.target.key, [...(backward.get(edge.target.key) ?? []), edge.source.key]);
		}
	}

	const walk = (from: Iterable<string>, edges: Map<string, string[]>) => {
		const seen = new Set<string>(from);
		const todo = [...seen];

		for (let key = todo.pop(); key !== undefined; key = todo.pop()) {
			for (const next of edges.get(key) ?? []) {
				if (seen.has(next)) continue;

				seen.add(next);
				todo.push(next);
			}
		}

		return seen;
	};

	const reachable = walk([initial], forward);

	const finishing = walk(
		Object.entries(states).flatMap(([name, node]) => (isTerminal(node) ? [name] : [])),
		backward,
	);

	return Object.entries(states).flatMap(([state, node]): Problem[] => [
		...(reachable.has(state) ? [] : [{ problem: "unreachable-state", kind, state } as const]),
		...(finishing.has(state) ? [] : [{ problem: "dead-end-state", kind, state } as const]),
		...(isWait(node) && !(settles(node.onTimeout) && node.timeout !== undefined) && !Object.values(node.after ?? {}).some(settles)
			? [{ problem: "wait-without-timeout", kind, state } as const]
			: []),
	]);
};

const kindProblems = (kind: string, config: Kind, hum: HumConfig): Problem[] => {
	const { states } = config.machine;
	const problems: Problem[] = [];

	if (!(config.tokenCap.overCap in states)) {
		problems.push({ problem: "unknown-state", kind, state: config.tokenCap.overCap, why: "tokenCap.overCap" });
	}

	const purposes = new Set<string>();

	for (const [state, node] of Object.entries(states)) {
		if (node.invoke) {
			const role = hum.roles[node.invoke.src];

			if (role) purposes.add(role.purpose);
			else if (!FIXED.has(node.invoke.src)) {
				problems.push({ problem: "unknown-run-source", kind, state, src: node.invoke.src });
			}

			if (role && node.tags?.includes(OWNER_WAIT_TAG)) {
				problems.push({ problem: "run-and-owner-wait", kind, state });
			}
		}
	}

	const levels = levelNames(hum);

	for (const row of config.tiers) {
		if (row.level !== undefined && !levels.has(row.level)) {
			problems.push({ problem: "unknown-level", level: row.level });
		}
	}

	for (const purpose of purposes) {
		for (const level of levels) {
			for (const size of SIZES) {
				if (!pickTier(config, { purpose, level, size })) {
					problems.push({ problem: "tier-table-gap", kind, purpose, level, size });
				}
			}
		}
	}

	try {
		kindMachine(config);
	} catch (error) {
		return [...problems, { problem: "machine-rejected", kind, why: error instanceof Error ? error.message : String(error) }];
	}

	return [...problems, ...graphProblems(kind, config)];
};

/** The most specific tier row for a run, or undefined when the table has a gap. */
export const pickTier = (kind: Pick<Kind, "tiers">, key: { purpose: string; level: string; size: string }) =>
	kind.tiers
		.filter(
			(row) =>
				row.purpose === key.purpose &&
				(row.level === undefined || row.level === key.level) &&
				(row.size === undefined || row.size === key.size),
		)
		.sort((a, b) => Number(b.level !== undefined) + Number(b.size !== undefined) - (Number(a.level !== undefined) + Number(a.size !== undefined)))[0];

/** Every event has a source and a handler, and every event a machine waits on has a source. */
const eventProblems = (hum: HumConfig, kinds: Readonly<Record<string, Kind>>): Problem[] => {
	const parts = new Set<string>([...FIXED_PARTS, ...Object.keys(hum.roles)]);
	const handled = new Set<string>();

	for (const kind of Object.values(kinds)) {
		for (const node of Object.values(kind.machine.states)) {
			for (const event of Object.keys(node.on ?? {})) handled.add(event);
		}
	}

	return [
		...Object.entries(hum.events).flatMap(([event, { source }]): Problem[] => [
			...(parts.has(source) ? [] : [{ problem: "event-without-source", event, source } as const]),
			...(handled.has(event) ? [] : [{ problem: "event-without-handler", event } as const]),
		]),
		...[...handled].flatMap((event): Problem[] =>
			event in hum.events || event.startsWith("xstate.") || event.startsWith("@xstate.")
				? []
				: [{ problem: "event-without-source", event, source: undefined }],
		),
	];
};

/** Each `hope:<skill>` a role names exists in hope's installed copy. */
const skillProblems = (hum: HumConfig, env: CheckEnv): Problem[] =>
	Object.entries(hum.roles).flatMap(([role, { skills }]) =>
		skills.flatMap((skill): Problem[] =>
			skill.startsWith("hope:") && !env.hopeSkills.has(skill.slice("hope:".length))
				? [{ problem: "missing-hope-skill", skill, role }]
				: [],
		),
	);

/** A run branch could then share a name, or a folder, with a claim branch. */
const prefixesOverlap = ({ runBranchPrefix, claimPrefix }: Naming): boolean =>
	runBranchPrefix.startsWith(claimPrefix) || claimPrefix.startsWith(runBranchPrefix);

const namingProblems = (hum: HumConfig): Problem[] =>
	prefixesOverlap(hum) ? [{ problem: "overlapping-prefixes", run: hum.runBranchPrefix, claim: hum.claimPrefix }] : [];

const levelNames = (hum: HumConfig): ReadonlySet<string> => new Set(hum.levels.map(({ name }) => name));

const ALL_KINDS = "*";

/** A path whose level releases only after proof names a proof for every kind, or for each kind there is. */
const provesEveryKind = (rule: PathRule, kinds: readonly string[]): boolean =>
	rule.proofs?.[ALL_KINDS] !== undefined || kinds.every((kind) => rule.proofs?.[kind] !== undefined);

const pathProblems = (hum: HumConfig): Problem[] => {
	const levels = levelNames(hum);
	const afterProof = new Set(hum.levels.filter(({ release }) => release === "after-proof").map(({ name }) => name));

	return [
		...[...hum.paths, ...hum.launches, ...Object.values(hum.kindFloors).map((level) => ({ level }))].flatMap(({ level }): Problem[] => (levels.has(level) ? [] : [{ problem: "unknown-level", level }])),
		...hum.paths.flatMap((rule): Problem[] =>
			afterProof.has(rule.level) && !provesEveryKind(rule, hum.kinds) ? [{ problem: "path-without-proof", glob: rule.glob, level: rule.level }] : [],
		),
	];
};

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
	...Object.entries(kinds).flatMap(([name, kind]) => kindProblems(name, kind, hum)),
	...eventProblems(hum, kinds),
	...skillProblems(hum, env),
	...namingProblems(hum),
];
