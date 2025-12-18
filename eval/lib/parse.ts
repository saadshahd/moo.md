import { z } from "zod";
import type { Result } from "./types";
import { Ok, Err } from "./types";

export const safeJsonParse = <T>(
  raw: string,
  schema: z.ZodSchema<T>,
): Result<T, string> => {
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success
      ? Ok(result.data)
      : Err(result.error.issues.map((i) => i.message).join(", "));
  } catch (e) {
    return Err(`JSON parse: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const extractJsonFromText = (text: string): Result<unknown, string> => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return Err("No JSON object found in text");
  }
  try {
    return Ok(JSON.parse(match[0]));
  } catch (e) {
    return Err(`JSON parse: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const extractAndValidate = <T>(
  text: string,
  schema: z.ZodSchema<T>,
): Result<T, string> => {
  const extracted = extractJsonFromText(text);
  if (!extracted.ok) {
    return extracted;
  }
  const result = schema.safeParse(extracted.value);
  return result.success
    ? Ok(result.data)
    : Err(result.error.issues.map((i) => i.message).join(", "));
};
