import type { Register, SessionMessage } from "claude-code";
import { update } from "claude-code";
import type { Unsaid } from "../unsaid.d.ts";
import { addQuestions, headless, loud, type Question } from "./tend.tsx";

/* intent writes each line of its work order under a bold label: `**Ask:**`, `**Bar:**`, `**Not:**`,
 * `**Assumed:**`. Each Ask and Bar line is checked against the user's own words, silently: one they
 * never said becomes a question in tend's questions chip, the one thing the user sees, and Claude reads
 * it only with the user's answer. Nothing waits on the user and nothing wakes Claude. */

/** Each kind of work-order line: the label it starts with, and whether it is checked. The ask and its
 * bar state what the user wants; a limit, and a line the order itself marks assumed, are its own. */
export const KINDS = {
  ask: { label: "Ask", checked: true },
  bar: { label: "Bar", checked: true },
  not: { label: "Not", checked: false },
  assumed: { label: "Assumed", checked: false },
} as const;
export type Kind = keyof typeof KINDS;
export type Line = { kind: Kind; text: string };
/** A work order: its labelled lines as written, and each line read. */
export type Order = { text: string; lines: Line[] };

const KIND_OF = new Map<string, Kind>(
  Object.entries(KINDS).map(([kind, { label }]) => [label, kind as Kind]),
);
// A label opens its line: one inside a quote (`> **Ask:**`) or a code block is text, not an order.
const LINE_RE = new RegExp(
  `^\\*\\*(${[...KIND_OF.keys()].join("|")}):\\*\\*\\s*(\\S.*)$`,
);
const FENCE_RE = /^\s*```/;

/** One line of a reply as a work-order line, or undefined when no label opens it. */
function readLine(line: string): Line | undefined {
  const [, label, text] = line.match(LINE_RE) ?? [];
  const kind = label && KIND_OF.get(label);
  return kind && text ? { kind, text: text.trim() } : undefined;
}

/** A reply's work order: its last run of labelled lines outside code, blank lines allowed between;
 * a restated order replaces the one before. */
export function lastOrder(answer: string): Order | undefined {
  const runs: { raw: string[]; lines: Line[] }[] = [];
  let fenced = false;
  let open = false;
  for (const raw of answer.split("\n")) {
    if (FENCE_RE.test(raw)) fenced = !fenced;
    const line = fenced ? undefined : readLine(raw);
    if (line) {
      if (!open) runs.push({ raw: [], lines: [] });
      runs.at(-1)!.raw.push(raw.trim());
      runs.at(-1)!.lines.push(line);
      open = true;
    } else if (raw.trim()) open = false;
  }
  const last = runs.at(-1);
  return last && { text: last.raw.join("\n"), lines: last.lines };
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
  order: string,
): boolean {
  return checked.length < MAX_CHECKS && !checked.includes(order);
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
  const lines = order.lines.filter((l) => KINDS[l.kind].checked);
  const words = userWords(await $.session.messages());
  const labels = await Promise.all(lines.map((l) => label($, words, l.text)));
  const assumed = lines.filter((_, i) => labels[i] === "assumed");
  if (assumed.length) await addQuestions($, assumed.map(question));
}

export const register: Register = (on) => {
  on("turn.complete", { reason: "answer" }, async ($, e, next) => {
    const r = await next(e);
    const order = e.agentId ? undefined : lastOrder(e.answer);
    if (!order || (await headless($))) return r;
    const { value } = await $.state.get(UNSAID);
    const checked = (value as Unsaid | undefined)?.checked ?? [];
    if (!shouldCheck(checked, order.text)) return r;
    await update($, UNSAID, (s: Unsaid | undefined) => ({
      checked: [...(s?.checked ?? []), order.text],
    }));
    loud($, "unsaid", check($, order));
    return r;
  });
};
