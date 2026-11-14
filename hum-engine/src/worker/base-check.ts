import { ItemId, type WorkSource } from "../adapter-api.ts";
import { type Git } from "../adapters/git.ts";
import type { Config } from "../config/load.ts";
import { inWorktreeAt } from "../loop/proof.ts";
import type { State } from "../state/open.ts";
import { checksTimeoutMs, runChecks } from "./checks.ts";
import { placementOf } from "./land.ts";

export type BaseCheckOptions = {
	readonly state: State;
	readonly config: Config;
	readonly workSource: Pick<WorkSource, "fileFollowUp">;
	/** A repo whose `origin/<base>` holds the base's history; the merged commit is fetched into it. */
	readonly git: Git;
	readonly remote: string;
	readonly base: string;
	readonly checks: readonly string[];
	readonly now: () => number;
	readonly item: string;
};

/** The repo's checks on the base at some commit, for the merges they cover: their failure, absent when they passed. */
export type BaseCheck = { readonly items: readonly string[]; readonly failure?: string | undefined };

const FAILURE_EXCERPT = 1500;

const failureAt = async ({ config, git, checks }: Pick<BaseCheckOptions, "config" | "git" | "checks">, sha: string): Promise<string | undefined> =>
	(await inWorktreeAt(git, sha, (folder) => runChecks(checks, folder, { timeoutMs: checksTimeoutMs(config.hum) })))?.slice(0, FAILURE_EXCERPT);

/**
 * Settles the base checks that cover merged items: each merge not yet checked counts as checked, and a failure is a
 * break of each. A break is saved, a follow-up fix item is filed, and the owner's level for the change says whether
 * its paths are blocked until that item merges; the fix limit counts it beside the breaks git shows. A report can only
 * add breaks: an item with no unchecked merge is passed over.
 */
export const settleBaseCheck = async ({ state, config, workSource, git, base, now }: Omit<BaseCheckOptions, "item" | "remote" | "checks">, { items, failure }: BaseCheck): Promise<void> => {
	for (const item of items) {
		const merge = state.merges.get(item);

		if (!merge || merge.baseChecked) continue;

		if (failure !== undefined) {
			const { placement } = await placementOf({ config, state, git, base, now }, { paths: merge.paths, size: 0, loosened: false, pinChanged: false });
			const followUp = await workSource.fileFollowUp(ItemId.parse(item), { title: `Fix the checks that fail on ${base} after ${item} merged`, body: `Kind: fix\n\nThe repo's checks fail on ${base} after ${merge.sha}, the commit that merged ${item}.\n\n\`\`\`\n${failure}\n\`\`\`` });

			state.breaks.put(item, { item, sha: merge.sha, at: now(), paths: merge.paths, level: placement.level.name, failure, onBreak: placement.level.onBreak, followUp: followUp.id });
		}

		state.merges.put(item, { ...merge, baseChecked: true });
	}
};

/** Whether the owner's config has the base checked after merges: the break check is on and there are checks to run. */
const checksBase = ({ config, checks }: Pick<BaseCheckOptions, "config" | "checks">): boolean => config.hum.breakCheck && checks.length > 0;

/** After an item merged, the repo's checks run on the base at the merged commit, and their result is settled. */
export const checkBaseAfterMerge = async (o: BaseCheckOptions): Promise<void> => {
	const merge = o.state.merges.get(o.item);

	if (!checksBase(o) || !merge) return;

	await o.git.raw(["fetch", "-q", o.remote, o.base]);
	await settleBaseCheck(o, { items: [o.item], failure: await failureAt(o, merge.sha) });
};

/** The repo's checks at `at`, a commit of the base, for every merge no check has covered yet; undefined when none waits or the break check is off. */
export const checkMergesAt = async (o: Pick<BaseCheckOptions, "state" | "config" | "git" | "checks">, at: string): Promise<BaseCheck | undefined> => {
	const items = o.state.merges.list().flatMap(({ item, baseChecked }) => (baseChecked ? [] : [item]));

	if (!checksBase(o) || items.length === 0) return undefined;

	return { items, failure: await failureAt(o, at) };
};
