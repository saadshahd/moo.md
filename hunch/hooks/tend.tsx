import type { Register } from "claude-code";
import { MEASURE, type Band, type Item } from "./band.tsx";
import { EDITS, MOVES, SLOTS, heldReason, saysGo, unquoted, userWords, type Said } from "./gate.tsx";
import { changes, isSteering, isSteeringPath, memoryRows, places, retrieved, type Places, type Snapshot, type Steering } from "./memory.tsx";

export type Question = { q: string; options: string[] };
/** One expert's idea to try; `test` pits it against the version that exists. */
export type Idea = { by: string; idea: string; why?: string; test?: string };
export type Card = {
  intent?: string;
  shape?: string;
  /** An agent's own one-line answer; the session's card has none. */
  outcome?: string;
  facts?: string[];
  questions?: Question[];
  ideas?: Idea[];
  skills?: { name: string; outcome: string }[];
  watch?: { label: string; open: string; see?: string }[];
  said?: Said;
};
type Msg = {
  role: string;
  text: string;
  toolUses?: { tool: string; input: Record<string, unknown> }[];
  toolResults?: { text: string }[];
};
/** `read`: opened once, drawn dim in the agents list. */
export type Row = { id: string; label: string; type: string; done: boolean; read?: true };

// What a card's facts are, for the session and its agents alike.
const FACTS = "what the user should carry forward — durable, in plain words, no file paths, tool steps or change details";

export const CARD_FORMAT = `End your reply with a \`\`\`card JSON block of what it settled; omit unchanged keys, [] clears a list:
{"intent":"…","shape":"…","said":{"goal":"…","done":"…"},"facts":["…"],"questions":[{"q":"…","options":["…"]}],"skills":[{"name":"hope:…","outcome":"…"}],"watch":[{"label":"…","open":"url|path|pane:path","see":"…"}]}
said: the user's words copied exactly, never reworded: goal — ${SLOTS.goal}; done — ${SLOTS.done}. facts: ${FACTS}; one that settles a choice names what lost. questions: every question still open; the user's next prompt closes them all, so restate any still open. skills: the planned skills in order. watch: where a human looks and what should appear there, never agent state.
The user cites items by 1-based position: \`fact 2: …\`, \`q1: <option> — …\`.`;
// Asked of every agent the session starts, so its pane reads like the session's card.
export const AGENT_CARD = `End your final answer (your last reply, or your last message to the lead) with a \`\`\`card JSON block: {"intent":"…","outcome":"…","facts":["…"]}. intent: what you set out to do. outcome: your answer in one line. facts: ${FACTS}.`;
// Asked of the session when one of its agents returns: the result sits in the agents pane, not the thread.
export const AGENT_RETURN = `The user did not send this agent's return; its result sits in their agents pane. Carry on any work it unblocks. Then, if the result changes what the user does next, tell them in one line. Otherwise your reply is only an empty card block:
\`\`\`card
{}
\`\`\``;
// Asked of consult, so its ideas list in the band to pick from.
export const IDEAS_FORMAT = `End your reply with a \`\`\`card JSON block of the ideas, and your yes/no as its one question:
{"ideas":[{"by":"<expert>","idea":"…","why":"…","test":"…"}],"questions":[{"q":"…","options":["yes","no"]}]}
test: only where this idea's win differs from the one the reply names for all. The question is the reply's last line, word for word. The user cites an idea by its 1-based position: \`idea 2: …\`.`;
// The card each skill is asked for.
const CARD_SKILLS = new Map([
  ...["hope:intent", "hope:shape", "hope:clarify", "hope:elicit", "hope:draft", "hope:compose"].map((k) => [k, CARD_FORMAT] as const),
  ["hope:consult", IDEAS_FORMAT],
]);
// A card opens at a line's start: one quoted inside a reply (`> ```card`) is text, not a card.
const CARD_RE = /(?<=^|\n)```card[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*\n?/g;
const PANE = "tend";

const PAD = 2;
const CHIPS = ["intent", "shape", "facts", "ideas", "questions", "skills", "watch", "memory", "agents"] as const;

// ---- pure ----

// Also hides a block still streaming in, before its closing fence.
export function stripCards(text: string): string {
  return text.replace(CARD_RE, "").replace(/(?<=^|\n)```card[\s\S]*$/, "").trimEnd();
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
  return prose(reply).length > PROSE_MAX && !/\bexplain\b|walk me through/i.test(prompt);
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
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}.${text.length}`;
}

const str = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
// An explicit [] stays: it clears an older block's list.
const list = <T,>(v: unknown, keep: (x: any) => x is T): T[] | undefined =>
  Array.isArray(v) ? v.filter(keep) : undefined;

/** The model's JSON, keeping only well-formed parts, so a bad field can't break the band. */
export function cleanCard(c: any): Card {
  const card: Card = {
    intent: str(c.intent) ? c.intent : undefined,
    shape: str(c.shape) ? c.shape : undefined,
    outcome: str(c.outcome) ? c.outcome : undefined,
    facts: list(c.facts, str),
    questions: list(c.questions, (q): q is Question =>
      str(q?.q) && Array.isArray(q.options) && q.options.every(str),
    ),
    ideas: list(c.ideas, (d): d is Idea =>
      str(d?.by) && str(d.idea) && (d.why === undefined || str(d.why)) && (d.test === undefined || str(d.test)),
    ),
    skills: list(c.skills, (k): k is { name: string; outcome: string } =>
      str(k?.name) && str(k.outcome),
    ),
    watch: list(c.watch, (w): w is { label: string; open: string; see?: string } =>
      str(w?.label) && str(w.open),
    ),
    said:
      c.said && typeof c.said === "object" && (str(c.said.goal) || str(c.said.done))
        ? { ...(str(c.said.goal) ? { goal: c.said.goal } : {}), ...(str(c.said.done) ? { done: c.said.done } : {}) }
        : undefined,
  };
  for (const k of Object.keys(card) as (keyof Card)[])
    if (card[k] === undefined) delete card[k];
  return card;
}

/** Each key from the newest block that has it: a clarify card keeps compose's skills. */
export function latestCard(msgs: Msg[]): Card {
  const card: Card = {};
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
      for (const k of Object.keys(clean) as (keyof Card)[])
        if (!(k in card)) (card as any)[k] = clean[k];
    }
  }
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
export function swapAnswer(box: string, n: number, options: string[], pick: string): string | undefined {
  const at = `q${n}: `;
  const found = options
    .map((o) => ({ from: box.indexOf(at + o), len: at.length + o.length }))
    .filter((f) => f.from >= 0)
    // Of two answers at one place, the longer: "yes, later" over "yes".
    .sort((x, y) => x.from - y.from || y.len - x.len)[0];
  return found && box.slice(0, found.from) + at + pick + box.slice(found.from + found.len);
}

/** The questions a turn leaves open: its reply's card's when it lists any, since a card lists every
 * open one; else those already open, then the ones it asked in prose, with no options. */
export function turnQuestions(answer: string, open: Question[]): Question[] {
  const carded = latestCard([{ role: "assistant", text: answer }]).questions;
  if (carded?.length) return carded;
  const asked = carded ?? open;
  return [...asked, ...proseQuestions(answer, asked.map((q) => q.q)).map((q) => ({ q, options: [] }))];
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

/** A plan may name `clarify` where the engine reports `hope:clarify`. */
export function hasRun(ran: Set<string>, name: string): boolean {
  return ran.has(name) || [...ran].some((r) => r.endsWith(`:${name}`));
}

/** The command a prompt starts with: `/hope:intent x` gives `hope:intent`; a path like `/a/b.md` gives none. */
export function slashName(text: string): string | undefined {
  return text.match(/^\/([\w:-]+)(?:\s|$)/)?.[1];
}

/** The slash command a planned skill runs by, or undefined when none exists. */
export function commandFor(names: string[], name: string): string | undefined {
  return names.find((n) => n === name) ?? names.find((n) => n.endsWith(`:${name}`));
}

export function clip(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function tablesToLists(md: string): string {
  const out: string[] = [];
  let head: string[] | null = null;
  const cells = (l: string) =>
    l
      .trim()
      .replace(/\\\|/g, "\0")
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim().replace(/\0/g, "|"));
  for (const l of md.split("\n")) {
    if (!l.trim().startsWith("|")) {
      head = null;
      out.push(l);
    } else if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l)) continue;
    else if (!head) head = cells(l);
    else {
      const c = cells(l);
      out.push(`- **${c[0]}**`);
      for (let i = 1; i < c.length; i++)
        out.push(`  - ${head[i] ?? ""}: ${c[i]}`);
    }
  }
  return out.join("\n");
}

export function bareFact(f: string): string {
  return f.replace(/^\s*(?:[\w-]+(?:\s+[\w-]+)?\s+confirmed|found|measured)\s*:\s*/i, "");
}

/** A consult reply cut where its colours change: markdown as written, each idea's head, and the
 * lines under it and the shared win, which recede. */
export type Segment = { md: string } | { head: { lead: string; change: string; rest: string } } | { dim: string };

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
    if (head) {
      flush();
      inList = listed = true;
      out.push({ head: { lead: plain(head[1]), change: plain(head[2]), rest: plain(head[3]) } });
    } else if (inList && /^\s+\S/.test(l)) out.push({ dim: plain(l) });
    // A blank line between ideas keeps them apart.
    else if (inList && !l.trim()) out.push({ dim: "" });
    // Past the ideas, all but the closing question recedes: the win, and any note the rules left out.
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

export function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

const TEAMMATE_RE = /^\s*<teammate-message\b([^>]*)>([\s\S]*?)<\/teammate-message>\s*$/;

export type AgentView = { asked: string; returned: string; body: string; card: Card; footprint: string[] };

/** What an agent was asked, what it returned, the card it ended on, and the files and pages
 * it changed or fetched. A teammate's brief arrives wrapped as a teammate-message, and its
 * answer is its last SendMessage. */
export function agentView(msgs: Msg[]): AgentView {
  const first = msgs.find((m) => m.role === "user" && m.text.trim())?.text ?? "";
  const wrapped = first.match(TEAMMATE_RE);
  const summary = wrapped?.[1].match(/summary="([^"]*)"/)?.[1];
  const asked = summary || firstLine(wrapped ? wrapped[2] : first);
  const footprint = [
    ...new Set(
      msgs.flatMap((m) =>
        (m.toolUses ?? []).flatMap((t) => {
          const target = FOOTPRINT[t.tool] && t.input[FOOTPRINT[t.tool]];
          return typeof target === "string" ? [target] : [];
        }),
      ),
    ),
  ];
  // The report is the fullest thing it said back: a closing "task complete" never hides it.
  let returned = "";
  let raw = "";
  for (const m of msgs) {
    if (m.role !== "assistant") continue;
    for (const t of m.toolUses ?? []) {
      const message = t.tool === "SendMessage" ? t.input.message : undefined;
      if (typeof message === "string" && message.length >= raw.length) {
        raw = message;
        returned = String(t.input.summary ?? "");
      }
    }
    if (m.text.trim().length >= raw.length) {
      raw = m.text;
      returned = "";
    }
  }
  const card = latestCard([{ role: "assistant", text: raw }]);
  return { asked, returned, body: stripCards(raw), card, footprint };
}

// The tools whose argument is a place a human can look: what the agent changed or read online.
const FOOTPRINT: Record<string, string> = { Write: "file_path", Edit: "file_path", NotebookEdit: "notebook_path", WebFetch: "url" };

/** The places a markdown text links to, in order, once each: a pane lists them to click. */
export function links(md: string): string[] {
  return [
    ...new Set(
      [...md.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)]
        .map((m) => m[1].replace(/^file:\/\//, ""))
        // A place: a url, a path, or a file name; never an anchor or a bare word like `url`.
        .filter((h) => /^([a-z]+:\/\/|\/|\.{1,2}\/|~\/)/i.test(h) || /\.[a-z0-9]+$/i.test(h)),
    ),
  ];
}

/** A place as a person names it: a file by its name, a page by its site and path. */
export function placeName(target: string): string {
  const url = target.match(/^[a-z]+:\/\/(?:www\.)?([^/?#]+)([^?#]*)/i);
  if (url) return `${url[1]}${url[2].length > 1 ? url[2].replace(/\/$/, "") : ""}`;
  return target.split("/").pop() || target;
}

/** What a pane shows for a file it could not read: a missing file is one not written yet. */
export function unreadable(path: string, err: unknown): string {
  return /\bENOENT\b/.test(String(err)) ? `_not written yet: ${path}_` : `_${String(err)}_`;
}

/** A link read in a file, as a place to open: relative ones sit beside the file. */
export function fromFile(file: string, href: string): string {
  return href.startsWith("/") || href.includes("://") ? href : `${file.slice(0, file.lastIndexOf("/") + 1)}${href}`;
}

const line = (id: string, label: string): Item => ({ id, label, kind: "line" });
const quiet = (id: string, label: string): Item => ({ id, label, kind: "quiet" });
const note = (id: string, label: string): Item => ({ id, label, kind: "note" });
const title = (id: string, label: string): Item => ({ id, label, kind: "title" });
const under = (i: Item): Item => ({ ...i, indent: 2 });
const column = (i: Item): Item => ({ ...i, column: true });
// Entries a blank line apart, so each reads as one.
const spaced = (entries: Item[][][]): Item[][] => entries.flatMap((e, i) => (i ? [[], ...e] : e));

/** A text's sentences, a clause after a semicolon counting as one. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=;)\s+/);
}

/** A fact's first sentence, then the rest of it: the claim, then what lost and why. */
export function factParts(f: string): [string, string] {
  const [head, ...rest] = sentences(bareFact(f));
  return [head, rest.join(" ")];
}

/** Facts as bullets a blank line apart: each claim, then what lost and why dim under it.
 * `whose` names the probe: "" for the session's card, an agent's name and a space for its pane. */
function factRows(facts: string[], whose: string): Item[][] {
  return spaced(
    facts.map((f, i) => {
      const [head, rest] = factParts(f);
      return [
        [line(`probe:${whose}fact ${i + 1}`, `• ${head}`)],
        ...(rest ? [[under(note(`fact-note:${whose}${i}`, rest))]] : []),
      ];
    }),
  );
}

/** An agent's pane as a card: intent, outcome, where to look, the facts it rests on; the full
 * report one click further. Its sections sit a blank line apart, the labels one column. */
export function agentRows(v: AgentView, name: string, id: string): Item[][] {
  const label = (word: string) => column(note(`note:${word}`, word));
  const section = (word: string, rows: Item[][]) =>
    rows.length ? [rows.map((r, i) => (r.length ? [label(i ? "" : word), ...r] : r))] : [];
  const outcome = v.card.outcome || v.returned || firstLine(v.body.replace(/^#.*$/gm, ""));
  const intent = v.card.intent || v.asked;
  return spaced([
    ...section("intent", intent ? [[line(`probe:${name} intent`, intent)]] : []),
    // The answer is what the reader came for: it reads bold.
    ...section("outcome", outcome ? [[{ ...line(`probe:${name} outcome`, outcome), strong: true as const }]] : []),
    ...section("watch", [...new Set([...v.footprint, ...links(v.body)])].map((f) => [line(`open:${f}`, placeName(f))])),
    ...section("facts", factRows(v.card.facts ?? [], `${name} `)),
    ...section("report", v.body ? [[quiet(`report:${id}`, "read it all")]] : []),
  ]);
}

const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|json|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|sh|zsh|toml|ya?ml|css|scss|sql|lua|txt)$/i;

/** A local text file a person edits, not a page, a picture or a document to view. */
export function isSourceFile(target: string): boolean {
  return !target.includes("://") && (SOURCE_RE.test(target) || !/\.[^/]+$/.test(target));
}

/** A chip's label with the one number that previews its card: how many, or skills run of planned. */
export function chipLabel(name: string, s: Shown): string {
  if (name === "intent" || name === "shape") return name;
  if (name === "skills") {
    const planned = s.card.skills ?? [];
    return `skills ${planned.filter((k) => hasRun(s.ran, k.name)).length}/${planned.length}`;
  }
  if (name === "facts") return `facts ${s.card.facts?.length ?? 0}`;
  if (name === "questions") return `questions ${s.card.questions?.length ?? 0}`;
  if (name === "ideas") return `ideas ${s.card.ideas?.length ?? 0}`;
  if (name === "memory") return `memory ${s.memory.length}`;
  return `${name} ${chipRows(name, s).length}`;
}

/** A card's lines; each inner list is one row the arrows move along. */
export function cardRows(c: Card, name: string, ran: Set<string>): Item[][] {
  if (name === "intent" || name === "shape")
    // Each sentence its own paragraph, set in from the pane's edge.
    return c[name] ? [[under(line(`probe:${name}`, sentences(c[name]!).join("\n\n")))]] : [];
  if (name === "facts") return factRows(c.facts ?? [], "");
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
        [column(note(`idea-by:${i}`, d.by)), { ...line(`probe:idea ${i + 1}`, d.idea), strong: true as const }],
        ...[d.why, d.test && `A/B: ${d.test}`].flatMap((t, k) =>
          t ? [[column(note(`idea-gap:${i}:${k}`, "")), note(`idea-note:${i}:${k}`, t)]] : [],
        ),
      ]),
    );
  if (name === "skills")
    return (c.skills ?? []).map((k, i) => [
      column({ ...line(`skill:${i}`, k.name), ...(hasRun(ran, k.name) ? { state: "done" as const } : {}) }),
      note(`skill-note:${i}`, k.outcome),
    ]);
  if (name === "watch")
    return (c.watch ?? []).map((w, i) => [
      column(line(`watch:${i}`, w.label)),
      quiet(`probe:watch ${i + 1}`, "?"),
      ...(w.see ? [note(`watch-note:${i}`, w.see)] : []),
    ]);
  return [];
}

function agentItem(r: Row, paneItem: string | null): Item {
  return {
    id: `agent:${r.id}`,
    label: clip(r.label),
    kind: "line",
    state: r.done ? "done" : "running",
    ...(r.read ? { read: true as const } : {}),
    ...(paneItem === `agent:${r.id}` ? { open: true as const } : {}),
  };
}

/** What the band draws from. */
export type Shown = { card: Card; ran: Set<string>; rows: Row[]; paneItem: string | null; memory: Steering[] };

/** The chip a pane item belongs to: a card's own, or agents for an agent's card or report. */
export function paneChip(paneItem: string | null): string | undefined {
  const [kind, ...rest] = (paneItem ?? "").split(":");
  return kind === "card" ? rest.join(":") : kind === "agent" || kind === "report" ? "agents" : undefined;
}

/** The rows a chip opens: the card's, the session's agents, or the steering files it updated and retrieved. */
export function chipRows(name: string, s: Shown): Item[][] {
  if (name === "memory") return memoryRows(s.memory);
  return name === "agents"
    ? s.rows.map((r) => [agentItem(r, s.paneItem)])
    : cardRows(s.card, name, s.ran);
}

/** The band is its chips alone: every card reads in the pane. */
export function bandModel(s: Shown): Band {
  const shown = CHIPS.filter((n) => chipRows(n, s).length > 0);
  return {
    doc: "",
    chips: shown.map((n) => ({
      id: `chip:${n}`,
      label: chipLabel(n, s),
      kind: "chip",
      // Client props refuse undefined, so an unmarked chip has no key at all.
      ...(paneChip(s.paneItem) === n ? { open: true as const } : {}),
      // While any agent works, its chip says so.
      ...(n === "agents" && s.rows.some((r) => !r.done) ? { state: "running" as const } : {}),
    })),
    body: [],
  };
}

// ---- state ----

let card: Card = {};
let rows: Row[] = [];
// The steering files this session updated since it started, then those it read or loaded.
let memory: Steering[] = [];
// The steering files as the session first saw them.
let memoryBase: Snapshot | undefined;
// The questions still open: a card block holds only those its writer chose, and the user's
// next prompt closes them all, however it answered them.
let open: Question[] | undefined;
// Armed from the message a move ran at, until an edit passes or the user says go.
type Gate = { at: number } | "open";
let gate: Gate | undefined;
let paneItem: string | null = null;
let lastPaneItem: string | null = null;
const ran = new Set<string>();
// The plan moved this turn (new card, or a skill ran): only then suggest the next skill.
let planMoved = false;
let nextCmd: string | undefined;
const paneText = new Map<string, string>();
// The agent a pane shows, kept past a reset that empties the rows while its pane stays open.
const paneAgent = new Map<string, Row>();
// Agents of a session this module no longer serves.
const gone = new Set<string>();
// Teammates whose last turn ended; a tool call of theirs starts them again.
const idle = new Set<string>();
// What each opened agent was asked and returned: a wrong brief is the cheapest thing to catch.
const views = new Map<string, AgentView>();
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
}

// A rewrite that fills its token cap was cut off, and with it the reply's closing ask.
export const SHORT_CAP = 2048;

/** Redraws a long reply short once the turn ends: its long form already showed while it streamed. */
async function shorten($: any, reply: string) {
  const r = await $.model.complete({ model: "haiku", prompt: shortAsk(reply), maxTokens: SHORT_CAP, timeoutMs: 60_000 });
  if (!r.isAnswered) throw new Error(`the short reply failed: ${r.reason}`);
  if (r.usage.output_tokens >= SHORT_CAP) throw new Error("the short reply ran out of room, so the reply stays long");
  short.set(textKey(reply), r.text.trim());
  const kept = [...short].slice(-KEPT_SHORT);
  await save($, `tend:${await sid($)}:short`, Object.fromEntries(kept));
  $.ui.invalidate("ui.render");
}

async function readSession($: any) {
  await sid($);
  const msgs: Msg[] = await $.session.messages();
  const next = withOpen(latestCard(msgs), open);
  if (JSON.stringify(next) !== JSON.stringify(card)) planMoved = true;
  card = next;
  $.ui.invalidate("ui.render");
}

/** Runs a detached step; a failure is shown, never swallowed, and never breaks the hook that started it. */
function loud($: any, p: Promise<unknown>) {
  p.catch((err: unknown) => $.ui.toast(`tend: ${err instanceof Error ? err.message : String(err)}`));
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
      $.ui.toast(`tend: couldn't read this session's band back: ${err instanceof Error ? err.message : String(err)}`),
    );
  }
  await loaded;
  return id;
}

async function load($: any, id: string) {
  if (!(await headless($))) await keepRecent($, id);
  const get = (k: string) => $.store.get(`tend:${id}:${k}`);
  for (const r of ((await get("ran")) as string[]) ?? []) ran.add(r);
  for (const i of ((await get("idle")) as string[]) ?? []) idle.add(i);
  for (const [k, v] of Object.entries(((await get("short")) as Record<string, string>) ?? {})) short.set(k, v);
  memory = ((await get("memory")) as Steering[]) ?? [];
  memoryBase = (await get("memory-base")) as Snapshot | undefined;
  open = (await get("open")) as Question[] | undefined;
  gate = (await get("gate")) as Gate | undefined;
  rows = ((await $.store.get(`tend:${id}`)) as Row[]) ?? [];
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
    if (!refused) $.ui.toast(`tend: couldn't save the band, so a reload or resume loses it: ${err instanceof Error ? err.message : String(err)}`);
    refused = true;
  }
}

/** The store's sessions, newest first, with this one moved to the front. */
async function recent($: any, id: string): Promise<string[]> {
  const before = ((await $.store.get("tend:recent")) as string[] | undefined) ?? [];
  return [id, ...before.filter((s) => s !== id)];
}

// The store holds 4 MiB in all. A session starting keeps the newest sessions that fit in 3,
// itself whatever its size: the last MiB is its room to grow.
const KEPT_BYTES = 3 * 2 ** 20;

async function keepRecent($: any, id: string) {
  const order = await recent($, id);
  const keys = ((await $.store.keys()) as string[]).filter((k) => k.startsWith("tend:") && k !== "tend:recent");
  const values = await Promise.all(keys.map((k) => $.store.get(k)));
  const bytes = new Map<string, number>();
  keys.forEach((k, i) => {
    const s = k.split(":")[1];
    bytes.set(s, (bytes.get(s) ?? 0) + k.length + JSON.stringify(values[i] ?? null).length);
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
  for (const k of keys.filter((k) => !kept.includes(k.split(":")[1]))) await $.store.delete(k);
  await save($, "tend:recent", kept);
}

async function remember($: any) {
  await sid($);
  await save($, `tend:${sessionId}:ran`, [...ran]);
  await save($, `tend:${sessionId}:idle`, [...idle]);
}

async function snapshot($: any, p: Places): Promise<Snapshot> {
  const listed = await $.process.run(
    ["git", "ls-files", "-co", "--exclude-standard", "-z"],
    { cwd: p.root },
  );
  // 128: not a git repository, so there are no project files to find this way.
  if (listed.exitCode !== 0 && listed.exitCode !== 128)
    throw new Error(`git ls-files: ${listed.stderr.trim()}`);
  const project =
    listed.exitCode === 0
      ? (listed.stdout as string)
          .split("\0")
          .filter(isSteering)
          .map((r) => `${p.root}/${r}`)
      : [];
  const saved = (await $.fs.exists(p.memory))
    ? ((await $.fs.list(p.memory)) as { name: string; kind: string }[])
        .filter((f) => f.kind === "file")
        .map((f) => `${p.memory}/${f.name}`)
    : [];
  const candidates = [...saved, ...project, `${p.config}/CLAUDE.md`];
  // A tracked file deleted from disk is still listed by git: only what exists is compared.
  const paths = (await Promise.all(candidates.map(async (path) => ((await $.fs.exists(path)) ? [path] : [])))).flat();
  const stats = await Promise.all(paths.map((path) => $.fs.stat(path)));
  return Object.fromEntries(paths.map((path, i) => [path, stats[i].mtimeMs]));
}

// The first look at the steering files is the session's baseline; each stop compares against it,
// and lists what the session read or loaded besides.
async function readMemory($: any, transcriptPath: string) {
  const p = places(transcriptPath, await $.session.root());
  if (!p || (await headless($))) return;
  // Each stop moves the session to the front, so a long one outlives the sessions opened since.
  await save($, "tend:recent", await recent($, await sid($)));
  const base = memoryBase;
  const now = await snapshot($, p);
  if (!base) {
    memoryBase = now;
    await save($, `tend:${sessionId}:memory-base`, now);
  }
  const updated = base ? changes(base, now, p) : [];
  const usage = await $.session.usage({ breakdown: "summary" });
  const loaded = ((usage.context.breakdown?.memoryFiles ?? []) as { path: string }[]).map((f) => f.path);
  const read = ((await $.session.messages()) as Msg[])
    .flatMap((m) => m.toolUses ?? [])
    .flatMap((u) => (u.tool === "Read" && typeof u.input.file_path === "string" ? [u.input.file_path] : []))
    .filter((path) => isSteeringPath(path, p));
  memory = [...updated, ...retrieved([...loaded, ...read], updated, p)];
  $.ui.invalidate("ui.render");
  await save($, `tend:${sessionId}:memory`, memory);
}

async function setOpen($: any, questions: Question[]) {
  await sid($);
  open = questions;
  card = withOpen(card, open);
  $.ui.invalidate("ui.render");
  await save($, `tend:${sessionId}:open`, open);
}

async function setGate($: any, next: Gate) {
  await sid($);
  gate = next;
  await save($, `tend:${sessionId}:gate`, gate);
}

/** Why the edit waits, or undefined to let it through: the card written since the gate armed
 * must quote the user's goal and done-check. */
async function held($: any): Promise<string | undefined> {
  await sid($);
  if (!gate || gate === "open") return undefined;
  const msgs = (await $.session.messages()) as Msg[];
  const missing = unquoted(latestCard(msgs.slice(gate.at)).said, userWords(msgs));
  if (missing.length) return heldReason(missing);
  await setGate($, "open");
  return undefined;
}

// Finished agents drop out of $.agent.list(); rows keep them for the session.
async function readAgents($: any) {
  await sid($);
  const listed: Row[] = ((await $.agent.list()) as any[])
    .filter((a) => !a.parentId && !gone.has(a.id))
    .map((a) => ({
      id: a.id,
      label: a.name ?? a.description,
      type: a.type,
      // A teammate stays `running` while idle; its own turn ending is what says done.
      done: a.type === "teammate" ? idle.has(a.id) : a.status !== "running" && a.status !== "pending",
    }));
  // Read after every await: a flag set a moment ago by another hook stands.
  const next = [
    ...listed.map((l) => ({ ...rows.find((k) => k.id === l.id), ...l })),
    ...rows
      .filter((k) => !listed.some((l) => l.id === k.id))
      .map((k) => ({ ...k, done: true })),
  ];
  if (JSON.stringify(next) === JSON.stringify(rows)) return;
  rows = next;
  await save($, `tend:${sessionId}`, rows);
  // A pane opened on an agent, its card or its report, reloads as the agent's rows change;
  // loadAgent alone decides when there is a result to show.
  const shown = paneItem?.match(/^(?:agent|report):(.+)$/)?.[1] ?? "";
  if (shown && !paneText.has(`agent:${shown}`)) await loadAgent($, shown);
  $.ui.invalidate("ui.render");
}

async function loadAgent($: any, id: string) {
  const view = agentView(await $.session.messages({ agentId: id }));
  views.set(`agent:${id}`, view);
  if (rows.find((r) => r.id === id)?.done) paneText.set(`agent:${id}`, view.body || "_no result_");
}

async function openAgent($: any, id: string) {
  const r = rows.find((x) => x.id === id);
  if (r) paneAgent.set(`agent:${id}`, r);
  // The pane answers the click at once; the agent's words fill in when read.
  const shown = showPane($, `agent:${id}`);
  await loadAgent($, id);
  // Rows may have been swapped by a poll while this waited: mark the current one.
  if (rows.some((x) => x.id === id && x.done && !x.read)) {
    rows = rows.map((x) => (x.id === id ? { ...x, read: true as const } : x));
    await save($, `tend:${sessionId}`, rows);
  }
  $.ui.invalidate("ui.render");
  await shown;
}

async function openTarget($: any, target: string) {
  if (target.startsWith("pane:")) return showPane($, `file:${target.slice(5)}`);
  if (/\.(md|markdown)$/i.test(target) && !target.includes("://"))
    return showPane($, `file:${target}`);
  return openOutside($, target, isSourceFile(target));
}

// In VS Code (`code`) when asked and it opens, else by the system's default.
async function openOutside($: any, target: string, inEditor: boolean) {
  const run = (argv: string[]) =>
    $.process.run(argv, { timeoutMs: 10000 }).catch((err: unknown) => ({ exitCode: -1, stderr: String(err) }));
  const opened = inEditor && (await run(["code", "-g", target])).exitCode === 0;
  if (!opened && (await run(["open", target])).exitCode !== 0) $.ui.toast(`can't open ${target}`);
}

async function showPane($: any, item: string) {
  paneItem = item;
  lastPaneItem = item;
  // Open before reading: an open answering the press is placed at any width.
  // Never takes the keys: they stay with the prompt; a click inside hands them over.
  const opened = $.ui.open({ id: PANE, title: "tend", closeOnEscape: true });
  if (item.startsWith("file:"))
    await $.fs.read(item.slice(5)).then(
      (t: string) => paneText.set(item, t),
      (err: unknown) => paneText.set(item, unreadable(item.slice(5), err)),
    );
  $.ui.invalidate("ui.render");
  const r = await opened;
  if (!r.isPlaced) $.ui.toast(r.reason);
}

async function command($: any, name: string): Promise<string | undefined> {
  const names = ((await $.command.list()) as { name: string }[]).map((c) => c.name);
  return commandFor(names, name);
}

async function slash($: any, name: string): Promise<string | undefined> {
  const cmd = await command($, name);
  return cmd && `/${cmd} `;
}

// A skill the session itself runs moves the plan; a card skill is asked for its card. Called only
// where the run is certain (its Skill tool call, a prompt that starts with its command), since
// `skill.prompt` never reaches a user plugin where managed settings seat sec-default.
async function skillRan($: any, name: string): Promise<string[]> {
  const skill = await command($, name);
  if (!skill) return [];
  ran.add(skill);
  planMoved = true;
  await remember($);
  if (MOVES.has(skill)) await setGate($, { at: ((await $.session.messages()) as Msg[]).length });
  const format = CARD_SKILLS.get(skill);
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
  // A stem left bare is swapped for the new one, never stacked: "intent: fact 2: " can't happen.
  const bare = lastStem && box.endsWith(lastStem) ? box.slice(0, -lastStem.length) : undefined;
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
  else if (swapped !== box && (await $.prompt.fill({ text: swapped, mode: "replace" })).isFilled) fills++;
  lastStem = "";
}

function reset() {
  // The old session's agents can linger in `$.agent.list()`; they are never this session's.
  for (const r of rows) gone.add(r.id);
  card = {};
  rows = [];
  memory = [];
  memoryBase = undefined;
  open = undefined;
  gate = undefined;
  paneItem = null;
  lastPaneItem = null;
  ran.clear();
  idle.clear();
  views.clear();
  paneText.clear();
  typedFrom.clear();
  short.clear();
  lastStem = "";
  planMoved = false;
  nextCmd = undefined;
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
  } else if (kind === "skill") {
    const k = card.skills?.[Number(arg)];
    const cmd = k && (await slash($, k.name));
    cmd ? await fill($, cmd) : $.ui.toast(`no command ${k?.name ?? ""}`);
  } else if (kind === "watch") {
    const w = card.watch?.[Number(arg)];
    if (w) await openTarget($, w.open);
  } else if (kind === "agent")
    // A second press on what the pane shows closes it.
    paneItem === id ? await $.ui.close({ id: PANE }) : await openAgent($, arg);
  else if (kind === "open") await openTarget($, arg);
  else if (kind === "view") await showPane($, `file:${arg}`);
  else if (kind === "edit") await openOutside($, arg, true);
  else if (kind === "ask") await fill($, `change ${arg}: `);
  else if (kind === "close") await $.ui.close({ id: PANE });
  else if (kind === "report") await showPane($, id);
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

  on("classic.SessionStart", async ($, e, next) => {
    loud($, readMemory($, e.transcript_path));
    return next(e);
  });

  on("classic.Stop", async ($, e, next) => {
    await readMemory($, e.transcript_path).catch((err) => $.ui.toast(`tend: ${err?.message ?? err}`));
    return next(e);
  });

  on("command.run", { command: "long" }, async ($) => {
    showLong = !showLong;
    $.ui.invalidate("ui.render");
    $.ui.toast(showLong ? "replies at full length" : "long replies short again");
    return {};
  });

  on("command.run", { command: "cards" }, async ($) => {
    if (lastPaneItem) await showPane($, lastPaneItem);
    else $.ui.toast("nothing to show");
    return {};
  });

  // Every agent the session starts is asked to end on a card; an agent at work again is running and unread.
  // A skill an agent runs is the agent's: it moves no plan and gets no card (AGENT_CARD asks its own).
  on("tool.call", async ($, e, next) => {
    if (!e.agentId && e.tool === "Agent" && typeof (e as any).prompt === "string")
      return next({ ...e, prompt: `${(e as any).prompt}\n\n${AGENT_CARD}` } as any);
    const skill = (e as any).skill;
    if (!e.agentId && e.tool === "Skill" && typeof skill === "string") {
      const r = await next(e);
      if (r.deny !== undefined) return r;
      const asked = await skillRan($, skill);
      return asked.length ? { ...r, context: [...(r.context ?? []), ...asked] } : r;
    }
    if (!e.agentId && EDITS.has(e.tool)) {
      const reason = await held($);
      return reason ? { deny: reason } : next(e);
    }
    if (!e.agentId) return next(e);
    const id = e.agentId;
    if (idle.delete(id) || rows.some((x) => x.id === id && x.read)) {
      rows = rows.map(({ read, ...x }) => (x.id === id || !read ? x : { ...x, read }));
      paneText.delete(`agent:${id}`);
      loud($, remember($).then(() => readAgents($)));
    }
    return next(e);
  });

  // The user's own prompt keeps a card already shown current: the model is asked for the keys this turn changes.
  on("prompt.submit", async ($, e, next) => {
    // A prompt that starts with a skill's command runs it, however the prompt arrived.
    const name = slashName(e.text);
    const asked = name ? await skillRan($, name) : [];
    const withContext = (more: string[]) =>
      more.length ? next({ ...e, context: [...(e.context ?? []), ...more] }) : next(e);
    // An agent's return arrives twice: its report as a peer's hand-back, then the task notification.
    if (e.origin.kind === "task-notification" || e.origin.kind === "peer") {
      const id = e.text.match(/<task-id>([^<]+)<\/task-id>|<agent-message from="([^"]+)"/)?.slice(1).find(Boolean);
      const agent = !!id && (rows.some((r) => r.id === id) || ((await $.agent.list()) as any[]).some((a) => a.id === id));
      return withContext(agent ? [...asked, AGENT_RETURN] : asked);
    }
    // The user's "go" starts the work as it stands, however the prompt arrived.
    if (saysGo(e.text)) await setGate($, "open");
    if (e.origin.kind !== "composer") return withContext(asked);
    // Whatever it says, the prompt answers what was asked: a question the next reply leaves out stays closed.
    await setOpen($, []);
    if (asked.length || !Object.keys(card).length) return withContext(asked);
    return withContext([`Only if this turn settles or changes what the card holds (the block may follow the last line, whatever the reply format says):\n${CARD_FORMAT}`]);
  });

  on("prompt.suggest", async ($, e, next) =>
    e.origin.kind === "suggestion" && nextCmd ? next({ ...e, text: nextCmd }) : next(e),
  );

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) {
      idle.add(e.agentId);
      await remember($);
      await readAgents($);
    }
    else {
      await readSession($);
      await setOpen($, turnQuestions(e.answer, card.questions ?? []));
      const reply = stripCards(e.answer);
      const asked = ((await $.session.messages()) as Msg[]).findLast((m) => m.role === "user")?.text ?? "";
      if (!(await headless($)) && wantsShort(reply, asked)) loud($, shorten($, reply));
      const nextSkill = planMoved && card.skills?.find((k) => !hasRun(ran, k.name));
      planMoved = false;
      // A suggestion made while the turn is live never shows.
      nextCmd = (nextSkill && (await slash($, nextSkill.name))) || undefined;
      const cmd = nextCmd;
      if (cmd) $.clock.after(1500, () => loud($, $.prompt.suggest({ text: cmd })));
    }
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
      return text ? { ...r, messages: [...r.messages, { role: "assistant" as const, text, toolUses: [] }] } : r;
    } catch (err) {
      $.ui.toast(`tend: the card did not ride the compaction: ${err instanceof Error ? err.message : String(err)}`);
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

  // A teammate's message to the lead carries the card tend asked for; the row shows it without.
  on("ui.render", { component: "UserMessage" }, ($, e, next) => {
    const text = stripCards(e.props.text);
    return text === e.props.text ? next(e) : next({ ...e, props: { ...e.props, text } });
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e);
    if (!started) {
      started = true;
      // The poll starts first, so a failed step below (shown) never leaves the agents unread.
      $.clock.every(2000, () => loud($, readAgents($)));
      loud($, (async () => {
        await registerCommands($);
        await readSession($);
        await readAgents($);
      })());
    }
    const els = $.ui.resolve(e);
    // Surfaces with no Client (mobile, the editor's panel) keep their own band.
    if (!("Client" in els)) return next(e);
    const { Box, Client } = els;
    const band = bandModel({ card, paneItem, ran, rows, memory });
    if (!band.chips.length) return <Box />;
    // A blank line parts the band from the reply above it, so the chips read as controls, not its last line.
    return (
      <Box marginTop={1}>
        <Client key={`band-${fills}`} module="./band.tsx" props={band} width={e.props.bodyColumns} />
      </Box>
    );
  });

  on("ui.message", async ($, e, next) => {
    const data = e.data as { act?: unknown; type?: unknown; release?: unknown } | undefined;
    const before = fills;
    // A failed act is shown; the message still passes on (hooks fail open).
    if (typeof data?.act === "string") await act($, data.act).catch((err) => $.ui.toast(`tend: ${err?.message ?? err}`));
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
    const item = paneItem ?? "";
    const width = Math.min(e.props.bodyColumns, MEASURE);
    const inner = width - 2 * PAD;
    const kind = item.slice(0, item.indexOf(":"));
    const rest = item.slice(kind.length + 1);
    const agent = rows.find((r) => r.id === rest) ?? paneAgent.get(item);
    const view = views.get(item);
    const close: Item = { id: "close", label: "close", kind: "line" };
    // The whole pane is one Client: clicks and keys reach it, typing goes on to the prompt.
    const pane: Band =
      kind === "agent" && agent
        ? {
            chips: [],
            body: [
              [
                { id: "title", label: agent.label, kind: "title", state: agent.done ? "done" : "running" },
                { id: "note:type", label: agent.type ?? "", kind: "note" },
                { id: "chip:agents", label: "back", kind: "quiet" },
                close,
              ],
              [],
              ...(view ? agentRows(view, agent.label, agent.id) : []),
            ],
            doc: "",
          }
        : kind === "report"
        ? {
            chips: [],
            body: [
              [
                { id: "title", label: paneAgent.get(`agent:${rest}`)?.label ?? "report", kind: "title" },
                { id: "note:report", label: "report", kind: "note" },
                { id: `agent:${rest}`, label: "back", kind: "quiet" },
                close,
              ],
            ],
            doc: tablesToLists(paneText.get(`agent:${rest}`) ?? ""),
          }
        : {
            chips: [],
            body: [
              [
                { id: "title", label: kind === "card" ? rest : (rest.split("/").pop() ?? rest), kind: "title" },
                // A steering file opened from the memory list goes back to it.
                ...(memory.some((c) => c.path === rest) ? [{ id: "chip:memory", label: "back", kind: "quiet" as const }] : []),
                close,
              ],
              [],
              ...(kind === "card"
                ? chipRows(rest, { card, ran, rows, paneItem, memory })
                : links(paneText.get(item) ?? "").map((href) => fromFile(rest, href)).map((l, i) => [
                    { id: `note:links${i}`, label: (i ? "" : "links").padEnd(9), kind: "note" as const },
                    { id: `open:${l}`, label: placeName(l), kind: "line" as const },
                  ])),
            ],
            doc: kind === "card" ? "" : tablesToLists(paneText.get(item) ?? ""),
          };
    return (
      <Box width={width} paddingX={PAD} paddingY={1}>
        <Client key={`pane-${fills}`} module="./band.tsx" width={inner} props={pane} />
      </Box>
    );
  });
};
