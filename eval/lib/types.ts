// Test case schema (validated with Zod in cases/schema.ts)
export interface TestCase {
  name: string;
  description?: string;
  plugin: string;
  skill: string;
  prompt: string;
  phase?: "1" | "2"; // Phase 1 = test questioning, Phase 2 = test output
  expectation?: "asks_questions" | "acts_directly"; // For phase 1
  expectedBehaviors?: string[]; // For phase 2
}

// Layer result types
export interface LayerAResult {
  layer: "A";
  passed: boolean;
  errors: StaticError[];
}

export interface StaticError {
  file: string;
  type: "frontmatter" | "reference" | "syntax";
  message: string;
}

export interface LayerCResult {
  layer: "C";
  passed: boolean;
  expected: string;
  detected: string | null;
}

export interface LayerDResult {
  layer: "D";
  advisory: true;
  scores: {
    intent: number;
    confidence: number;
    process: number;
    value: number;
  };
  verdict: "PASS" | "PARTIAL" | "FAIL";
  reasoning: string;
}

export type LayerResult = LayerAResult | LayerCResult | LayerDResult;

// Full test result
export interface TestResult {
  name: string;
  plugin: string;
  passed: boolean;
  layerResults: LayerResult[];
  failedAt?: "A" | "C" | "D";
  advisory?: LayerDResult;
  elapsed?: number; // Execution time in seconds
}

// Config
export interface EvalConfig {
  timeout: number;
  skipLayerD: boolean;
}

export const DEFAULT_CONFIG: EvalConfig = {
  timeout: 60000,
  skipLayerD: false,
};
