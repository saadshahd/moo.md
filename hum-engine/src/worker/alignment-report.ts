import { alignmentComment, doesGateAlignment } from "../decide/alignment.ts";
import type { LandContext, PullAtHead } from "./land.ts";

/**
 * Comments on the pull request what the alignment call made of the change, once per head, while the call's rate is
 * below the bar. Above the bar the call raises levels and needs no report.
 */
export const reportAlignment = async (ctx: LandContext, { pulls, pull, head }: PullAtHead): Promise<void> => {
	const alignment = ctx.state.landings.get(ctx.id)?.alignment;

	if (!alignment || doesGateAlignment(ctx.config.hum)) return;

	await ctx.state.ops.once(
		{ itemId: ctx.id, run: "merge", attempt: 0, op: `alignment:${head}` },
		{ holds: async () => false, run: () => pulls.comment(pull, alignmentComment(alignment, ctx.config.hum)) },
	);
};
