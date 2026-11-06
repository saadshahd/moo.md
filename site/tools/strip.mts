// What the site leaves out of Claude Code's screen, taken out of a capture
// too, so the checks hold the rest to it (scenes.ts lists each):
// - hold drew "[ view <file> ]" buttons under a tool summary, and Claude Code
//   drew those that did not fit their row as a strip down the right edge,
//   over the rows below (compose). The strip starts under a row of view
//   buttons, far right.
// - A dialog's hints: "Notes: press n to add notes", and from the rule above
//   "Chat about this" down, its key hints with it.

// A row of strip text alone: blank up to its column (stripAt), e.g.
// "f-scroll ]", the end of a link the row above broke (compose).
const pure = (r = "") => /^ +\S/.test(r);

/** The strip's first column in a capture's rows, if it has one: where the
 * row under a row of view links holds nothing but strip text. */
export function stripAt(rows: string[], cols: number): number | undefined {
  const k = rows.findIndex((r, i) => r.startsWith("  [ view ") && pure(rows[i + 1]));
  const at = k < 0 ? -1 : rows[k + 1].search(/\S/);
  return at >= cols / 2 ? at : undefined;
}

/** The rows with each row of view buttons and each strip taken out. A strip
 * runs from its row of view buttons (or the top, when that row has scrolled
 * off and `top` names the column) down to the first two rows that reach no
 * further than its column. A row past that column is marked "\0<column>":
 * `same` reads it only up to there. */
export function unstrip(rows: string[], cols: number, top?: number): string[] {
  const out = [...rows];
  let at = top;
  for (let k = 0; k < out.length; k++) {
    const r = out[k];
    if (r.startsWith("  [ view ") && pure(out[k + 1])) {
      at = stripAt(out.slice(k, k + 2), cols);
      continue;
    }
    if (!at) continue;
    if (r.length > at) out[k] = `${r}\0${at}`;
    else if (r.length <= at && (out[k + 1] ?? "").length <= at) at = undefined;
  }
  return out.filter((r) => !r.startsWith("  [ view "));
}

/** A dialog capture's rows with its hints taken out. */
export function unhinted(rows: string[]): string[] {
  const out = rows.map((r) => r.replace(/ *Notes: press n to add notes$/, ""));
  const chat = out.findLastIndex((r) => /^(❯ |  )(\d+\. )?Chat about this$/.test(r));
  const kept = chat < 1 ? out : out.slice(0, chat - 1);
  while (kept.length && !kept[kept.length - 1]) kept.pop();
  return kept;
}

/** A row of ours against a capture's row: equal, or equal up to the strip's
 * column where `unstrip` marked the capture's row. */
export function same(ours: string, rec: string): boolean {
  const cut = rec.indexOf("\0");
  if (cut < 0) return ours === rec;
  const at = +rec.slice(cut + 1);
  return ours.slice(0, at).trimEnd() === rec.slice(0, Math.min(cut, at)).trimEnd();
}
