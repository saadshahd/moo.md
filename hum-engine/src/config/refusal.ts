/** One thing a config check found wrong. */
export type Problem =
	| { readonly problem: "unreachable-state"; readonly kind: string; readonly state: string }
	| { readonly problem: "dead-end-state"; readonly kind: string; readonly state: string }
	| { readonly problem: "wait-without-timeout"; readonly kind: string; readonly state: string }
	| { readonly problem: "event-without-source"; readonly event: string; readonly source: string | undefined }
	| { readonly problem: "event-without-handler"; readonly event: string }
	| { readonly problem: "run-and-owner-wait"; readonly kind: string; readonly state: string }
	| { readonly problem: "missing-skill"; readonly skill: string; readonly role: string }
	| { readonly problem: "unknown-state"; readonly kind: string; readonly state: string; readonly why: string }
	| { readonly problem: "unknown-run-source"; readonly kind: string; readonly state: string; readonly src: string }
	| { readonly problem: "tier-table-gap"; readonly kind: string; readonly purpose: string; readonly level: string; readonly size: string }
	| { readonly problem: "machine-rejected"; readonly kind: string; readonly why: string }
	| { readonly problem: "missing-file"; readonly file: string }
	| { readonly problem: "unknown-level"; readonly level: string }
	| { readonly problem: "path-without-proof"; readonly glob: string; readonly level: string }
	| { readonly problem: "overlapping-prefixes"; readonly run: string; readonly claim: string }
	| { readonly problem: "wake-env-taken"; readonly name: string }
	| { readonly problem: "wake-outlasts-app-token"; readonly minutes: number; readonly tokenMinutes: number };

/** A config change the engine will not take. The caller keeps the last good config. */
export type Refusal =
	| { readonly code: "malformed-config"; readonly where: string; readonly message: string }
	| { readonly code: "unknown-schema-version"; readonly found: number | undefined; readonly readable: readonly number[]; readonly message: string }
	| { readonly code: "invalid-config"; readonly problems: readonly Problem[]; readonly message: string }
	| { readonly code: "unmapped-state"; readonly items: readonly { readonly kind: string; readonly state: string }[]; readonly message: string }
	| { readonly code: "change-from-run"; readonly branch: string; readonly message: string }
	| { readonly code: "no-git-identity"; readonly missing: readonly string[]; readonly message: string }
	| { readonly code: "own-runner-on-public-repo"; readonly message: string };

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
	"missing-skill": (p) => `role "${p.role}" names skill "${p.skill}", which no installed plugin has`,
	"unknown-state": (p) => `${p.kind}: ${p.why} names state "${p.state}", which does not exist`,
	"unknown-run-source": (p) => `${p.kind}: state "${p.state}" invokes "${p.src}", which is neither a role nor a part`,
	"tier-table-gap": (p) => `${p.kind}: no tier for purpose "${p.purpose}", level "${p.level}", size "${p.size}"`,
	"machine-rejected": (p) => `${p.kind}: the machine does not load: ${p.why}`,
	"missing-file": (p) => `file "${p.file}" is missing`,
	"unknown-level": (p) => `risk level "${p.level}" is not in levels`,
	"path-without-proof": (p) => `path "${p.glob}" is at level "${p.level}", whose release waits for proof, and names no proof for every kind`,
	"overlapping-prefixes": (p) => `the run branch prefix "${p.run}" and the claim prefix "${p.claim}" overlap: one starts with the other`,
	"wake-env-taken": (p) => `ciEnv sets ${p.name}, which the CI wake job sets itself`,
	"wake-outlasts-app-token": (p) =>
		`ciWakeTimeoutMinutes is ${p.minutes}, and the token a GitHub App mints lasts ${p.tokenMinutes} minutes: a longer wake loses GitHub before it ends`,
} as const satisfies Describe;

// SAFETY: each description is keyed by the problem name it reads, so the lookup by `problem.problem` takes its own variant.
export const describeProblem = (problem: Problem): string => (DESCRIPTIONS[problem.problem] as (problem: Problem) => string)(problem);

/** hum commits as the owner and invents no identity: this names each git config key that holds none, and how to set it. */
export const noGitIdentity = (missing: readonly string[]): Refusal => ({
	code: "no-git-identity",
	missing,
	message: `hum commits as you, and git config holds no ${missing.join(" or ")}. Set ${missing.length === 1 ? "it" : "each"}, then run again: ${missing.map((key) => `git config --global ${key} "<yours>"`).join("; ")}.`,
});

export const invalidConfig = (problems: readonly Problem[]): Refusal => ({
	code: "invalid-config",
	problems,
	message: `Config refused:\n${problems.map((p) => `- ${describeProblem(p)}`).join("\n")}`,
});
