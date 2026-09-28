// Once a hope move has run, the session's first edit waits until the card quotes the user's goal
// and done-check in the user's own words. Asking is never held; the user's "go" opens it.

/** The user's own words for what they want and how they will tell it worked. */
export type Said = { goal?: string; done?: string };

export const SLOTS: Record<keyof Said, string> = {
  goal: "what they want",
  done: "how they will tell it worked",
};

// The moves that settle what the user wants; a run of one arms the gate.
export const MOVES = new Set([
  "hope:intent",
  "hope:shape",
  "hope:clarify",
  "hope:elicit",
  "hope:explain",
  "hope:interrogate",
]);

export const EDITS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

type Msg = { role: string; text: string; toolResults?: { text: string }[] };

// Two prefixes from one host version: multi-question answers take the second.
const ANSWERED = /^(?:Your questions have been answered|The user answered):/;
// An agent's return arrives as a user message; its words are the agent's.
const AGENT = /<task-notification>|<agent-message /;

/** What the user typed or picked: their messages, and their answers to AskUserQuestion. */
export function userWords(msgs: Msg[]): string[] {
  return msgs.flatMap((m) => [
    ...(m.role === "user" && m.text.trim() && !AGENT.test(m.text) ? [m.text] : []),
    ...(m.toolResults ?? []).map((r) => r.text).filter((t) => ANSWERED.test(t)),
  ]);
}

// Case, quote marks, spacing and closing punctuation differ between a quote and its source.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/["'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "");

/** The slots whose quote is missing or appears in none of the user's words. */
export function unquoted(
  said: Said | undefined,
  words: string[],
): (keyof Said)[] {
  const heard = words.map(norm);
  return (Object.keys(SLOTS) as (keyof Said)[]).filter((k) => {
    const q = norm(said?.[k] ?? "");
    return !q || !heard.some((w) => w.includes(q));
  });
}

/** What the model reads when its edit is held. */
export function heldReason(missing: (keyof Said)[]): string {
  const what = missing.map((k) => `${k} (${SLOTS[k]})`).join(" and ");
  return `Held: the card has no ${what} in the user's own words. Ask the user, then write a \`\`\`card block whose "said" copies their words exactly, {"said":{"goal":"…","done":"…"}}, before editing again. The user can also say "go" to start without them.`;
}

/** A prompt that tells the session to start as it stands. */
export const saysGo = (text: string) => /^\s*go\b/i.test(text);
