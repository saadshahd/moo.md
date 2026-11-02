import type { EngineInterface } from "claude-code";

export const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** Draws hold's rows again, as their state changed. */
export function redraw($: EngineInterface) {
  $.ui.invalidate("ui.render");
}

const toasted = new Set<string>();

/** Shows `why` once a session, as hooks fail: the event it met passes on unchanged. */
export function failOnce($: EngineInterface, why: string) {
  // A toast is one line: a cause written over several, as pele's parse errors are, is joined.
  const text = `hold: ${why.replace(/\s+/g, " ").trim()}`;

  if (toasted.has(text)) return;
  toasted.add(text);
  $.ui.toast(text);
}
