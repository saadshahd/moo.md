import { PATCH } from "../adapters/git.ts";
import type { Pull, PullRequests } from "../adapters/pull-requests.ts";
import { isTrusted } from "../decide/prose.ts";
import { type TasteResult, tasteComment, tasteQuestion } from "../decide/taste.ts";
import type { LandContext } from "./land.ts";

/**
 * Comments on the pull request whether its diff keeps each of the owner's taste rules, once per head. The comment
 * reports only: no result reaches the placement, the route or the merge.
 */
export const reportTaste = async (ctx: LandContext, pulls: PullRequests, pull: Pull, head: string): Promise<void> => {
	const { rules, ...bar } = { rules: ctx.config.hum.tasteRules, measuredModels: ctx.config.hum.measuredModels, minJudgeRate: ctx.config.hum.minJudgeRate };

	if (rules.length === 0) return;

	await ctx.state.ops.once(
		{ itemId: ctx.id, run: "merge", attempt: 0, op: `taste:${head}` },
		{
			holds: async () => false,
			run: async () => {
				const diff = await ctx.git.raw(["diff", ...PATCH, `origin/${ctx.base}...${head}`]);
				const verdicts = await Promise.all(rules.map(async (rule) => ({ rule, judged: await ctx.judge({ ...tasteQuestion(rule, diff, ctx.config.hum), item: ctx.id }) })));
				const results: TasteResult[] = verdicts.map(({ rule, judged }) => ({ rule, answer: judged.kind === "picked" ? judged.value : { abstained: judged.why } }));
				const models = new Set(verdicts.flatMap(({ judged }) => (judged.kind === "picked" ? judged.models : [])));

				await pulls.comment(pull, tasteComment(results, isTrusted([...models], "taste", bar)));
			},
		},
	);
};
