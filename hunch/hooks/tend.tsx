import type { Register } from "claude-code";
import { MEASURE, type Band, type Item } from "./band.tsx";

export type Question = { q: string; options: string[] };
/** One expert's idea to try; `test` pits it against the version that exists; `chosen` is absent
 * where the reply left the pick to the user. */
export type Idea = { by: string; idea: string; why?: string; test?: string; chosen?: boolean };
export type Card = {
  facts?: string[];
  /** What the agent would change and kept to itself, from the complain skill. */
  suggestions?: string[];
  questions?: Question[];
  ideas?: Idea[];
};
type Msg = { role: string; text: string };
// What a card's facts are.
const FACTS =
  "what the user should carry forward — durable, in plain words, no file paths, tool steps or change details";

export const CARD_FORMAT = `End your reply with a \`\`\`card JSON block of what it settled; omit unchanged keys, [] clears a list:
{"facts":["…"],"questions":[{"q":"…","options":["…"]}]}
facts: ${FACTS}; one that settles a choice names what lost. questions: every question still open; the user's next prompt closes them all, so restate any still open.
The user cites items by 1-based position: \`fact 2: …\`, \`q1: <option> — …\`.`;
// Asked of consult, so `/ideas` lists its ideas to pick from.
export const IDEAS_FORMAT = `End your reply with a \`\`\`card JSON block of the ideas:
{"ideas":[{"by":"<expert>","idea":"…","why":"…","test":"…","chosen":true}],"questions":[{"q":"…","options":["…"]}]}
test: only where this idea's win differs from the one the reply names for all. chosen: true for an idea the reply chose, false for one it dropped, absent for one it left to the user. questions: only the picks the reply leaves to the user. The user cites an idea by its 1-based position: \`idea 2: …\`.`;
// The card each skill is asked for.
const CARD_SKILLS = new Map([
  ...[
    "hope:intent",
    "hope:shape",
    "hope:clarify",
    "hope:elicit",
    "hope:draft",
    "hope:compose",
  ].map((k) => [k, CARD_FORMAT] as const),
  ["hope:consult", IDEAS_FORMAT],
]);
// A card opens at a line's start: one quoted inside a reply (`> ```card`) is text, not a card.
const CARD_RE = /(?<=^|\n)```card[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*\n?/g;
const PANE = "tend";

const PAD = 2;
const CHIPS = ["questions", "suggestions"] as const;
// Kept in the card, shown only when asked for.
const ON_DEMAND = ["facts", "ideas"] as const;

// ---- pure ----

// Also hides a block still streaming in, before its closing fence.
export function stripCards(text: string): string {
  return text
    .replace(CARD_RE, "")
    .replace(/(?<=^|\n)```card[\s\S]*$/, "")
    .trimEnd();
}

// A reply with more prose than two 80-column lines is redrawn short; tables and code don't count.
const PROSE_MAX = 160;

/** The reply's prose: what is left once fenced code and table rows are out. */
export function prose(text: string): string {
  return text
    .replace(/(?<=^|\n)```[\s\S]*?(\n```|$)/g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("|"))
    .join("\n")
    .trim();
}

/** A reply to "explain" or "walk me through" is long because the user asked for long. */
export function wantsShort(reply: string, prompt: string): boolean {
  return (
    prose(reply).length > PROSE_MAX &&
    !/\bexplain\b|walk me through/i.test(prompt)
  );
}

// What won the user's blind ranking of real replies: short, but never a fact cut they'd act on.
export function shortAsk(reply: string): string {
  return `Rewrite the reply below, which an agent sent to a user, as the shortest reply that still covers everything it must.
It must cover: every decision it asks of the user, every result the user needs, and its next action.
Derive the rewrite from that coverage, not by deleting sentences. Keep its first-line and last-line order, its tables and its code.
Cut commit hashes, ids and dates unless the user must act on one.
Never pack several facts into one line: give each fact the user would act on its own sentence or row, and keep it rather than cut it.
Hand back the rewritten reply alone.

<reply>
${reply}
</reply>`;
}

/** A short key for a reply's text, so the store holds its short form without the long one. */
export function textKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++)
    h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}.${text.length}`;
}

const str = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";
// An explicit [] stays: it clears an older block's list.
const list = <T,>(v: unknown, keep: (x: any) => x is T): T[] | undefined =>
  Array.isArray(v) ? v.filter(keep) : undefined;

/** The model's JSON, keeping only well-formed parts, so a bad field can't break the band. */
export function cleanCard(c: any): Card {
  const card: Card = {
    facts: list(c.facts, str),
    suggestions: list(c.suggestions, str),
    questions: list(
      c.questions,
      (q): q is Question =>
        str(q?.q) && Array.isArray(q.options) && q.options.every(str),
    ),
    ideas: list(
      c.ideas,
      (d): d is Idea =>
        str(d?.by) &&
        str(d.idea) &&
        (d.why === undefined || str(d.why)) &&
        (d.test === undefined || str(d.test)) &&
        (d.chosen === undefined || typeof d.chosen === "boolean"),
    ),
  };
  for (const k of Object.keys(card) as (keyof Card)[])
    if (card[k] === undefined) delete card[k];
  return card;
}

/** Each key from the newest block that has it: a clarify card keeps consult's ideas.
 * Suggestions add up instead, oldest first: a later one never hides an earlier, and a repeat shows once. */
export function latestCard(msgs: Msg[]): Card {
  const card: Card = {};
  const suggestions: string[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== "assistant") continue;
    for (const b of [...msgs[i].text.matchAll(CARD_RE)].reverse()) {
      let c: unknown;
      try {
        c = JSON.parse(b[1]);
      } catch {
        continue;
      }
      if (!c || typeof c !== "object" || Array.isArray(c)) continue;
      const clean = cleanCard(c);
      suggestions.unshift(...(clean.suggestions ?? []));
      for (const k of Object.keys(clean) as (keyof Card)[])
        if (k !== "suggestions" && !(k in card)) (card as any)[k] = clean[k];
    }
  }
  if (suggestions.length) card.suggestions = [...new Set(suggestions)];
  return card;
}

/** Lines of a reply that ask something, outside code and the card: each ends with `?`,
 * list markers dropped. None already in `known`, none twice. */
export function proseQuestions(text: string, known: string[]): string[] {
  const seen = new Set(known);
  const out: string[] = [];
  let fenced = false;
  for (const raw of stripCards(text).split("\n")) {
    if (raw.trim().startsWith("```")) fenced = !fenced;
    const q = raw.trim().replace(/^(?:[-*+>]\s+|\d+[.)]\s+)+/, "");
    if (fenced || !q.endsWith("?") || seen.has(q)) continue;
    seen.add(q);
    out.push(q);
  }
  return out;
}

/** The prompt with question `n`'s answer set to `pick`: its first `qn: <option>` already in `box`
 * swapped, the rest of the box as it was; undefined when no answer to it is there yet. */
export function swapAnswer(
  box: string,
  n: number,
  options: string[],
  pick: string,
): string | undefined {
  const at = `q${n}: `;
  const found = options
    .map((o) => ({ from: box.indexOf(at + o), len: at.length + o.length }))
    .filter((f) => f.from >= 0)
    // Of two answers at one place, the longer: "yes, later" over "yes".
    .sort((x, y) => x.from - y.from || y.len - x.len)[0];
  return (
    found &&
    box.slice(0, found.from) + at + pick + box.slice(found.from + found.len)
  );
}

/** The questions a turn leaves open: its reply's card's when it lists any, since a card lists every
 * open one; else those already open, then the ones it asked in prose, with no options. */
export function turnQuestions(answer: string, open: Question[]): Question[] {
  const carded = latestCard([{ role: "assistant", text: answer }]).questions;
  if (carded?.length) return carded;
  const asked = carded ?? open;
  return [
    ...asked,
    ...proseQuestions(
      answer,
      asked.map((q) => q.q),
    ).map((q) => ({ q, options: [] })),
  ];
}

/** The card with the questions still open in place of its blocks' own; `undefined` (a session from
 * before open questions were kept) leaves the blocks' own. */
export function withOpen(card: Card, open: Question[] | undefined): Card {
  if (!open) return card;
  const { questions: _, ...rest } = card;
  return open.length ? { ...rest, questions: open } : rest;
}

/** The message a compaction ends on: the whole card, word for word. Undefined for an empty card. */
export function replayCard(card: Card): string | undefined {
  if (!Object.keys(card).length) return undefined;
  return `The session card as it stood before this compaction, word for word:\n\`\`\`card\n${JSON.stringify(card)}\n\`\`\`\n`;
}

/** The command a prompt starts with: `/hope:intent x` gives `hope:intent`; a path like `/a/b.md` gives none. */
export function slashName(text: string): string | undefined {
  return text.match(/^\/([\w:-]+)(?:\s|$)/)?.[1];
}

/** The slash command a planned skill runs by, or undefined when none exists. */
export function commandFor(names: string[], name: string): string | undefined {
  return (
    names.find((n) => n === name) ?? names.find((n) => n.endsWith(`:${name}`))
  );
}

export function bareFact(f: string): string {
  return f.replace(
    /^\s*(?:[\w-]+(?:\s+[\w-]+)?\s+confirmed|found|measured)\s*:\s*/i,
    "",
  );
}

/** A consult reply cut where its colours change: markdown as written, each idea's head, the line
 * saying why it was chosen, and what recedes: the lines under an idea, a dropped idea whole, the shared win. */
export type Segment =
  | { md: string }
  | { head: { lead: string; change: string; rest: string } }
  | { chosen: string }
  | { dim: string };

export function ideaSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let md: string[] = [];
  let inList = false;
  let listed = false;
  const flush = () => {
    if (md.join("\n").trim()) out.push({ md: md.join("\n") });
    md = [];
  };
  const plain = (t: string) => t.replace(/\*\*?|`/g, "");
  for (const l of text.split("\n")) {
    const head = l.match(/^(\d+\.\s.*?)\*\*(.+?)\*\*(.*)$/);
    const droppedHead = !head && /^\d+\.\s.* — /.test(l);
    if (head) {
      flush();
      inList = listed = true;
      out.push({
        head: {
          lead: plain(head[1]),
          change: plain(head[2]),
          rest: plain(head[3]),
        },
      });
    } else if (droppedHead && (inList || !listed)) {
      flush();
      inList = listed = true;
      out.push({ dim: plain(l) });
    } else if (inList && /^\s+Chosen because\b/.test(l)) out.push({ chosen: plain(l) });
    else if (inList && /^\s+\S/.test(l)) out.push({ dim: plain(l) });
    // A blank line between ideas keeps them apart.
    else if (inList && !l.trim()) out.push({ dim: "" });
    // Past the ideas, all but a question recedes: the win, and any note the rules left out.
    else if (listed && l.trim() && !l.trim().endsWith("?")) {
      flush();
      inList = false;
      out.push({ dim: plain(l) });
    } else {
      if (l.trim()) inList = false;
      md.push(l);
    }
  }
  flush();
  return out;
}

const line = (id: string, label: string): Item => ({ id, label, kind: "line" });
const note = (id: string, label: string): Item => ({ id, label, kind: "note" });
const title = (id: string, label: string): Item => ({
  id,
  label,
  kind: "title",
});
const under = (i: Item): Item => ({ ...i, indent: 2 });
const column = (i: Item): Item => ({ ...i, column: true });
// Entries a blank line apart, so each reads as one.
const spaced = (entries: Item[][][]): Item[][] =>
  entries.flatMap((e, i) => (i ? [[], ...e] : e));

/** A text's sentences, a clause after a semicolon counting as one. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=;)\s+/);
}

/** A fact's first sentence, then the rest of it: the claim, then what lost and why. */
export function factParts(f: string): [string, string] {
  const [head, ...rest] = sentences(bareFact(f));
  return [head, rest.join(" ")];
}

/** Facts as bullets a blank line apart: each claim, then what lost and why dim under it. */
function factRows(facts: string[]): Item[][] {
  return spaced(
    facts.map((f, i) => {
      const [head, rest] = factParts(f);
      return [
        [line(`probe:fact ${i + 1}`, `• ${head}`)],
        ...(rest ? [[under(note(`fact-note:${i}`, rest))]] : []),
      ];
    }),
  );
}

/** A chip's label with the one number that previews its card: how many. */
export function chipLabel(name: (typeof CHIPS)[number], card: Card): string {
  return `${name} ${card[name]?.length ?? 0}`;
}

/** A card's lines; each inner list is one row the arrows move along. */
export function cardRows(c: Card, name: string): Item[][] {
  if (name === "facts") return factRows(c.facts ?? []);
  if (name === "suggestions")
    return spaced(
      (c.suggestions ?? []).map((t, i) => [
        [line(`probe:suggestion ${i + 1}`, `• ${t}`)],
      ]),
    );
  if (name === "questions")
    return spaced(
      (c.questions ?? []).map((q, i) => [
        // Only its answers take a click.
        [title(`question:${i}`, `• ${q.q}`)],
        ...q.options.map((o, j) => [under(line(`answer:${i}:${j}`, `◦ ${o}`))]),
      ]),
    );
  if (name === "ideas")
    // The experts' names one column, so the ideas line up to compare; the why and the test sit under.
    // Only the idea is bold: the names and the reasons recede.
    return spaced(
      (c.ideas ?? []).map((d, i) => [
        [
          column(note(`idea-by:${i}`, d.by)),
          { ...line(`probe:idea ${i + 1}`, d.idea), ...(d.chosen !== false && { strong: true as const }) },
        ],
        ...[d.why, d.test && `A/B: ${d.test}`].flatMap((t, k) =>
          t
            ? [
                [
                  column(note(`idea-gap:${i}:${k}`, "")),
                  note(`idea-note:${i}:${k}`, t),
                ],
              ]
            : [],
        ),
      ]),
    );
  return [];
}

/** The band is its chips alone, each with content: every card reads in the pane. */
export function bandModel(card: Card, paneItem: string | null): Band {
  return {
    chips: CHIPS.filter((n) => card[n]?.length).map((n) => ({
      id: `chip:${n}`,
      label: chipLabel(n, card),
      kind: "chip",
      // Client props refuse undefined, so an unmarked chip has no key at all.
      ...(paneItem === `card:${n}` ? { open: true as const } : {}),
    })),
    body: [],
  };
}

// ---- state ----

let card: Card = {};
// The questions still open: a card block holds only those its writer chose, and the user's
// next prompt closes them all, however it answered them.
let open: Question[] | undefined;
let paneItem: string | null = null;
let lastPaneItem: string | null = null;
let started = false;
let sessionId = "";
// Bumped to hand the keys back to the prompt: the Client redraws under a new key.
let fills = 0;
// The stem last put in the box, to swap while it stands bare.
let lastStem = "";
// How much of each Client's typed text has reached the prompt, by the Client's key.
const typedFrom = new Map<string, number>();
// Each long reply's short form, by textKey of the long one; `/long` shows the long ones again.
const short = new Map<string, string>();
let showLong = false;
// The store keeps the latest short forms only: a session's replies would outgrow its share.
const KEPT_SHORT = 40;

// ---- effects ----

async function registerCommands($: any) {
  await $.command.register({
    name: "cards",
    description: "Reopen the pane",
    immediate: true,
  });
  await $.command.register({
    name: "long",
    description: "Show replies at full length, or short again",
    immediate: true,
  });
  for (const name of ON_DEMAND)
    await $.command.register({
      name,
      description: `Show this session's ${name}`,
      immediate: true,
    });
}

// A rewrite that fills its token cap was cut off, and with it the reply's closing ask.
export const SHORT_CAP = 2048;

/** Redraws a long reply short once the turn ends: its long form already showed while it streamed. */
async function shorten($: any, reply: string) {
  const r = await $.model.complete({
    model: "haiku",
    prompt: shortAsk(reply),
    maxTokens: SHORT_CAP,
    timeoutMs: 60_000,
  });
  if (!r.isAnswered) throw new Error(`the short reply failed: ${r.reason}`);
  if (r.usage.output_tokens >= SHORT_CAP)
    throw new Error("the short reply ran out of room, so the reply stays long");
  short.set(textKey(reply), r.text.trim());
  const kept = [...short].slice(-KEPT_SHORT);
  await save($, `tend:${await sid($)}:short`, Object.fromEntries(kept));
  $.ui.invalidate("ui.render");
}

async function readSession($: any) {
  await sid($);
  card = withOpen(latestCard(await $.session.messages()), open);
  $.ui.invalidate("ui.render");
}

/** Runs a detached step; a failure is shown, never swallowed, and never breaks the hook that started it. */
function loud($: any, p: Promise<unknown>) {
  p.catch((err: unknown) =>
    $.ui.toast(`tend: ${err instanceof Error ? err.message : String(err)}`),
  );
}

// What the store kept of the session, back in memory; sid sets it going.
let loaded: Promise<unknown> = Promise.resolve();

/** The session this module now serves. `/clear` and a resume raise no `session.start`, so the
 * id is read at each use; a new one resets what the old session left in memory and loads what
 * the store kept of the new one. */
async function sid($: any): Promise<string> {
  const id: string = await $.session.id();
  if (id !== sessionId) {
    if (sessionId) reset();
    sessionId = id;
    loaded = load($, id).catch((err: unknown) =>
      $.ui.toast(
        `tend: couldn't read this session's band back: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
  await loaded;
  return id;
}

async function load($: any, id: string) {
  if (!(await headless($))) await keepRecent($, id);
  const get = (k: string) => $.store.get(`tend:${id}:${k}`);
  for (const [k, v] of Object.entries(
    ((await get("short")) as Record<string, string>) ?? {},
  ))
    short.set(k, v);
  open = (await get("open")) as Question[] | undefined;
}

/** A `-p` run or the SDK draws nowhere, so nobody sees what it would keep. Hooks spawn many:
 * each one kept would push a live session out of the store. */
async function headless($: any): Promise<boolean> {
  return (await $.session.surfaces()).length === 0;
}

// tend draws from its own memory; the store only carries it past a reload or a resume. A write
// the store refuses (it holds 4 MiB in all) is shown once, and the band goes on without it.
let refused = false;

async function save($: any, key: string, value: unknown) {
  try {
    await $.store.set(key, value);
    refused = false;
  } catch (err) {
    if (!refused)
      $.ui.toast(
        `tend: couldn't save the band, so a reload or resume loses it: ${err instanceof Error ? err.message : String(err)}`,
      );
    refused = true;
  }
}

/** The store's sessions, newest first, with this one moved to the front. */
async function recent($: any, id: string): Promise<string[]> {
  const before =
    ((await $.store.get("tend:recent")) as string[] | undefined) ?? [];
  return [id, ...before.filter((s) => s !== id)];
}

// The store holds 4 MiB in all. A session starting keeps the newest sessions that fit in 3,
// itself whatever its size: the last MiB is its room to grow.
const KEPT_BYTES = 3 * 2 ** 20;

async function keepRecent($: any, id: string) {
  const order = await recent($, id);
  const keys = ((await $.store.keys()) as string[]).filter(
    (k) => k.startsWith("tend:") && k !== "tend:recent",
  );
  const values = await Promise.all(keys.map((k) => $.store.get(k)));
  const bytes = new Map<string, number>();
  keys.forEach((k, i) => {
    const s = k.split(":")[1];
    bytes.set(
      s,
      (bytes.get(s) ?? 0) + k.length + JSON.stringify(values[i] ?? null).length,
    );
  });
  const kept = [id];
  let used = bytes.get(id) ?? 0;
  // A session with nothing stored has nothing to keep; a live one rejoins at its next stop.
  for (const s of order.slice(1).filter((s) => bytes.has(s))) {
    used += bytes.get(s)!;
    if (used > KEPT_BYTES) break;
    kept.push(s);
  }
  // Delete first: a store already over its cap refuses every set, the list's included.
  for (const k of keys.filter((k) => !kept.includes(k.split(":")[1])))
    await $.store.delete(k);
  await save($, "tend:recent", kept);
}

async function setOpen($: any, questions: Question[]) {
  await sid($);
  open = questions;
  card = withOpen(card, open);
  $.ui.invalidate("ui.render");
  await save($, `tend:${sessionId}:open`, open);
}

async function showPane($: any, item: string) {
  paneItem = item;
  lastPaneItem = item;
  // Never takes the keys: they stay with the prompt; a click inside hands them over.
  $.ui.invalidate("ui.render");
  const r = await $.ui.open({ id: PANE, title: "tend", closeOnEscape: true });
  if (!r.isPlaced) $.ui.toast(r.reason);
}

/** The card a skill is asked for, run where the run is certain (its Skill tool call, a prompt that
 * starts with its command), since `skill.prompt` never reaches a user plugin where managed settings
 * seat sec-default. */
async function cardAsk($: any, name: string): Promise<string[]> {
  const names = ((await $.command.list()) as { name: string }[]).map(
    (c) => c.name,
  );
  const format = CARD_SKILLS.get(commandFor(names, name) ?? "");
  return format ? [format] : [];
}

// A stem the user finishes and sends as their own words.
async function typeThrough($: any, ch: string) {
  const f = await $.prompt.fill({ text: ch, mode: "insert" });
  if (f.isFilled) fills++;
  $.ui.invalidate("ui.render");
}

async function fill($: any, text: string) {
  const box: string = (await $.prompt.read()).text;
  // A second press of the same line leaves the box as it is.
  if (box.trimEnd().endsWith(text.trimEnd())) return;
  // A stem left bare is swapped for the new one, never stacked: "idea 1: fact 2: " can't happen.
  const bare =
    lastStem && box.endsWith(lastStem)
      ? box.slice(0, -lastStem.length)
      : undefined;
  const f =
    bare === undefined
      ? await $.prompt.fill({ text, mode: "insert" })
      : await $.prompt.fill({ text: bare + text, mode: "replace" });
  lastStem = text;
  if (f.isFilled) fills++;
  else await $.prompt.suggest({ text });
}

// A second answer to a question takes the first one's place; the first starts its own line in
// the box, and is an answer, not a bare stem: the next line joins it rather than replacing it.
async function setAnswer($: any, n: number, options: string[], pick: string) {
  const box: string = (await $.prompt.read()).text;
  const swapped = swapAnswer(box, n, options, pick);
  const own = box.trim() && !box.endsWith("\n") ? "\n" : "";
  if (swapped === undefined) await fill($, `${own}q${n}: ${pick} `);
  else if (
    swapped !== box &&
    (await $.prompt.fill({ text: swapped, mode: "replace" })).isFilled
  )
    fills++;
  lastStem = "";
}

function reset() {
  card = {};
  open = undefined;
  paneItem = null;
  lastPaneItem = null;
  typedFrom.clear();
  short.clear();
  lastStem = "";
}

// What a press or Enter on a band or pane item does.
async function act($: any, id: string) {
  const [kind, ...rest] = id.split(":");
  const arg = rest.join(":");
  if (kind === "chip") {
    if (paneItem === `card:${arg}`) await $.ui.close({ id: PANE });
    else await showPane($, `card:${arg}`);
  } else if (kind === "probe") await fill($, `${arg}: `);
  else if (kind === "answer") {
    const [i, j] = rest.map(Number);
    const q = card.questions?.[i];
    // Answered once sent, not on the click: an abandoned answer leaves the question up.
    if (q) await setAnswer($, i + 1, q.options, q.options[j]);
  } else if (kind === "close") await $.ui.close({ id: PANE });
  $.ui.invalidate("ui.render");
}

export const register: Register = (on) => {
  // A new or resumed session: memory left from another one is dropped.
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    await sid($);
    return r;
  });

  on("session.end", async ($, e, next) => {
    if (e.reason === "clear") reset();
    return next(e);
  });

  on("command.run", { command: "long" }, async ($) => {
    showLong = !showLong;
    $.ui.invalidate("ui.render");
    $.ui.toast(
      showLong ? "replies at full length" : "long replies short again",
    );
    return {};
  });

  on("command.run", { command: "cards" }, async ($) => {
    if (lastPaneItem) await showPane($, lastPaneItem);
    else $.ui.toast("nothing to show");
    return {};
  });

  for (const name of ON_DEMAND)
    on("command.run", { command: name }, async ($) => {
      if (card[name]?.length) await showPane($, `card:${name}`);
      else $.ui.toast(`no ${name} yet`);
      return {};
    });

  // A skill the session itself runs is asked for its card; an agent's skill is the agent's.
  on("tool.call", async ($, e, next) => {
    const skill = (e as any).skill;
    if (e.agentId || e.tool !== "Skill" || typeof skill !== "string")
      return next(e);
    const r = await next(e);
    if (r.deny !== undefined) return r;
    const asked = await cardAsk($, skill);
    return asked.length
      ? { ...r, context: [...(r.context ?? []), ...asked] }
      : r;
  });

  // The user's own prompt keeps a card already shown current: the model is asked for the keys this turn changes.
  on("prompt.submit", async ($, e, next) => {
    // A prompt that starts with a skill's command runs it, however the prompt arrived.
    const name = slashName(e.text);
    const asked = name ? await cardAsk($, name) : [];
    const withContext = (more: string[]) =>
      more.length
        ? next({ ...e, context: [...(e.context ?? []), ...more] })
        : next(e);
    if (e.origin.kind !== "composer") return withContext(asked);
    // Whatever it says, the prompt answers what was asked: a question the next reply leaves out stays closed.
    await setOpen($, []);
    if (asked.length || !Object.keys(card).length) return withContext(asked);
    return withContext([
      `Only if this turn settles or changes what the card holds (the block may follow the last line, whatever the reply format says):\n${CARD_FORMAT}`,
    ]);
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) return r;
    // Each turn moves the session to the front, so a long one outlives the sessions opened since.
    if (!(await headless($)))
      await save($, "tend:recent", await recent($, await sid($)));
    await readSession($);
    await setOpen($, turnQuestions(e.answer, card.questions ?? []));
    const reply = stripCards(e.answer);
    const asked =
      ((await $.session.messages()) as Msg[]).findLast(
        (m) => m.role === "user",
      )?.text ?? "";
    if (!(await headless($)) && wantsShort(reply, asked))
      loud($, shorten($, reply));
    return r;
  });

  // A compaction keeps what its summary chose; the card it ends on keeps the rest whole.
  // A reload re-raises session.start, a compaction never does, so the card rides the compaction itself.
  on("session.compact", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId || !r.messages) return r;
    try {
      await sid($);
      const text = replayCard(withOpen(latestCard(e.messages as Msg[]), open));
      return text
        ? {
            ...r,
            messages: [
              ...r.messages,
              { role: "assistant" as const, text, toolUses: [] },
            ],
          }
        : r;
    } catch (err) {
      $.ui.toast(
        `tend: the card did not ride the compaction: ${err instanceof Error ? err.message : String(err)}`,
      );
      return r;
    }
  });

  on("ui.close", async ($, e, next) => {
    const r = await next(e);
    if (e.id === PANE) {
      paneItem = null;
      $.ui.invalidate("ui.render");
    }
    return r;
  });
  // The card block is for the band; the model keeps it, the transcript doesn't show it.
  on("ui.render", { component: "AssistantMessage" }, ($, e, next) => {
    const stripped = stripCards(e.props.text);
    const text = (!showLong && short.get(textKey(stripped))) || stripped;
    if (text === e.props.text) return next(e);
    if (!text.trim()) {
      const { Box } = $.ui.resolve(e);
      return <Box />;
    }
    // A reply that ends on ideas draws them itself: the change stands out, the rest recedes.
    if (latestCard([{ role: "assistant", text: e.props.text }]).ideas?.length) {
      const { Box, Text, Markdown } = $.ui.resolve(e);
      return (
        <Box flexDirection="column">
          {ideaSegments(text).map((g, i) =>
            "md" in g ? (
              <Markdown key={`md${i}`} text={g.md} />
            ) : "chosen" in g ? (
              <Text key={`c${i}`} color="success">
                {g.chosen}
              </Text>
            ) : "head" in g ? (
              <Text key={`h${i}`}>
                {g.head.lead}
                <Text bold>{g.head.change}</Text>
                {g.head.rest}
              </Text>
            ) : (
              <Text key={`d${i}`} dimColor>
                {g.dim}
              </Text>
            ),
          )}
        </Box>
      );
    }
    return next({ ...e, props: { ...e.props, text } });
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e);
    if (!started) {
      started = true;
      loud(
        $,
        (async () => {
          await registerCommands($);
          await readSession($);
        })(),
      );
    }
    const els = $.ui.resolve(e);
    // Surfaces with no Client (mobile, the editor's panel) keep their own band.
    if (!("Client" in els)) return next(e);
    const { Box, Client } = els;
    const band = bandModel(card, paneItem);
    if (!band.chips.length) return <Box />;
    // A blank line parts the band from the reply above it, so the chips read as controls, not its last line.
    return (
      <Box marginTop={1}>
        <Client
          key={`band-${fills}`}
          module="./band.tsx"
          props={band}
          width={e.props.bodyColumns}
        />
      </Box>
    );
  });
  on("ui.message", async ($, e, next) => {
    const data = e.data as
      { act?: unknown; type?: unknown; release?: unknown } | undefined;
    const before = fills;
    // A failed act is shown; the message still passes on (hooks fail open).
    if (typeof data?.act === "string")
      await act($, data.act).catch((err) =>
        $.ui.toast(`tend: ${err?.message ?? err}`),
      );
    if (typeof data?.type === "string") {
      const done = typedFrom.get(e.element) ?? 0;
      typedFrom.set(e.element, data.type.length);
      if (data.type.length > done) await typeThrough($, data.type.slice(done));
    }
    if (data?.release === true) fills++;
    // A pane keeps the keys past its Client's redraw; reopening it hands them to the prompt.
    if (fills !== before && e.component === "Pane" && paneItem) {
      const item = paneItem;
      await $.ui.close({ id: PANE });
      await showPane($, item);
    }
    $.ui.invalidate("ui.render");
    return next(e);
  });

  on("ui.render", { component: "Pane" }, ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const els = $.ui.resolve(e);
    if (!("Client" in els)) return next(e);
    const { Box, Client } = els;
    const name = (paneItem ?? "").replace(/^card:/, "");
    const width = Math.min(e.props.bodyColumns, MEASURE);
    // The whole pane is one Client: clicks and keys reach it, typing goes on to the prompt.
    const pane: Band = {
      chips: [],
      body: [
        [
          { id: "title", label: name, kind: "title" },
          { id: "close", label: "close", kind: "line" },
        ],
        [],
        ...cardRows(card, name),
      ],
    };
    return (
      <Box width={width} paddingX={PAD} paddingY={1}>
        <Client
          key={`pane-${fills}`}
          module="./band.tsx"
          width={width - 2 * PAD}
          props={pane}
        />
      </Box>
    );
  });
};
