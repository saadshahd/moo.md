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

/** Any value JSON.parse returns. */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

const isWhole = (v: Json | undefined, min: number): v is number =>
  Number.isInteger(v) && Number(v) >= min;

const isString = (v: Json): v is string => typeof v === "string";

const isStrings = (v: Json | undefined): v is string[] =>
  Array.isArray(v) && v.every(isString);

const isObject = (v: Json | undefined): v is { [key: string]: Json } =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** The rules `json` sets, or the reasons it can't be read as rules. */
export function parseRules(json: string): Rules | { errors: string[] } {
  let raw: Json;

  try {
    // SAFETY: JSON.parse returns JSON values only, which is all Json describes.
    raw = JSON.parse(json) as Json;
  } catch (e) {
    return { errors: [`${RULES_PATH} is not JSON: ${String(e)}`] };
  }

  const r = isObject(raw) ? raw : {};
  const l = isObject(r.layers) ? r.layers : {};
  const { atOnce, waitsPerDay, contextCap, taste } = r;
  const { check, plan, judge, none } = l;

  const errors = [
    isWhole(atOnce, 1) ? "" : "atOnce must be a whole number of 1 or more",
    isWhole(waitsPerDay, 0) ? "" : "waitsPerDay must be 0 or more",
    isWhole(contextCap, 1) ? "" : "contextCap must be a whole number of 1 or more",
    isStrings(taste) ? "" : "taste must be a list of strings",
    isStrings(check) ? "" : "layers.check must be a list of strings",
    isStrings(plan) ? "" : "layers.plan must be a list of strings",
    isStrings(judge) ? "" : "layers.judge must be a list of strings",
    isStrings(none) ? "" : "layers.none must be a list of strings",
  ].filter((e) => e !== "");

  return isWhole(atOnce, 1) &&
    isWhole(waitsPerDay, 0) &&
    isWhole(contextCap, 1) &&
    isStrings(taste) &&
    isStrings(check) &&
    isStrings(plan) &&
    isStrings(judge) &&
    isStrings(none)
    ? { atOnce, waitsPerDay, contextCap, taste, layers: { check, plan, judge, none } }
    : { errors };
}
