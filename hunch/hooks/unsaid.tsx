import type { Register, SessionMessage } from "claude-code";
import { update } from "claude-code";
import type { Unsaid } from "../unsaid.d.ts";
import { addQuestions, headless, loud, type Question } from "./tend.tsx";

/* intent writes its work order in a fenced `order` block, each line starting with its kind. Each line
 * that states the user's ask or its bar is checked against the user's own words, and one they never
 * said becomes a question in tend's questions chip. Nothing waits on the user and nothing wakes Claude. */

/** Which kinds of line are checked: the ask and its bar state what the user wants; a limit, and a
 * line the order itself marks as an assumption, are the order's own. */
export const CHECKED = {
  ask: true,
  bar: true,
  not: false,
  assumption: false,
} as const;
export type Kind = keyof typeof CHECKED;
export type Line = { kind: Kind; text: string };
/** A work order: its block as written, its lines, and the rows of the block that name no kind. */
export type Order = { block: string; lines: Line[]; unread: string[] };

// An order opens at a line's start: one quoted inside a reply is text, not an order.
const ORDER_RE = /(?<=^|\n)```order[^\S\n]*\n([\s\S]*?)\n```/g;
const ROW_RE = new RegExp(`^(${Object.keys(CHECKED).join("|")}):\\s*(\\S.*)$`);

/** One row of an order block as a line, or undefined when it names no kind. */
function readRow(row: string): Line | undefined {
  const [, kind, text] = row.match(ROW_RE) ?? [];
  return kind && text ? { kind: kind as Kind, text } : undefined;
}

/** A reply's work order: its last order block, since a restated order replaces the one before. */
export function lastOrder(answer: string): Order | undefined {
  const block = [...answer.matchAll(ORDER_RE)].at(-1)?.[1];
  if (block === undefined) return undefined;
  const rows = block
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  const read = rows.map(readRow);
  return {
    block,
    lines: read.filter((l) => l !== undefined),
    unread: rows.filter((_, i) => !read[i]),
  };
}

/** Rows a session keeps as the user's that the user never typed: a task's notice, a peer's message,
 * a command's output, an interrupt. */
const NOT_TYPED =
  /^(?:<(?:task-notification|cross-session-message|teammate-message|local-command-stdout|local-command-caveat|bash-stdout|bash-stderr)\b|\[Request interrupted)/;
// What a slash command's row keeps of what the user typed.
const COMMAND_RE =
  /<command-name>([^<]*)<\/command-name>[\s\S]*?<command-args>([\s\S]*?)<\/command-args>/;
const REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

/** What a row of the user's holds that they typed: a slash command with its arguments, or their prompt. */
function typed(text: string): string[] {
  const row = text.replace(REMINDER_RE, "").trim();
  const [, command, args = ""] = row.match(COMMAND_RE) ?? [];
  if (command !== undefined)
    return args.trim() ? [`${command} ${args.trim()}`] : [];
  return row && !NOT_TYPED.test(row) ? [row] : [];
}

/** The user's own words, oldest first: what they typed, and their answers to Claude's questions. */
export function userWords(messages: readonly SessionMessage[]): string[] {
  return messages.flatMap((m) =>
    m.role === "user"
      ? typed(m.text)
      : m.toolUses.flatMap((u) =>
          u.tool === "AskUserQuestion" && u.text ? [u.text] : [],
        ),
  );
}

export const LABELS = ["said", "assumed"] as const;
/** The model the label was measured on; a change of model is a new measurement. */
export const LABEL_MODEL = "haiku";
export type Label = (typeof LABELS)[number];
/** How much of the user's words, newest kept, one check reads: a long session's would outgrow the call. */
export const WORDS_KEPT = 40_000;

/** What the model reads to label one line: the user's words, the line, and what each label means. */
export function labelText(words: readonly string[], line: string): string {
  const said = words.map((w) => `<words>\n${w}\n</words>`).join("\n");
  return `The user's own words in this session, oldest first:
${said.slice(-WORDS_KEPT)}

A line an agent wrote into the user's work order:
<line>${line}</line>

said: the user's words ask for, or pick, everything this line requires.
assumed: the line requires something the user's words never asked for or picked.`;
}

/** One line's label, or undefined when the model named no label. */
export async function label(
  $: any,
  words: readonly string[],
  line: string,
): Promise<Label | undefined> {
  return (await $.model.classify(labelText(words, line), LABELS, {
    model: LABEL_MODEL,
  })) as Label | undefined;
}

/** A session checks at most this many orders: a restated order is checked again, up to here. */
export const MAX_CHECKS = 3;

/** Whether an order is checked: one not checked yet, while fewer than MAX_CHECKS ran. */
export function shouldCheck(
  checked: readonly string[],
  block: string,
): boolean {
  return checked.length < MAX_CHECKS && !checked.includes(block);
}

/** The question a line the user never said becomes. */
export function question(line: Line): Question {
  return {
    q: `You never said "${line.text}". Keep it in the work order?`,
    options: ["keep", "drop"],
  };
}

const UNSAID = { plugin: "hunch", key: "unsaid" } as const;

async function check($: any, order: Order) {
  const lines = order.lines.filter((l) => CHECKED[l.kind]);
  const words = userWords(await $.session.messages());
  const labels = await Promise.all(lines.map((l) => label($, words, l.text)));
  const assumed = lines.filter((_, i) => labels[i] === "assumed");
  if (assumed.length) await addQuestions($, assumed.map(question));
  const unread = order.unread.length + labels.filter((l) => !l).length;
  if (unread)
    throw new Error(
      `${unread} of the work order's lines went unchecked: they named no kind, or got no label`,
    );
}

export const register: Register = (on) => {
  on("turn.complete", { reason: "answer" }, async ($, e, next) => {
    const r = await next(e);
    const order = e.agentId ? undefined : lastOrder(e.answer);
    if (!order || (await headless($))) return r;
    const { value } = await $.state.get(UNSAID);
    const checked = (value as Unsaid | undefined)?.checked ?? [];
    if (!shouldCheck(checked, order.block)) return r;
    await update($, UNSAID, (s: Unsaid | undefined) => ({
      checked: [...(s?.checked ?? []), order.block],
    }));
    loud($, "unsaid", check($, order));
    return r;
  });
};
