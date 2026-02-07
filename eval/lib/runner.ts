import type {
  TestCase,
  TestResult,
  EvalConfig,
  LayerResult,
  LayerCResult,
} from "./types";
import { DEFAULT_CONFIG } from "./config";
import { runLayerA } from "./layers/a-static";
import { runLayerC } from "./layers/c-trigger";
import { runLayerD } from "./layers/d-quality";

const FLAKY_MAX_RETRIES = 5;
const FLAKY_CONCURRENT = 2;

async function runLayerCWithRetry(
  testCase: TestCase,
  config: EvalConfig,
): Promise<{ result: LayerCResult; attempts: number }> {
  const isHaiku = config.model === "haiku";
  if (!testCase.flaky || !isHaiku) {
    const result = await runLayerC(testCase, config);
    return { result, attempts: 1 };
  }

  let totalAttempts = 0;

  for (
    let round = 0;
    round < Math.ceil(FLAKY_MAX_RETRIES / FLAKY_CONCURRENT);
    round++
  ) {
    const remaining = FLAKY_MAX_RETRIES - totalAttempts;
    const batchSize = Math.min(FLAKY_CONCURRENT, remaining);
    if (batchSize <= 0) break;

    const attempts = Array.from({ length: batchSize }, () =>
      runLayerC(testCase, config),
    );

    const results = await Promise.all(attempts);
    totalAttempts += batchSize;

    const passed = results.find((r) => r.passed);
    if (passed) {
      return { result: passed, attempts: totalAttempts };
    }

    if (totalAttempts >= FLAKY_MAX_RETRIES) {
      return { result: results[results.length - 1], attempts: totalAttempts };
    }
  }

  const finalResult = await runLayerC(testCase, config);
  return { result: finalResult, attempts: totalAttempts + 1 };
}

export async function runTest(
  testCase: TestCase,
  config: EvalConfig = DEFAULT_CONFIG,
): Promise<TestResult> {
  const layerResults: LayerResult[] = [];

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

  const { result: layerC, attempts } = await runLayerCWithRetry(
    testCase,
    config,
  );
  layerResults.push(layerC);
  const isHaiku = config.model === "haiku";
  const showFlakyAttempts = testCase.flaky && isHaiku && attempts > 1;

  if (!layerC.passed) {
    return {
      name: testCase.name,
      plugin: testCase.plugin,
      passed: false,
      layerResults,
      failedAt: "C",
      flakyAttempts: showFlakyAttempts ? attempts : undefined,
    };
  }

  const layerD = await runLayerD(testCase, config);
  if (layerD) {
    layerResults.push(layerD);
  }

  const layerDFailed =
    layerD && !config.skipLayerD && layerD.verdict === "FAIL";

  return {
    name: testCase.name,
    plugin: testCase.plugin,
    passed: !layerDFailed,
    layerResults,
    failedAt: layerDFailed ? "D" : undefined,
    advisory: layerD || undefined,
    flakyAttempts: showFlakyAttempts ? attempts : undefined,
  };
}
