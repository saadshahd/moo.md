/** One thing a config check found wrong. */
export type Problem =
	| { readonly problem: "unreachable-state"; readonly kind: string; readonly state: string }
	| { readonly problem: "dead-end-state"; readonly kind: string; readonly state: string }
	| { readonly problem: "wait-without-timeout"; readonly kind: string; readonly state: string }
	| { readonly problem: "event-without-source"; readonly event: string; readonly source: string | undefined }
	| { readonly problem: "event-without-handler"; readonly event: string }
	| { readonly problem: "run-and-owner-wait"; readonly kind: string; readonly state: string }
	| { readonly problem: "missing-hope-skill"; readonly skill: string; readonly role: string }
	| { readonly problem: "unknown-state"; readonly kind: string; readonly state: string; readonly why: string }
	| { readonly problem: "unknown-run-source"; readonly kind: string; readonly state: string; readonly src: string }
	| { readonly problem: "tier-table-gap"; readonly kind: string; readonly purpose: string; readonly level: string; readonly size: string }
	| { readonly problem: "machine-rejected"; readonly kind: string; readonly why: string }
	| { readonly problem: "missing-file"; readonly file: string }
	| { readonly problem: "unknown-level"; readonly level: string }
	| { readonly problem: "path-without-proof"; readonly glob: string; readonly level: string }
	| { readonly problem: "overlapping-prefixes"; readonly run: string; readonly claim: string };

/** A config change the engine will not take. The caller keeps the last good config. */
export type Refusal =
	| { readonly code: "malformed-config"; readonly where: string; readonly message: string }
	| { readonly code: "unknown-schema-version"; readonly found: number | undefined; readonly readable: readonly number[]; readonly message: string }
	| { readonly code: "invalid-config"; readonly problems: readonly Problem[]; readonly message: string }
	| { readonly code: "unmapped-state"; readonly items: readonly { readonly kind: string; readonly state: string }[]; readonly message: string }
	| { readonly code: "change-from-run"; readonly branch: string; readonly message: string }
	| { readonly code: "no-git-identity"; readonly missing: readonly string[]; readonly message: string };

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: Refusal };

type Describe = { readonly [Name in Problem["problem"]]: (problem: Extract<Problem, { problem: Name }>) => string };

const DESCRIPTIONS = {
	"unreachable-state": (p) => `${p.kind}: state "${p.state}" cannot be reached from the start`,
	"dead-end-state": (p) => `${p.kind}: state "${p.state}" never reaches done or stuck`,
	"wait-without-timeout": (p) => `${p.kind}: wait "${p.state}" has no timeout and timeout action`,
	"event-without-source": (p) =>
		p.source === undefined ? `event "${p.event}" is waited on but declared nowhere` : `event "${p.event}" has no source: "${p.source}" is not a part or role`,
	"event-without-handler": (p) => `event "${p.event}" has no handler in any kind`,
	"run-and-owner-wait": (p) => `${p.kind}: state "${p.state}" starts a run and waits on the owner`,
	"missing-hope-skill": (p) => `role "${p.role}" names hope skill "${p.skill}", which hope's installed copy lacks`,
	"unknown-state": (p) => `${p.kind}: ${p.why} names state "${p.state}", which does not exist`,
	"unknown-run-source": (p) => `${p.kind}: state "${p.state}" invokes "${p.src}", which is neither a role nor a part`,
	"tier-table-gap": (p) => `${p.kind}: no tier for purpose "${p.purpose}", level "${p.level}", size "${p.size}"`,
	"machine-rejected": (p) => `${p.kind}: the machine does not load: ${p.why}`,
	"missing-file": (p) => `file "${p.file}" is missing`,
	"unknown-level": (p) => `risk level "${p.level}" is not in levels`,
	"path-without-proof": (p) => `path "${p.glob}" is at level "${p.level}", whose release waits for proof, and names no proof for every kind`,
	"overlapping-prefixes": (p) => `the run branch prefix "${p.run}" and the claim prefix "${p.claim}" overlap: one starts with the other`,
} as const satisfies Describe;

// SAFETY: each description is keyed by the problem name it reads, so the lookup by `problem.problem` takes its own variant.
export const describeProblem = (problem: Problem): string => (DESCRIPTIONS[problem.problem] as (problem: Problem) => string)(problem);

export const invalidConfig = (problems: readonly Problem[]): Refusal => ({
	code: "invalid-config",
	problems,
	message: `Config refused:\n${problems.map((p) => `- ${describeProblem(p)}`).join("\n")}`,
});
