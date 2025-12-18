import type { LayerDResult, TestCase, EvalConfig } from "../types";
import { DEFAULT_CONFIG, QUALITY_RUBRIC } from "../config";

// Run Layer D: Quality evaluation (advisory - does not gate CI)
export async function runLayerD(
  testCase: TestCase,
  config: EvalConfig = DEFAULT_CONFIG,
): Promise<LayerDResult | null> {
  // Skip if no phase/expectations defined
  const hasPhase1 = testCase.phase === "1" && testCase.expectation;
  const hasPhase2 =
    testCase.expectedBehaviors && testCase.expectedBehaviors.length > 0;

  if (!hasPhase1 && !hasPhase2) {
    return null;
  }

  if (config.skipLayerD) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    // First, run the actual prompt to get Claude's response
    const promptProc = Bun.spawn(
      [
        "claude",
        "-p",
        testCase.prompt,
        "--plugin-dir",
        `./${testCase.plugin}`,
        "--output-format",
        "json",
      ],
      {
        signal: controller.signal,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    await promptProc.exited;
    const promptOutput = await new Response(promptProc.stdout).text();
    const promptJson = JSON.parse(promptOutput);
    const claudeResponse = promptJson.result;

    // Phase 1: Simple check - does response contain questions?
    // No extra LLM call needed
    if (testCase.phase === "1") {
      const hasQuestions = /\?/.test(claudeResponse);
      const expected = testCase.expectation === "asks_questions";
      const passed = hasQuestions === expected;

      clearTimeout(timeoutId);
      return {
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
      };
    }

    // Phase 2: Full quality rubric evaluation (requires LLM call)
    const evalPrompt = `
${QUALITY_RUBRIC}

## Claude's Output to Evaluate:
${claudeResponse}

## Expected Behaviors (from test case):
${testCase.expectedBehaviors?.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Evaluate now:
`;

    const evalProc = Bun.spawn(
      ["claude", "-p", evalPrompt, "--output-format", "json"],
      {
        signal: controller.signal,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    await evalProc.exited;
    clearTimeout(timeoutId);

    const evalOutput = await new Response(evalProc.stdout).text();
    const evalJson = JSON.parse(evalOutput);

    // Parse the evaluation result
    const evalResult = evalJson.result;
    const jsonMatch = evalResult.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        layer: "D",
        advisory: true,
        scores: { intent: 0, confidence: 0, process: 0, value: 0 },
        verdict: "FAIL",
        reasoning: "Could not parse evaluation result",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      layer: "D",
      advisory: true,
      scores: parsed.scores,
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
    };
  } catch (e) {
    clearTimeout(timeoutId);

    return {
      layer: "D",
      advisory: true,
      scores: { intent: 0, confidence: 0, process: 0, value: 0 },
      verdict: "FAIL",
      reasoning: e instanceof Error ? e.message : String(e),
    };
  }
}
