import type { TestCase, TestResult, EvalConfig, LayerResult } from "./types";
import { DEFAULT_CONFIG } from "./config";
import { runLayerA } from "./layers/a-static";
import { runLayerC } from "./layers/c-trigger";
import { runLayerD } from "./layers/d-quality";

// Run all layers for a test case
export async function runTest(
  testCase: TestCase,
  config: EvalConfig = DEFAULT_CONFIG,
): Promise<TestResult> {
  const layerResults: LayerResult[] = [];

  // Layer A: Static validation
  const layerA = await runLayerA(testCase);
  layerResults.push(layerA);
  if (!layerA.passed) {
    return {
      name: testCase.name,
      plugin: testCase.plugin,
      passed: false,
      layerResults,
      failedAt: "A",
    };
  }

  // Layer C: Skill triggering (Layer B removed - if C works, plugin loaded)
  const layerC = await runLayerC(testCase, config);
  layerResults.push(layerC);
  if (!layerC.passed) {
    return {
      name: testCase.name,
      plugin: testCase.plugin,
      passed: false,
      layerResults,
      failedAt: "C",
    };
  }

  // Layer D: Quality evaluation (advisory)
  const layerD = await runLayerD(testCase, config);
  if (layerD) {
    layerResults.push(layerD);
  }

  return {
    name: testCase.name,
    plugin: testCase.plugin,
    passed: true,
    layerResults,
    advisory: layerD || undefined,
  };
}
