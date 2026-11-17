import { expect, test } from "bun:test";
import { judgeHash, staleScores } from "../src/measure/judges.ts";
import { configWith, trustedScores, type Tree } from "./fixtures/config.ts";

const REVIEW_ROLE = "roles/review.md";

const withReviewRole = (raw: Tree): void => void (raw.roles[REVIEW_ROLE] = `${raw.roles[REVIEW_ROLE]}\nCite each line you judge.`);

test("a judge's hash follows the text it reads: the review role moves the review judge alone, the kind meanings the kind judge alone, the checks no judge", () => {
	const shipped = configWith();
	const hashes = (config: typeof shipped) => Object.fromEntries((["kind", "plan-outcome", "review-verdict", "alignment"] as const).map((boundary) => [boundary, judgeHash(boundary, config)]));
	const before = hashes(shipped);

	expect(hashes(configWith(withReviewRole))).toEqual({ ...before, "review-verdict": expect.not.stringMatching(before["review-verdict"]!) });
	expect(hashes(configWith((raw) => void (raw.hum.kindMeanings.docs = "Words only.")))).toEqual({ ...before, kind: expect.not.stringMatching(before.kind!) });
	expect(hashes(configWith((raw) => void (raw.hum.checks = ["bun test"])))).toEqual(before);
});

test("a score is stale where its judge changed or kept no hash, for each model hum runs, at the boundaries hum ships sets for", () => {
	const config = configWith((raw) => {
		withReviewRole(raw);
		raw.hum.measuredModels.kind[raw.hum.decisionModel] = { rate: 0.9 };
		raw.hum.measuredModels.taste[raw.hum.decisionModel] = { rate: 0.9 };
	});

	const { light, standard, top } = config.hum.models;

	expect(staleScores(configWith())).toEqual([]);
	expect(staleScores(config).map(({ boundary, model }) => `${boundary} ${model}`)).toEqual([`kind ${light}`, ...[light, standard, top].map((model) => `review-verdict ${model}`)]);
	expect(staleScores(configWith((raw) => (withReviewRole(raw), (raw.hum.measuredModels = trustedScores(raw)))))).toEqual([]);
});
