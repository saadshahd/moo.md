import { Glob } from "bun";
import { parse } from "yaml";
import pLimit from "p-limit";
import { runTest } from "./lib/runner";
import { validateTestCase } from "./cases/schema";
import type {
  TestCase,
  TestResult,
  LayerAResult,
  LayerCResult,
} from "./lib/types";

const MAX_CONCURRENT = 10;

async function discoverTests(): Promise<TestCase[]> {
  const cases: TestCase[] = [];
  const glob = new Glob("*/eval/cases/*.yaml");

  for await (const file of glob.scan({ cwd: "." })) {
    const content = await Bun.file(file).text();
    const rawCase = parse(content);

    // Validate with Zod
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

function printLayerResult(result: TestResult): void {
  const elapsed = result.elapsed ? ` (${result.elapsed.toFixed(2)}s)` : "";
  console.log(`\n=== ${result.name}${elapsed} ===`);

  if (result.passed) {
    console.log("✓ PASS");
  } else {
    console.log(`✗ FAIL at Layer ${result.failedAt}`);

    // Show layer-specific details
    for (const layer of result.layerResults) {
      if (layer.layer === "A" && !layer.passed) {
        const layerA = layer as LayerAResult;
        console.log("\n  Layer A Errors:");
        for (const err of layerA.errors) {
          console.log(`    ${err.file}: ${err.message}`);
        }
      }
      if (layer.layer === "C" && !layer.passed) {
        const layerC = layer as LayerCResult;
        console.log(
          `\n  Layer C: Expected '${layerC.expected}', detected '${layerC.detected}'`,
        );
      }
    }
  }

  // Show advisory Layer D results
  if (result.advisory) {
    console.log("\n  Advisory (Layer D):");
    console.log(`    Intent: ${result.advisory.scores.intent}/2`);
    console.log(`    Confidence: ${result.advisory.scores.confidence}/2`);
    console.log(`    Process: ${result.advisory.scores.process}/2`);
    console.log(`    Value: ${result.advisory.scores.value}/2`);
    console.log(`    Verdict: ${result.advisory.verdict}`);
  }
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const skipLayerD = args.includes("--skip-layer-d");
  const modelIndex = args.indexOf("--model");
  const model = modelIndex !== -1 ? args[modelIndex + 1] : undefined;
  const filterPlugin = args.find(
    (a) => !a.startsWith("--") && args.indexOf(a) !== modelIndex + 1,
  );

  console.log("moo.md Plugin Evaluation (v3 - optimized)");
  if (model) {
    console.log(`Using model: ${model}`);
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

  // Count unique plugins for info
  const pluginCount = new Set(cases.map((c) => c.plugin)).size;
  console.log(
    `Found ${cases.length} test case(s) across ${pluginCount} plugin(s)\n`,
  );

  const totalStart = performance.now();

  // Run ALL tests in parallel with concurrency limit
  const limit = pLimit(MAX_CONCURRENT);
  console.log(
    `Running ${cases.length} tests (max ${MAX_CONCURRENT} concurrent)...`,
  );

  const results = (await Promise.all(
    cases.map((test) =>
      limit(async () => {
        const start = performance.now();
        const result = await runTest(test, {
          timeout: 60000,
          skipLayerD,
          model,
        });
        result.elapsed = (performance.now() - start) / 1000;
        return result;
      }),
    ),
  )) as TestResult[];

  const totalElapsed = (performance.now() - totalStart) / 1000;

  // Print results
  console.log("\n" + "━".repeat(50));
  let failed = 0;

  for (const result of results) {
    printLayerResult(result);
    if (!result.passed) {
      failed++;
    }
  }

  // Save results
  await ensureResultsDir();
  const resultFile = `eval/results/run-${Date.now()}.json`;
  await Bun.write(resultFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultFile}`);

  // Summary with timing
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
