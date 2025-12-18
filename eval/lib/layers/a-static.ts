import { Glob } from "bun";
import { parse } from "yaml";
import { z } from "zod";
import type { LayerAResult, StaticError, TestCase } from "../types";

// Zod schema for skill frontmatter
const FrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).max(1024),
  version: z.string().optional(),
});

// Extract frontmatter from markdown file
function extractFrontmatter(content: string): unknown {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return parse(match[1]);
}

// Validate a single skill file
async function validateSkill(skillPath: string): Promise<StaticError[]> {
  const errors: StaticError[] = [];

  try {
    const content = await Bun.file(skillPath).text();
    const frontmatter = extractFrontmatter(content);

    if (!frontmatter) {
      errors.push({
        file: skillPath,
        type: "frontmatter",
        message: "No frontmatter found",
      });
      return errors;
    }

    const result = FrontmatterSchema.safeParse(frontmatter);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          file: skillPath,
          type: "frontmatter",
          message: `${issue.path.join(".")}: ${issue.message}`,
        });
      }
    }
  } catch (e) {
    errors.push({
      file: skillPath,
      type: "syntax",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return errors;
}

// Run Layer A: Static validation for a plugin
export async function runLayerA(testCase: TestCase): Promise<LayerAResult> {
  const errors: StaticError[] = [];
  const pattern = `${testCase.plugin}/skills/*/SKILL.md`;
  const glob = new Glob(pattern);

  for await (const file of glob.scan({ cwd: "." })) {
    const skillErrors = await validateSkill(file);
    errors.push(...skillErrors);
  }

  return {
    layer: "A",
    passed: errors.length === 0,
    errors,
  };
}
