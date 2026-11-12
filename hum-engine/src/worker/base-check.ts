import type { WorkSource } from "../adapter-api.ts";
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
	/** The owner's checkout; the merged commit is fetched into it. */
	readonly git: Git;
	readonly remote: string;
	readonly base: string;
	readonly checks: readonly string[];
	readonly now: () => number;
	readonly item: string;
};

const FAILURE_EXCERPT = 1500;

/**
 * After an item merged, the repo's checks run on the base at the merged commit. A failure there is a break: it is
 * saved, a follow-up fix item is filed, and the owner's level for the change says whether its paths are blocked until
 * that item merges. The fix limit counts the break beside the breaks git shows.
 */
export const checkBaseAfterMerge = async ({ state, config, workSource, git, remote, base, checks, now, item }: BaseCheckOptions): Promise<void> => {
	const merge = state.merges.get(item);

	if (!config.hum.breakCheck || checks.length === 0 || !merge) return;

	await git.raw(["fetch", "-q", remote, base]);

	const failure = await inWorktreeAt(git, merge.sha, (folder) => runChecks(checks, folder, { timeoutMs: checksTimeoutMs(config.hum) }));

	if (failure === undefined) return;

	const { placement } = await placementOf({ config, state, git, base, now }, { paths: merge.paths, size: 0, loosened: false, pinChanged: false });
	const followUp = await workSource.fileFollowUp(item, { title: `Fix the checks that fail on ${base} after ${item} merged`, body: `Kind: fix\n\nThe repo's checks fail on ${base} at ${merge.sha}, the commit that merged ${item}.\n\n\`\`\`\n${failure.slice(0, FAILURE_EXCERPT)}\n\`\`\`` });

	state.breaks.put(item, { item, sha: merge.sha, at: now(), paths: merge.paths, level: placement.level.name, failure: failure.slice(0, FAILURE_EXCERPT), onBreak: placement.level.onBreak, followUp: followUp.id });
};

