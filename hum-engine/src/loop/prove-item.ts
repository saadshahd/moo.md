import type { Git } from "../adapters/git.ts";
import type { Config } from "../config/load.ts";
import type { State } from "../state/open.ts";
import { checksTimeoutMs } from "../worker/checks.ts";
import { proveCheck } from "./proof.ts";

export type ProveItem = {
	readonly state: State;
	readonly config: Config;
	readonly git: Git;
	readonly item: string;
	readonly base: string;
	readonly checks: readonly string[];
	readonly now: () => number;
};

/**
 * Proves the check a check item made, against the notes of the repeat group it was filed for, and saves what the
 * proof cost. `undefined` when the item belongs to no group, so there is no note to prove it against.
 */
export const proveCheckItem = async ({ state, config, git, item, base, checks, now }: ProveItem) => {
	const group = state.repeats.list().find((found) => found.item === item);

	if (!group) return undefined;

	const notes = group.notes.flatMap((key) => state.notes.get(key) ?? []);
	const head = (await git.raw(["rev-parse", "HEAD"])).trim();
	const proof = await proveCheck({ git, head, base: `origin/${base}`, notes, checks, timeoutMs: checksTimeoutMs(config.hum), now });

	state.proofs.put(item, { item, at: now(), ...proof });

	return proof;
};
