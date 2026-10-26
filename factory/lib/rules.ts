// The one committed file in the target repo that sets how the factory behaves there.
// `/factory:setup` writes it; the worker and the run hooks read it.

export const RULES_PATH = ".claude/factory.json";

export type Rules = {
  /** How many issues run at once on this machine. */
  atOnce: number;
  /** Asks a day that may wait for the human; past it, the run takes its own pick and posts a call. */
  waitsPerDay: number;
  /** Once a run's context passes this many tokens, it restarts fresh from plan, branch and handoff. */
  contextCap: number;
  /** Where the project's taste lives (its CLAUDE.md, a taste file), repo-relative. */
  taste: string[];
  /** Each taste rule, by the layer that enforces it; `none` lists the rules no layer takes. */
  layers: { check: string[]; plan: string[]; judge: string[]; none: string[] };
};

/** The rules `json` sets, or the reasons it can't be read as rules. */
export function parseRules(json: string): Rules | { errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { errors: [`${RULES_PATH} is not JSON: ${(e as Error).message}`] };
  }
  const r = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const count = (k: string) => {
    const v = r[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1)
      errors.push(`${k} must be a whole number of 1 or more`);
  };
  const strings = (v: unknown, k: string) => {
    if (!Array.isArray(v) || v.some((s) => typeof s !== "string"))
      errors.push(`${k} must be a list of strings`);
  };
  count("atOnce");
  if (typeof r.waitsPerDay !== "number" || r.waitsPerDay < 0)
    errors.push("waitsPerDay must be 0 or more");
  count("contextCap");
  strings(r.taste, "taste");
  const layers = (r.layers ?? {}) as Record<string, unknown>;
  for (const k of ["check", "plan", "judge", "none"])
    strings(layers[k], `layers.${k}`);
  return errors.length > 0 ? { errors } : (raw as Rules);
}
