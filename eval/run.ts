import { Glob } from "bun";
import { parse } from "yaml";
import pLimit from "p-limit";
import { runTest } from "./lib/runner";
import { validateTestCase } from "./cases/schema";
import { CONCURRENCY } from "./lib/config";
import type {
  TestCase,
  TestResult,
  LayerAResult,
  LayerCResult,
} from "./lib/types";

async function discoverTests(): Promise<TestCase[]> {
  const cases: TestCase[] = [];
  const glob = new Glob("*/eval/cases/*.yaml");

  for await (const file of glob.scan({ cwd: "." })) {
    const content = await Bun.file(file).text();
    const rawCase = parse(content);
    const testCase = validateTestCase(rawCase);
    cases.push(testCase);
  }

  return cases;
}

async function ensureResultsDir(): Promise<void> {
  const fs = await import("fs/promises");
  try {
    await fs.mkdir("eval/results", { recursive: true });
  } catch {
    // Directory exists
  }
}

const formatTestResult = (result: TestResult): string[] => {
  const lines: string[] = [];
  const elapsed = result.elapsed ? ` (${result.elapsed.toFixed(2)}s)` : "";

  lines.push(`\n=== ${result.name}${elapsed} ===`);

  if (result.passed) {
    lines.push("✓ PASS");
  } else {
    lines.push(`✗ FAIL at Layer ${result.failedAt}`);

    for (const layer of result.layerResults) {
      if (layer.layer === "A" && !layer.passed) {
        const layerA = layer as LayerAResult;
        lines.push("\n  Layer A Errors:");
        for (const err of layerA.errors) {
          lines.push(`    ${err.file}: ${err.message}`);
        }
      }
      if (layer.layer === "C") {
        const layerC = layer as LayerCResult;
        if (layerC.duration) {
          lines.push(`  [C] ${layerC.duration.toFixed(2)}s`);
        }
        if (!layerC.passed) {
          lines.push(
            `  Layer C: Expected '${layerC.expected}', detected '${layerC.detected}'`,
          );
          if (layerC.error) {
            lines.push(`    Error: ${layerC.error}`);
          }
        }
      }
    }
  }

  if (result.advisory) {
    lines.push("\n  Advisory (Layer D):");
    lines.push(`    Intent: ${result.advisory.scores.intent}/2`);
    lines.push(`    Confidence: ${result.advisory.scores.confidence}/2`);
    lines.push(`    Process: ${result.advisory.scores.process}/2`);
    lines.push(`    Value: ${result.advisory.scores.value}/2`);
    lines.push(`    Verdict: ${result.advisory.verdict}`);
  }

  return lines;
};

const printLines = (lines: string[]): void => {
  lines.forEach((line) => console.log(line));
};

const printTestResult = (result: TestResult): void =>
  printLines(formatTestResult(result));

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const deepMode = args.includes("--deep");
  const fullMode = args.includes("--full") || deepMode;
  const skipLayerD = !fullMode;
  const modelIndex = args.indexOf("--model");
  const model =
    modelIndex !== -1 ? args[modelIndex + 1] : deepMode ? undefined : "haiku";
  const filterPlugin = args.find(
    (a) =>
      !a.startsWith("--") &&
      (modelIndex === -1 || args.indexOf(a) !== modelIndex + 1),
  );

  const mode = deepMode ? "deep" : fullMode ? "full" : "quick";
  const timeout =
    mode === "quick"
      ? CONCURRENCY.QUICK_TIMEOUT_MS
      : CONCURRENCY.DEFAULT_TIMEOUT_MS;
  console.log(`moo Plugin Evaluation (${mode} mode)`);
  if (model) {
    console.log(`Model: ${model}`);
  }
  console.log();

  const allCases = await discoverTests();
  const cases = filterPlugin
    ? allCases.filter((c) => c.plugin === filterPlugin)
    : allCases;

  if (cases.length === 0) {
    console.log("No test cases found.");
    if (filterPlugin) {
      console.log(`Looked for: ${filterPlugin}/eval/cases/*.yaml`);
    }
    process.exit(0);
  }

  const pluginCount = new Set(cases.map((c) => c.plugin)).size;
  console.log(
    `Found ${cases.length} test case(s) across ${pluginCount} plugin(s)\n`,
  );

  const totalStart = performance.now();

  const limit = pLimit(CONCURRENCY.MAX_PARALLEL);
  console.log(
    `Running ${cases.length} tests (max ${CONCURRENCY.MAX_PARALLEL} concurrent)...`,
  );

  const results = (await Promise.all(
    cases.map((test) =>
      limit(async () => {
        const start = performance.now();
        const result = await runTest(test, {
          timeout,
          skipLayerD,
          model,
        });
        result.elapsed = (performance.now() - start) / 1000;
        return result;
      }),
    ),
  )) as TestResult[];

  const totalElapsed = (performance.now() - totalStart) / 1000;

  console.log("\n" + "━".repeat(50));
  let failed = 0;

  for (const result of results) {
    printTestResult(result);
    if (!result.passed) {
      failed++;
    }
  }

  await ensureResultsDir();
  const resultFile = `eval/results/run-${Date.now()}.json`;
  await Bun.write(resultFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultFile}`);

  console.log("\n" + "━".repeat(50));
  console.log(
    `Total: ${results.length} | Passed: ${results.length - failed} | Failed: ${failed} | Time: ${totalElapsed.toFixed(2)}s`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
