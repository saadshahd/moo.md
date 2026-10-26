// A plan is design-level: the types it adds or changes, the signatures, the files it touches.
// A check decides that, never the agent: a plan missing any section is refused before it is posted.

export const PLAN_PATH = ".factory/plan.md";
export const HANDOFF_PATH = ".factory/handoff.md";

const SECTIONS = ["Types", "Signatures", "Files"] as const;

/** The text under each `## <name>` heading, keyed by name. */
function sections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let name: string | null = null;
  let lines: string[] = [];

  const close = () => {
    if (name !== null) out.set(name, lines.join("\n").trim());
  };

  for (const line of text.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);

    if (m) {
      close();
      name = m[1]!;
      lines = [];
    } else lines.push(line);
  }

  close();

  return out;
}

/** The required sections the plan lacks or leaves empty, in order; empty when it passes. */
export function planGaps(text: string): string[] {
  const s = sections(text);
  const gaps: string[] = SECTIONS.filter((n) => !s.get(n));

  if (!gaps.includes("Files") && planFiles(text).length === 0)
    gaps.push("Files (no `- path` lines)");

  return gaps;
}

/** The paths the plan's Files section lists, one `- path` per line, a trailing note after ` — ` dropped. */
export function planFiles(text: string): string[] {
  return (sections(text).get("Files") ?? "")
    .split("\n")
    .map((l) => /^\s*[-*]\s+`?([^`\s]+)`?/.exec(l)?.[1])
    .filter((p): p is string => p !== undefined);
}

/** The paths both lists name. */
export function overlap(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(b);

  return [...new Set(a)].filter((p) => set.has(p));
}
