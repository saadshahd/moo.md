import type { LayerCResult, TestCase, EvalConfig } from "../types";
import { DEFAULT_CONFIG, DETECT_SKILL_PROMPT } from "../config";

// Run Layer C: Skill triggering validation (direct query)
export async function runLayerC(
  testCase: TestCase,
  config: EvalConfig = DEFAULT_CONFIG,
): Promise<LayerCResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const spawnStart = performance.now();

    // Build command args
    const args = [
      "claude",
      "-p",
      DETECT_SKILL_PROMPT(testCase.prompt),
      "--plugin-dir",
      `./${testCase.plugin}`,
      "--output-format",
      "json",
    ];

    // Add model flag if specified
    if (config.model) {
      args.push("--model", config.model);
    }

    const proc = Bun.spawn(args, {
      signal: controller.signal,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const apiDuration = ((performance.now() - spawnStart) / 1000).toFixed(2);
    console.log(`  [C] ${testCase.name}: API call took ${apiDuration}s`);
    clearTimeout(timeoutId);

    if (exitCode !== 0) {
      return {
        layer: "C",
        passed: false,
        expected: testCase.skill,
        detected: null,
      };
    }

    const output = await new Response(proc.stdout).text();

    // Parse CLI wrapper JSON
    const cliOutput = JSON.parse(output);

    // Parse inner result JSON
    const skillResult = JSON.parse(cliOutput.result);
    const detectedSkill = skillResult.skill;

    // Compare detected skill with expected
    const passed = detectedSkill === testCase.skill;

    return {
      layer: "C",
      passed,
      expected: testCase.skill,
      detected: detectedSkill,
    };
  } catch (e) {
    clearTimeout(timeoutId);

    return {
      layer: "C",
      passed: false,
      expected: testCase.skill,
      detected: null,
    };
  }
}
