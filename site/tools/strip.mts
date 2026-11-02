// Claude Code draws the "[ view <file> ]" links that do not fit their row as
// a strip down the right edge, over the rows below (compose). The site leaves
// that layout glitch out, so the checks take it out of a capture too: the
// strip starts under a row of view links, far right.

const pure = (r = "") => /^ +\S+$/.test(r);

/** The strip's first column in a capture's rows, if it has one: where the
 * row under a row of view links holds nothing but strip text. */
export function stripAt(rows: string[], cols: number): number | undefined {
  const k = rows.findIndex((r, i) => r.startsWith("  [ view ") && pure(rows[i + 1]));
  const at = k < 0 ? -1 : rows[k + 1].search(/\S/);
  return at >= cols / 2 ? at : undefined;
}

/** The rows with each strip and the links the recording cut taken out. A
 * strip runs from its row of view links (or the top, when that row has
 * scrolled off and `top` names the column) down to the first two rows that
 * reach no further than its column. A row past that column is marked
 * "\0<column>": `same` reads it only up to there. */
export function unstrip(rows: string[], cols: number, top?: number): string[] {
  const out = [...rows];
  let at = top;
  for (let k = 0; k < out.length; k++) {
    const r = out[k];
    if (r.startsWith("  [ view ") && pure(out[k + 1])) {
      at = stripAt(out.slice(k, k + 2), cols);
      if (at) out[k] = r.replace(/ \[( view( \S*)?)?$/, "");
      continue;
    }
    if (!at) continue;
    if (r.length > at) out[k] = `${r}\0${at}`;
    else if (r.length <= at && (out[k + 1] ?? "").length <= at) at = undefined;
  }
  return out;
}

/** A row of ours against a capture's row: equal, or equal up to the strip's
 * column where `unstrip` marked the capture's row. */
export function same(ours: string, rec: string): boolean {
  const cut = rec.indexOf("\0");
  if (cut < 0) return ours === rec;
  const at = +rec.slice(cut + 1);
  return ours.slice(0, at).trimEnd() === rec.slice(0, Math.min(cut, at)).trimEnd();
}
