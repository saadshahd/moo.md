import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { AgentDecisionExhaustedError } from "@statelyai/agent";
import PQueue from "p-queue";
import { z } from "zod";
import { type Finished, type Runner, startRunner } from "../src/adapters/claude-p.ts";
import { modelCallOver } from "../src/adapters/model-call.ts";
import { readConfigDir } from "../src/config/load.ts";
import { BOUNDARIES, type Boundary, HumConfig } from "../src/config/schema.ts";
import { alignmentQuestion, raisesLevel } from "../src/decide/alignment.ts";
import { replyQuestion } from "../src/decide/answer.ts";
import { kindQuestion } from "../src/decide/kind.ts";
import type { JsonSchema, ProsePurpose } from "../src/decide/prose.ts";
import { openState } from "../src/state/open.ts";
import { decideProse } from "../src/worker/prose-run.ts";
import { PROSE_PROMPTS } from "../src/worker/thin-path.ts";
import { SECOND_MS } from "../src/time.ts";

/**
 * Measures one model-judgment boundary on its labelled cases, through the same prompts and fences the engine runs,
 * and adds a row to its RESULTS.md. `bun run eval -- --model <id>` measures every boundary on that model id; naming
 * boundaries measures only those. A case the runner held or limited counts in no rate.
 */

const { values, positionals } = parseArgs({ allowPositionals: true, options: { model: { type: "string" }, limit: { type: "string" } } });
const boundaries: readonly Boundary[] = positionals.length > 0 ? z.array(z.enum(BOUNDARIES)).parse(positionals) : BOUNDARIES;
const root = join(import.meta.dir, "..");
const raw = readConfigDir(join(root, "defaults"));
const config = { hum: HumConfig.parse(raw.hum), roles: raw.roles };
const model = values.model ?? config.hum.decisionModel;
const limit = values.limit === undefined ? Number.POSITIVE_INFINITY : Number(values.limit);

type Verdict = "right" | "wrong" | "abstained" | "halted";

const state = openState(mkdtempSync(join(tmpdir(), "hum-eval-")));
const started = await startRunner({ state, model });

if (started.check.kind !== "finished") throw new Error(`the start check ended as ${started.check.kind}`);

let calls = 1;
const runner: Runner = { ...started.runner, run: (request) => (calls++, started.runner.run(request)) };
const judge = modelCallOver(runner, { model, timeoutMs: config.hum.modelCallTimeoutSeconds * SECOND_MS, trusts: () => true });

/** A run that ended without an answer: a limit or a hold. It says nothing about the boundary. */
class Halted extends Error {}

const answerRun = (cwd: string) => async (prompt: string, schema: JsonSchema): Promise<Finished> => {
	const outcome = await runner.run({ prompt, cwd, model, effort: "low", schema });

	if (outcome.kind !== "finished") throw new Halted(outcome.kind);

	return outcome;
};

/** The pick a plan or review run settles on, as the machine would take it. */
const prosePick = async (purpose: ProsePurpose, prompt: string, diff: string, cwd: string): Promise<string | Verdict> => {
	try {
		return (await decideProse({ purpose, prompt, diff, model, run: answerRun(cwd) })).pick.event;
	} catch (error) {
		if (error instanceof Halted) return "halted";

		if (error instanceof AgentDecisionExhaustedError) return "abstained";

		throw error;
	}
};

const scored = (picked: string | Verdict, label: string): Verdict => (picked === "halted" || picked === "abstained" ? picked : picked === label ? "right" : "wrong");

/** A small repo the plan cases name, so a plan run has files to read. */
const planRepo = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "hum-eval-repo-"));
	const files = {
		"package.json": '{ "name": "acme", "version": "1.4.0", "bin": { "acme": "src/cli.ts" } }\n',
		"README.md": "# acme\n\nThe CLI will recieve a file and print it.\n\n| Plan | Price |\n|---|---|\n| Pro | $10 |\n",
		"src/cli.ts": 'import { fmtDate } from "./dates.ts";\n\nconsole.log("\\u001b[32macme\\u001b[0m", fmtDate(new Date()));\n',
		"src/dates.ts": "export const fmtDate = (date: Date): string => date.toISOString().slice(0, 10);\n",
		"src/limits.ts": "export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));\n",
	};

	for (const [file, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}

	return dir;
};

const KindCase = z.object({ case: z.string(), label: z.string(), title: z.string(), body: z.string() });
const AlignmentCase = z.object({ case: z.string(), label: z.enum(["reverted", "fixed", "clean"]), subject: z.string(), diff: z.string() });
const PlanCase = z.object({ case: z.string(), label: z.string(), body: z.string() });
const ReplyCase = z.object({ case: z.string(), label: z.string(), question: z.string(), options: z.array(z.string()), reply: z.string() });
const ReviewCase = z.object({ case: z.string(), label: z.string(), item: z.string(), diff: z.string() });

/** Calls at once: enough to finish a set in minutes, few enough not to trip a rate limit. */
const AT_ONCE = 4;

const eachOf = <T>(cases: readonly T[], measure: (found: T) => Promise<Verdict>): Promise<Verdict[]> => new PQueue({ concurrency: AT_ONCE }).addAll(cases.map((found) => () => measure(found)));

const read = async <T>(boundary: Boundary, schema: z.ZodType<T>, file = "cases.jsonl"): Promise<T[]> =>
	(await Bun.file(join(root, "evals", boundary, file)).text())
		.split("\n")
		.filter(Boolean)
		.map((line) => schema.parse(JSON.parse(line)));

const BOUNDARY_RUNS: Record<Boundary, () => Promise<Verdict[]>> = {
	kind: async () => {
		const cases = (await read("kind", KindCase)).slice(0, limit);

		return eachOf(cases, async (found) => {
				const judged = await judge(kindQuestion(found, config.hum));

				return judged.kind === "abstained" ? "abstained" : scored(judged.value.kind, found.label);
		});
	},
	alignment: async () => {
		const sample = (await read("alignment", AlignmentCase, "sample.jsonl")).slice(0, limit);

		return eachOf(sample, async (found) => {
				const judged = await judge(alignmentQuestion({ title: found.subject, body: "" }, found.diff, config.hum));

				if (judged.kind === "abstained") return "abstained";

				return raisesLevel(0, config.hum.levels.length, judged.value, config.hum) === (found.label !== "clean") ? "right" : "wrong";
		});
	},
	"plan-outcome": async () => {
		const repo = planRepo();
		const cases = (await read("plan-outcome", PlanCase)).slice(0, limit);

		return eachOf(cases, async (found) => scored(await prosePick("plan", PROSE_PROMPTS.plan(config, { id: found.case, title: found.body.split("\n")[0] ?? "", body: found.body }), "", repo), found.label));
	},
	"reply-option": async () => {
		const cases = (await read("reply-option", ReplyCase)).slice(0, limit);

		return eachOf(cases, async (found) => {
			const judged = await judge(replyQuestion(found.question, found.options, found.reply));

			return judged.kind === "abstained" ? "abstained" : scored(judged.value.option, found.label);
		});
	},
	"review-verdict": async () => {
		const cases = (await read("review-verdict", ReviewCase)).slice(0, limit);

		return eachOf(cases, async (found) => scored(await prosePick("review", PROSE_PROMPTS.review(config, { id: found.case, title: found.item, body: "" }, found.diff), found.diff, tmpdir()), found.label));
	},
};

const header = "| Date | Model id | n | Right | Wrong | Abstained | Rate | Live calls |\n|---|---|---|---|---|---|---|---|\n";

for (const boundary of boundaries) {
	const before = calls;
	const verdicts = await BOUNDARY_RUNS[boundary]();
	const count = (verdict: Verdict) => verdicts.filter((found) => found === verdict).length;
	const measured = verdicts.length - count("halted");
	const rate = measured === 0 ? 0 : count("right") / measured;
	const row = `| ${new Date().toISOString().slice(0, 10)} | ${model} | ${measured} | ${count("right")} | ${count("wrong")} | ${count("abstained")} | ${rate.toFixed(2)} | ${calls - before} |`;
	const results = join(root, "evals", boundary, "RESULTS.md");
	const earlier = (await Bun.file(results).exists()) ? await Bun.file(results).text() : header;

	await Bun.write(results, `${earlier}${row}\n`);
	console.log(`${boundary}: ${row}`);
}

console.log(`${calls} live calls, the start check included. Record each rate under measuredModels in defaults/hum.json; a model decides a boundary alone only at minJudgeRate or above.`);
