import { z } from "zod";

// Test case schema with Zod validation
export const TestCaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  plugin: z.string().min(1),
  skill: z.string().min(1),
  acceptableSkills: z.array(z.string()).optional(),
  prompt: z.string().min(1),
  phase: z.enum(["1", "2"]).optional(),
  expectation: z.enum(["asks_questions", "acts_directly"]).optional(),
  expectedBehaviors: z.array(z.string()).optional(),
  flaky: z.boolean().optional(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

export function validateTestCase(data: unknown): TestCase {
  return TestCaseSchema.parse(data);
}
