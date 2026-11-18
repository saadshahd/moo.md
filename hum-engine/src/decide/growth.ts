import { changedBytes, type FileBytes, type Git } from "../adapters/git.ts";
import type { HumConfig } from "../config/schema.ts";

type GrowthLabel = HumConfig["growthLabels"][number];

const doesMatchAny = (globs: readonly string[], path: string): boolean => globs.some((glob) => new Bun.Glob(glob).match(path));

const doesGuard = ({ paths, except }: GrowthLabel, path: string): boolean => doesMatchAny(paths, path) && !doesMatchAny(except, path);

/** The bytes the files `rule` guards gain across `files`; below 0 where they lose more than they gain. */
const growthOf = (rule: GrowthLabel, files: readonly FileBytes[]): number => files.reduce((sum, { path, before, after }) => (doesGuard(rule, path) ? sum + after - before : sum), 0);

/** The labels a change from where `head` left `base` up to `head` needs: each rule's whose files it grows. No git runs without a rule. */
export const growthLabelsOf = async (git: Git, range: { readonly base: string; readonly head: string }, rules: HumConfig["growthLabels"]): Promise<string[]> => {
	if (rules.length === 0) return [];

	const files = await changedBytes(git, range);

	return [...new Set(rules.filter((rule) => growthOf(rule, files) > 0).map(({ label }) => label))];
};
