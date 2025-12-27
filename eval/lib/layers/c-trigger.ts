import type { LayerCResult, TestCase, EvalConfig } from "../types";
import { CLIOutputSchema, SkillDetectionSchema } from "../types";
import { DEFAULT_CONFIG, DETECT_SKILL_PROMPT } from "../config";
import { spawnWithTimeout, buildClaudeArgs } from "../process";
import { safeJsonParse, extractAndValidate } from "../parse";

export async function runLayerC(
  testCase: TestCase,
  config: EvalConfig = DEFAULT_CONFIG,
): Promise<LayerCResult> {
  const args = buildClaudeArgs(
    DETECT_SKILL_PROMPT(testCase.prompt),
    testCase.plugin,
    config.model,
  );

  const processResult = await spawnWithTimeout(args, config.timeout);

  if (!processResult.ok) {
    return {
      layer: "C",
      passed: false,
      expected: testCase.skill,
      detected: null,
      error: processResult.error,
    };
  }

  const { value: proc } = processResult;

  if (proc.exitCode !== 0) {
    return {
      layer: "C",
      passed: false,
      expected: testCase.skill,
      detected: null,
      duration: proc.duration,
      error: `Exit code ${proc.exitCode}${proc.stderr ? `: ${proc.stderr.slice(0, 200)}` : ""}`,
    };
  }

  const cliResult = safeJsonParse(proc.stdout, CLIOutputSchema);
  if (!cliResult.ok) {
    return {
      layer: "C",
      passed: false,
      expected: testCase.skill,
      detected: null,
      duration: proc.duration,
      error: `CLI parse: ${cliResult.error}`,
    };
  }

  const skillResult = extractAndValidate(
    cliResult.value.result,
    SkillDetectionSchema,
  );
  if (!skillResult.ok) {
    return {
      layer: "C",
      passed: false,
      expected: testCase.skill,
      detected: null,
      duration: proc.duration,
      error: `Skill parse: ${skillResult.error}`,
    };
  }

  const detected = skillResult.value.skill;
  const acceptable = [testCase.skill, ...(testCase.acceptableSkills ?? [])];
  const passed = detected !== null && acceptable.includes(detected);

  return {
    layer: "C",
    passed,
    expected: testCase.skill,
    detected,
    duration: proc.duration,
  };
}
