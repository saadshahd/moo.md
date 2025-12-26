import { z } from "zod";

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const CLIOutputSchema = z.object({
  result: z.string(),
});

export const SkillDetectionSchema = z.object({
  skill: z.string().nullable(),
});

export const QualityEvalSchema = z.object({
  scores: z.object({
    intent: z.number().min(0).max(2),
    confidence: z.number().min(0).max(2),
    process: z.number().min(0).max(2),
    value: z.number().min(0).max(2),
  }),
  verdict: z.enum(["PASS", "PARTIAL", "FAIL"]),
  reasoning: z.string(),
});
export type QualityEval = z.infer<typeof QualityEvalSchema>;

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface TestCase {
  name: string;
  description?: string;
  plugin: string;
  skill: string;
  acceptableSkills?: string[]; // Alternative skills that are also valid
  prompt: string;
  phase?: "1" | "2";
  expectation?: "asks_questions" | "acts_directly";
  expectedBehaviors?: string[];
}

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
  duration?: number;
  error?: string;
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

export interface TestResult {
  name: string;
  plugin: string;
  passed: boolean;
  layerResults: LayerResult[];
  failedAt?: "A" | "C" | "D";
  advisory?: LayerDResult;
  elapsed?: number;
}

export interface EvalConfig {
  timeout: number;
  skipLayerD: boolean;
  model?: string;
}
