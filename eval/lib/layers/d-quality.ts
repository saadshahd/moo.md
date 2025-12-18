import type {
  LayerDResult,
  TestCase,
  EvalConfig,
  Result,
  QualityEval,
} from "../types";
import { CLIOutputSchema, QualityEvalSchema, Ok, Err } from "../types";
import { DEFAULT_CONFIG, QUALITY_RUBRIC } from "../config";
import {
  spawnWithTimeout,
  buildClaudeArgs,
  buildSimpleClaudeArgs,
} from "../process";
import { safeJsonParse, extractAndValidate } from "../parse";

type Phase =
  | { type: "skip"; reason: string }
  | { type: "phase1"; expectation: "asks_questions" | "acts_directly" }
  | { type: "phase2"; behaviors: string[] };

const detectPhase = (testCase: TestCase): Phase => {
  const hasPhase1 = testCase.phase === "1" && testCase.expectation;
  const hasPhase2 =
    testCase.expectedBehaviors && testCase.expectedBehaviors.length > 0;

  if (!hasPhase1 && !hasPhase2) {
    return { type: "skip", reason: "No phase/expectations defined" };
  }

  if (hasPhase1) {
    return { type: "phase1", expectation: testCase.expectation! };
  }

  return { type: "phase2", behaviors: testCase.expectedBehaviors! };
};

const evaluatePhase1 = (
  response: string,
  expectation: "asks_questions" | "acts_directly",
): { passed: boolean; hasQuestions: boolean } => {
  const hasQuestions = /\?/.test(response);
  const expected = expectation === "asks_questions";
  return { passed: hasQuestions === expected, hasQuestions };
};

const buildEvalPrompt = (response: string, behaviors: string[]): string => `
${QUALITY_RUBRIC}

## Claude's Output to Evaluate:
${response}

## Expected Behaviors (from test case):
${behaviors.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Evaluate now:
`;

const failureResult = (reason: string): LayerDResult => ({
  layer: "D",
  advisory: true,
  scores: { intent: 0, confidence: 0, process: 0, value: 0 },
  verdict: "FAIL",
  reasoning: reason,
});

const phase1Result = (
  passed: boolean,
  hasQuestions: boolean,
): LayerDResult => ({
  layer: "D",
  advisory: true,
  scores: {
    intent: passed ? 2 : 0,
    confidence: 0,
    process: 0,
    value: 0,
  },
  verdict: passed ? "PASS" : "FAIL",
  reasoning: hasQuestions
    ? "Response contains questions"
    : "Response does not contain questions",
});

const successResult = (eval_: QualityEval): LayerDResult => ({
  layer: "D",
  advisory: true,
  scores: eval_.scores,
  verdict: eval_.verdict,
  reasoning: eval_.reasoning,
});

async function getClaudeResponse(
  testCase: TestCase,
  config: EvalConfig,
): Promise<Result<string, string>> {
  const args = buildClaudeArgs(testCase.prompt, testCase.plugin, config.model);
  const result = await spawnWithTimeout(args, config.timeout);

  if (!result.ok) return Err(result.error);
  if (result.value.exitCode !== 0) {
    return Err(`Exit code: ${result.value.exitCode}`);
  }

  const cliResult = safeJsonParse(result.value.stdout, CLIOutputSchema);
  if (!cliResult.ok) return cliResult;

  return Ok(cliResult.value.result);
}

async function runQualityEval(
  response: string,
  behaviors: string[],
  config: EvalConfig,
): Promise<Result<QualityEval, string>> {
  const prompt = buildEvalPrompt(response, behaviors);
  const args = buildSimpleClaudeArgs(prompt);
  const result = await spawnWithTimeout(args, config.timeout);

  if (!result.ok) return Err(result.error);
  if (result.value.exitCode !== 0) {
    return Err(`Exit code: ${result.value.exitCode}`);
  }

  const cliResult = safeJsonParse(result.value.stdout, CLIOutputSchema);
  if (!cliResult.ok) return cliResult;

  return extractAndValidate(cliResult.value.result, QualityEvalSchema);
}

export async function runLayerD(
  testCase: TestCase,
  config: EvalConfig = DEFAULT_CONFIG,
): Promise<LayerDResult | null> {
  const phase = detectPhase(testCase);

  if (phase.type === "skip" || config.skipLayerD) {
    return null;
  }

  const response = await getClaudeResponse(testCase, config);
  if (!response.ok) {
    return failureResult(response.error);
  }

  if (phase.type === "phase1") {
    const { passed, hasQuestions } = evaluatePhase1(
      response.value,
      phase.expectation,
    );
    return phase1Result(passed, hasQuestions);
  }

  const evalResult = await runQualityEval(
    response.value,
    phase.behaviors,
    config,
  );
  if (!evalResult.ok) {
    return failureResult(evalResult.error);
  }

  return successResult(evalResult.value);
}
