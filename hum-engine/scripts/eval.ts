import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { AgentDecisionExhaustedError } from "@statelyai/agent";
import PQueue from "p-queue";
import { z } from "zod";
import { type Finished, type Runner, startRunner } from "../src/adapters/claude-p.ts";
import { gitIn, readGitIdentity } from "../src/adapters/git.ts";
import { modelCallOver } from "../src/adapters/model-call.ts";
import { BOUNDARIES, type Boundary } from "../src/config/schema.ts";
import { alignmentQuestion, doesRaiseLevel } from "../src/decide/alignment.ts";
import { replyQuestion } from "../src/decide/answer.ts";
import { kindQuestion } from "../src/decide/kind.ts";
import { tasteQuestion } from "../src/decide/taste.ts";
import { pairQuestion } from "../src/loop/pair.ts";
import type { ReviewNote } from "../src/loop/records.ts";
import { pairing, prepare } from "../src/loop/signals.ts";
import type { JsonSchema, ProsePurpose } from "../src/decide/prose.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { shippedRaw, shippedSettingsAs } from "../src/setup/shipped.ts";
import { openState } from "../src/state/open.ts";
import { decideProse } from "../src/worker/prose-run.ts";
import { PROSE_PROMPTS } from "../src/worker/thin-path.ts";
import { SECOND_MS } from "../src/time.ts";
import { rateOf } from "../src/measure/rate.ts";

/**
 * Measures one model-judgment boundary on its labelled cases, through the same prompts and fences the engine runs,
 * and adds a row to its RESULTS.md. `bun run eval -- --model <id>` measures every boundary on that model id; naming
 * boundaries measures only those. A case the runner held or limited counts in no rate. `--runs <n>` repeats each
 * boundary and pools the runs, since one run proves little; `--write <folder>` records each pooled rate under
 * `measuredModels` in that folder's `hum.json`, which is how setup measures an owner's own models. A boundary where
 * nothing was measured records no rate, and the script exits non-zero.
 */

const { values, positionals } = parseArgs({ allowPositionals: true, options: { model: { type: "string" }, limit: { type: "string" }, runs: { type: "string" }, write: { type: "string" } } });
/** Boundaries whose labelled cases only the owner can give; they are measured when named, from the cases the owner puts in their evals folder. */
const OWNER_LABELLED: readonly Boundary[] = ["taste"];

const boundaries: readonly Boundary[] = positionals.length > 0 ? z.array(z.enum(BOUNDARIES)).parse(positionals) : BOUNDARIES.filter((boundary) => !OWNER_LABELLED.includes(boundary));
const root = join(import.meta.dir, "..");
const settings = shippedSettingsAs(await readGitIdentity(gitIn(process.cwd(), { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS })));

if (!settings.ok) {
	console.error(settings.refusal.message);
	process.exit(1);
}

const config = { hum: settings.value, roles: shippedRaw().roles };
const model = values.model ?? config.hum.decisionModel;
const Count = z.coerce.number().int().positive();
const runs = values.runs === undefined ? 1 : Count.parse(values.runs);
const limit = values.limit === undefined ? Number.POSITIVE_INFINITY : Count.parse(values.limit);

type Verdict = "right" | "wrong" | "abstained" | "halted";

const state = openState(mkdtempSync(join(tmpdir(), "hum-eval-")), { now: Date.now });
const started = await startRunner({ state, model, now: Date.now, env: process.env });

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
const PairCase = z.object({ case: z.string(), label: z.enum(["same", "different"]), a: z.object({ text: z.string() }), b: z.object({ text: z.string() }) });
const TasteCase = z.object({ case: z.string(), label: z.enum(["keeps", "breaks"]), rule: z.string(), diff: z.string() });

/** Calls at once: enough to finish a set in minutes, few enough not to trip a rate limit. */
const AT_ONCE = 4;

const eachOf = <T, R>(cases: readonly T[], measure: (found: T) => Promise<R>): Promise<R[]> => new PQueue({ concurrency: AT_ONCE }).addAll(cases.map((found) => () => measure(found)));

const read = async <T>(boundary: Boundary, schema: z.ZodType<T>, file = "cases.jsonl"): Promise<T[]> =>
	(await Bun.file(join(root, "evals", boundary, file)).text())
		.split("\n")
		.filter(Boolean)
		.map((line) => schema.parse(JSON.parse(line)));

/** The confusion counts of the review-note boundary: its rate is precision, and recall is recorded beside it. */
type PairCounts = { readonly tp: number; readonly fp: number; readonly fn: number; readonly tn: number; readonly pairedBySignals: number };

type Cell = Exclude<keyof PairCounts, "pairedBySignals">;

const NO_PAIRS: PairCounts = { tp: 0, fp: 0, fn: 0, tn: 0, pairedBySignals: 0 };

const addPairs = (a: PairCounts, b: PairCounts): PairCounts => ({ tp: a.tp + b.tp, fp: a.fp + b.fp, fn: a.fn + b.fn, tn: a.tn + b.tn, pairedBySignals: a.pairedBySignals + b.pairedBySignals });

/** One run of a boundary: each case's verdict, and for the review-note boundary its confusion counts. */
type Measured = { readonly verdicts: readonly Verdict[]; readonly pairs?: PairCounts };

const noteOf = (text: string, sourceId: string): ReviewNote => ({ source: "review-comment", sourceId, change: sourceId, hunk: "", text, at: 0 });

const BOUNDARY_RUNS: Record<Boundary, () => Promise<Measured>> = {
	kind: async () => {
		const cases = (await read("kind", KindCase)).slice(0, limit);

		return {
			verdicts: await eachOf(cases, async (found) => {
				const judged = await judge(kindQuestion(found, config.hum));

				return judged.kind === "abstained" ? "abstained" : scored(judged.value.kind, found.label);
			}),
		};
	},
	alignment: async () => {
		const sample = (await read("alignment", AlignmentCase, "sample.jsonl")).slice(0, limit);

		return {
			verdicts: await eachOf(sample, async (found): Promise<Verdict> => {
				const judged = await judge(alignmentQuestion({ title: found.subject, body: "" }, found.diff, config.hum));

				if (judged.kind === "abstained") return "abstained";

				return doesRaiseLevel({ rank: 0, levels: config.hum.levels.length, answer: judged.value, config: config.hum }) === (found.label !== "clean") ? "right" : "wrong";
			}),
		};
	},
	"plan-outcome": async () => {
		const repo = planRepo();
		const cases = (await read("plan-outcome", PlanCase)).slice(0, limit);

		return { verdicts: await eachOf(cases, async (found) => scored(await prosePick("plan", PROSE_PROMPTS.plan(config, { id: found.case, title: found.body.split("\n")[0] ?? "", body: found.body }), "", repo), found.label)) };
	},
	"reply-option": async () => {
		const cases = (await read("reply-option", ReplyCase)).slice(0, limit);

		return {
			verdicts: await eachOf(cases, async (found) => {
				const judged = await judge(replyQuestion({ question: found.question, options: found.options, reply: found.reply }));

				return judged.kind === "abstained" ? "abstained" : scored(judged.value.option, found.label);
			}),
		};
	},
	"repeat-pair": async () => {
		const cases = (await read("repeat-pair", PairCase)).slice(0, limit);
		const open = cases.filter((found) => pairing(prepare(noteOf(found.a.text, "a")), prepare(noteOf(found.b.text, "b"))).signal === undefined);

		const judged = await eachOf(open, async (found): Promise<{ verdict: Verdict; cell?: Cell }> => {
			const pair = await judge(pairQuestion(noteOf(found.a.text, "a"), noteOf(found.b.text, "b")));

			if (pair.kind === "abstained") return { verdict: "abstained" };

			const said = pair.value.same;
			const truth = found.label === "same";

			return { verdict: said === truth ? "right" : "wrong", cell: said ? (truth ? "tp" : "fp") : truth ? "fn" : "tn" };
		});

		const countOf = (cell: Cell) => judged.filter((found) => found.cell === cell).length;

		return {
			verdicts: judged.map(({ verdict }) => verdict),
			pairs: { tp: countOf("tp"), fp: countOf("fp"), fn: countOf("fn"), tn: countOf("tn"), pairedBySignals: cases.length - open.length },
		};
	},
	taste: async () => {
		const cases = (await read("taste", TasteCase)).slice(0, limit);

		return {
			verdicts: await eachOf(cases, async (found) => {
				const judged = await judge(tasteQuestion(found.rule, found.diff, config.hum));

				return judged.kind === "abstained" ? "abstained" : scored(judged.value.keeps ? "keeps" : "breaks", found.label);
			}),
		};
	},
	"review-verdict": async () => {
		const cases = (await read("review-verdict", ReviewCase)).slice(0, limit);

		return { verdicts: await eachOf(cases, async (found) => scored(await prosePick("review", PROSE_PROMPTS.review(config, { id: found.case, title: found.item, body: "" }, found.diff), found.diff, tmpdir()), found.label)) };
	},
};

const header = "| Date | Model id | n | Right | Wrong | Abstained | Rate | Live calls |\n|---|---|---|---|---|---|---|---|\n";

const pairHeader = "| Date | Model id | n | TP | FP | FN | TN | Abstained | Paired by signals | Precision | Recall | Live calls |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";

/** A rate as a RESULTS.md cell; a dash where nothing was measured. */
const rateCell = (rate: number | undefined): string => rate?.toFixed(2) ?? "-";

const precisionOf = ({ tp, fp }: PairCounts): number | undefined => rateOf(tp, tp + fp);

const pairRow = (day: string, pairs: PairCounts, abstained: number, used: number): string =>
	`| ${day} | ${model} | ${pairs.tp + pairs.fp + pairs.fn + pairs.tn} | ${pairs.tp} | ${pairs.fp} | ${pairs.fn} | ${pairs.tn} | ${abstained} | ${pairs.pairedBySignals} | ${rateCell(precisionOf(pairs))} | ${rateCell(rateOf(pairs.tp, pairs.tp + pairs.fn))} | ${used} |`;

/** Sets one pooled rate in the owner's `hum.json`, where trust reads it. */
const recordRate = async (folder: string, boundary: Boundary, rate: number): Promise<void> => {
	const file = join(folder, "hum.json");
	const written = z.looseObject({ measuredModels: z.record(z.string(), z.record(z.string(), z.number())).default({}) }).parse(JSON.parse(await Bun.file(file).text()));

	await Bun.write(file, `${JSON.stringify({ ...written, measuredModels: { ...written.measuredModels, [boundary]: { ...written.measuredModels[boundary], [model]: Number(rate.toFixed(2)) } } }, null, "\t")}\n`);
};

const unmeasured: Boundary[] = [];

for (const boundary of boundaries) {
	const pool = { right: 0, measured: 0, pairs: NO_PAIRS };

	for (let run = 1; run <= runs; run++) {
		const before = calls;
		const { verdicts, pairs = NO_PAIRS } = await BOUNDARY_RUNS[boundary]();
		const count = (verdict: Verdict) => verdicts.filter((found) => found === verdict).length;
		const measured = verdicts.length - count("halted");
		const day = new Date().toISOString().slice(0, 10);
		const row = boundary === "repeat-pair" ? pairRow(day, pairs, count("abstained"), calls - before) : `| ${day} | ${model} | ${measured} | ${count("right")} | ${count("wrong")} | ${count("abstained")} | ${rateCell(rateOf(count("right"), measured))} | ${calls - before} |`;
		const results = join(values.write ?? root, "evals", boundary, "RESULTS.md");
		const earlier = (await Bun.file(results).exists()) ? await Bun.file(results).text() : boundary === "repeat-pair" ? pairHeader : header;

		pool.right += count("right");
		pool.measured += measured;
		pool.pairs = addPairs(pool.pairs, pairs);
		await Bun.write(results, `${earlier}${row}\n`);
		console.log(`${boundary}: ${row}`);
	}

	const pooled = boundary === "repeat-pair" ? precisionOf(pool.pairs) : rateOf(pool.right, pool.measured);

	console.log(`${boundary}: pooled over ${runs} run(s): ${rateCell(pooled)}`);

	if (pooled === undefined) unmeasured.push(boundary);
	else if (values.write !== undefined) await recordRate(values.write, boundary, pooled);
}

if (unmeasured.length > 0) {
	console.error(`Nothing was measured on ${unmeasured.join(", ")}, so no rate was recorded for ${unmeasured.length === 1 ? "it" : "them"}.`);
	process.exitCode = 1;
}

console.log(`${calls} live calls, the start check included. Record each rate under measuredModels in defaults/hum.json; a model decides a boundary alone only at minJudgeRate or above; repeat-pair takes its precision, against repeatPrecision.`);
