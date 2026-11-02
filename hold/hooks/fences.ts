/** A reply cut at its Mermaid fences: prose, a closed diagram's source, or one still being written. */
export type Segment =
  { md: string } | { mermaid: string } | { writing: string };

// A fence opens at a line's start: one quoted (`> ```mermaid`) or indented under a list item is
// prose, drawn as the reply draws it.
const CLOSED = /(?<=^|\n)```mermaid[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*(?=\n|$)/g;
const OPEN = /(?<=^|\n)```mermaid[^\S\n]*(?:\n([\s\S]*))?$/;

/** `text` in order; a fence with no closing line yet is `writing`, so a half diagram never draws. */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;

  const prose = (md: string) => {
    if (md.trim()) out.push({ md: md.replace(/^\n+|\n+$/g, "") });
  };

  for (const m of text.matchAll(CLOSED)) {
    prose(text.slice(at, m.index));
    out.push({ mermaid: m[1]! });
    at = m.index + m[0].length;
  }
  const rest = text.slice(at);
  const open = OPEN.exec(rest);

  if (open) {
    prose(rest.slice(0, open.index));
    out.push({ writing: open[1] ?? "" });
  } else prose(rest);

  return out;
}

/** Whether `text` holds a Mermaid fence, closed or not. */
export const hasMermaid = (text: string) => /(?<=^|\n)```mermaid/.test(text);

/** The line a diagram is known by where its picture is not drawn: its first, e.g. `flowchart LR`. */
export function altOf(source: string): string {
  const first =
    source
      .split("\n")
      .find((l) => l.trim() && !l.trim().startsWith("%%"))
      ?.trim() ?? "";

  return `Mermaid diagram: ${first.slice(0, 60)}`;
}
