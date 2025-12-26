import { z } from "zod";

// Test case schema with Zod validation
export const TestCaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  plugin: z.string().min(1),
  skill: z.string().min(1),
  acceptableSkills: z.array(z.string()).optional(), // Alternative skills that are also valid
  prompt: z.string().min(1),
  phase: z.enum(["1", "2"]).optional(), // Phase 1 = test questioning, Phase 2 = test output
  expectation: z.enum(["asks_questions", "acts_directly"]).optional(), // For phase 1
  expectedBehaviors: z.array(z.string()).optional(), // For phase 2
});

export type TestCase = z.infer<typeof TestCaseSchema>;

export function validateTestCase(data: unknown): TestCase {
  return TestCaseSchema.parse(data);
}
