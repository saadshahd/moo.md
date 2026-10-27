/**
 * A plan is design-level: the types it adds or changes, the signatures, the files it touches.
 * A check decides that, never the agent: a plan missing any section is refused before it is posted.
 */

import { lf } from "./formats.ts";
import type { OpenPr } from "./snapshot.ts";

export const PLAN_PATH = ".factory/plan.md";
export const HANDOFF_PATH = ".factory/handoff.md";

const SECTIONS = ["Types", "Signatures", "Files"] as const;

/** A plan as sealed and posted: line endings a browser edit may add are gone, ends trimmed. */
export const planText = (text: string) => lf(text).trim();

function sections(text: string): Map<string, string> {
  return new Map(
    planText(text)
      .split(/^##\s+/m)
      .slice(1)
      .map((s): [string, string] => {
        const at = s.indexOf("\n");

        return at < 0
          ? [s.trim(), ""]
          : [s.slice(0, at).trim(), s.slice(at + 1).trim()];
      }),
  );
}

/** The paths the plan's Files section lists, one `- path` per line, a trailing note after ` — ` dropped. */
export function planFiles(text: string): string[] {
  return (sections(text).get("Files") ?? "")
    .split("\n")
    .flatMap((l) => /^\s*[-*]\s+`?([^`\s]+)`?/.exec(l)?.[1] ?? []);
}

export function planGaps(text: string): string[] {
  const s = sections(text);
  const gaps = SECTIONS.filter((section) => !s.get(section));

  return s.get("Files") && planFiles(text).length === 0
    ? [...gaps, "Files (no `- path` lines)"]
    : gaps;
}

export function overlap(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(b);

  return [...new Set(a)].filter((p) => set.has(p));
}

/** The first open PR off branch `own` that changes any of `files`, and which; a PR too big to list its files changes all. */
export function overlappingPr(
  files: readonly string[],
  open: readonly OpenPr[],
  own: string,
): { pr: number; files: string[] } | null {
  for (const p of open) {
    if (p.head === own) continue;
    const both = p.files === null ? [...files] : overlap(files, p.files);

    if (both.length > 0) return { pr: p.number, files: both };
  }

  return null;
}
