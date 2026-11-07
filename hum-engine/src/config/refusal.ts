/** One thing a config check found wrong. */
export type Problem =
	| { readonly check: "C2"; readonly kind: string; readonly problem: "unreachable-state"; readonly state: string }
	| { readonly check: "C2"; readonly kind: string; readonly problem: "dead-end-state"; readonly state: string }
	| { readonly check: "C2"; readonly kind: string; readonly problem: "wait-without-timeout"; readonly state: string }
	| { readonly check: "C3"; readonly problem: "event-without-source"; readonly event: string; readonly source: string | undefined }
	| { readonly check: "C3"; readonly problem: "event-without-handler"; readonly event: string }
	| { readonly check: "D7"; readonly kind: string; readonly problem: "run-and-owner-wait"; readonly state: string }
	| { readonly check: "V4"; readonly problem: "missing-hope-skill"; readonly skill: string; readonly role: string }
	| { readonly check: "shape"; readonly kind: string; readonly problem: "unknown-state"; readonly state: string; readonly why: string }
	| { readonly check: "shape"; readonly kind: string; readonly problem: "unknown-run-source"; readonly state: string; readonly src: string }
	| { readonly check: "shape"; readonly kind: string; readonly problem: "tier-table-gap"; readonly purpose: string; readonly level: string; readonly size: string }
	| { readonly check: "shape"; readonly kind: string; readonly problem: "machine-rejected"; readonly why: string }
	| { readonly check: "shape"; readonly problem: "missing-file"; readonly file: string }
	| { readonly check: "shape"; readonly problem: "unknown-level"; readonly level: string }
	| { readonly check: "shape"; readonly problem: "overlapping-prefixes"; readonly run: string; readonly claim: string };

/** A config change the engine will not take. The caller keeps the last good config. */
export type Refusal =
	| { readonly code: "malformed-config"; readonly where: string; readonly message: string }
	| { readonly code: "unknown-schema-version"; readonly found: number | undefined; readonly readable: readonly number[]; readonly message: string }
	| { readonly code: "invalid-config"; readonly problems: readonly Problem[]; readonly message: string }
	| { readonly code: "unmapped-state"; readonly items: readonly { readonly kind: string; readonly state: string }[]; readonly message: string }
	| { readonly code: "change-from-run"; readonly branch: string; readonly message: string };

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: Refusal };

export const describeProblem = (p: Problem): string => {
	switch (p.problem) {
		case "unreachable-state":
			return `${p.kind}: state "${p.state}" cannot be reached from the start`;
		case "dead-end-state":
			return `${p.kind}: state "${p.state}" never reaches done or stuck`;
		case "wait-without-timeout":
			return `${p.kind}: wait "${p.state}" has no timeout and timeout action`;
		case "event-without-source":
			return p.source === undefined
				? `event "${p.event}" is waited on but declared nowhere`
				: `event "${p.event}" has no source: "${p.source}" is not a part or role`;
		case "event-without-handler":
			return `event "${p.event}" has no handler in any kind`;
		case "run-and-owner-wait":
			return `${p.kind}: state "${p.state}" starts a run and waits on the owner`;
		case "missing-hope-skill":
			return `role "${p.role}" names hope skill "${p.skill}", which hope's installed copy lacks`;
		case "unknown-state":
			return `${p.kind}: ${p.why} names state "${p.state}", which does not exist`;
		case "unknown-run-source":
			return `${p.kind}: state "${p.state}" invokes "${p.src}", which is neither a role nor a part`;
		case "tier-table-gap":
			return `${p.kind}: no tier for purpose "${p.purpose}", level "${p.level}", size "${p.size}"`;
		case "machine-rejected":
			return `${p.kind}: the machine does not load: ${p.why}`;
		case "missing-file":
			return `file "${p.file}" is missing`;
		case "unknown-level":
			return `risk level "${p.level}" is not in levels`;
		case "overlapping-prefixes":
			return `the run branch prefix "${p.run}" and the claim prefix "${p.claim}" overlap: one starts with the other`;
	}
};

export const invalidConfig = (problems: readonly Problem[]): Refusal => ({
	code: "invalid-config",
	problems,
	message: `Config refused:\n${problems.map((p) => `- ${describeProblem(p)}`).join("\n")}`,
});
