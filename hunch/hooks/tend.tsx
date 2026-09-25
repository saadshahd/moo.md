import type { Register } from "claude-code";
import { MEASURE, type Band, type Item } from "./band.tsx";

export type Card = {
  intent?: string;
  shape?: string;
  /** An agent's own one-line answer; the session's card has none. */
  outcome?: string;
  facts?: string[];
  questions?: { q: string; options: string[] }[];
  skills?: { name: string; outcome: string }[];
  watch?: { label: string; open: string; see?: string }[];
};
type Msg = {
  role: string;
  text: string;
  toolUses?: { tool: string; input: Record<string, unknown> }[];
};
/** `read`: opened once, drawn dim in the agents list. */
export type Row = { id: string; label: string; type: string; done: boolean; read?: true };

// What a card's facts are, for the session and its agents alike.
const FACTS = "what the user should carry forward — durable, in plain words, no file paths, tool steps or change details";

export const CARD_FORMAT = `End your reply with a \`\`\`card JSON block of what it settled; omit unchanged keys, [] clears a list:
{"intent":"…","shape":"…","facts":["…"],"questions":[{"q":"…","options":["…"]}],"skills":[{"name":"hope:…","outcome":"…"}],"watch":[{"label":"…","open":"url|path|pane:path","see":"…"}]}
facts: ${FACTS}; one that settles a choice names what lost. skills: the planned skills in order. watch: where a human looks and what should appear there, never agent state.
The user cites items by 1-based position: \`fact 2: …\`, \`q1: <option> — …\`.`;
// Asked of every agent the session starts, so its pane reads like the session's card.
export const AGENT_CARD = `End your final answer (your last reply, or your last message to the lead) with a \`\`\`card JSON block: {"intent":"…","outcome":"…","facts":["…"]}. intent: what you set out to do. outcome: your answer in one line. facts: ${FACTS}.`;
const CARD_SKILLS = new Set([
  "hope:intent",
  "hope:shape",
  "hope:clarify",
  "hope:elicit",
  "hope:draft",
  "hope:compose",
]);
const CARD_RE = /```card[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*\n?/g;
const PANE = "tend";

const PAD = 2;
const CHIPS = ["intent", "shape", "facts", "questions", "skills", "watch", "agents"] as const;

// ---- pure ----

// Also hides a block still streaming in, before its closing fence.
export function stripCards(text: string): string {
  return text.replace(CARD_RE, "").replace(/```card[\s\S]*$/, "").trimEnd();
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
    questions: list(c.questions, (q): q is { q: string; options: string[] } =>
      str(q?.q) && Array.isArray(q.options) && q.options.every(str),
    ),
    skills: list(c.skills, (k): k is { name: string; outcome: string } =>
      str(k?.name) && str(k.outcome),
    ),
    watch: list(c.watch, (w): w is { label: string; open: string; see?: string } =>
      str(w?.label) && str(w.open),
    ),
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

/** An agent's pane as a card: intent, outcome, where to look, the facts it rests on; the full
 * report one click further. */
export function agentRows(v: AgentView, name: string, id: string): Item[][] {
  const label = (word: string) => note(`note:${word}`, word.padEnd(9));
  const section = (word: string, items: Item[]) => items.map((it, i) => [label(i ? "" : word), it]);
  const outcome = v.card.outcome || v.returned || firstLine(v.body.replace(/^#.*$/gm, ""));
  return [
    ...section("intent", [line(`probe:${name} intent`, v.card.intent || v.asked)].filter((i) => i.label)),
    ...section("outcome", outcome ? [line(`probe:${name} outcome`, outcome)] : []),
    ...section("watch", [...new Set([...v.footprint, ...links(v.body)])].map((f) => line(`open:${f}`, placeName(f)))),
    ...section("facts", (v.card.facts ?? []).map((f, i) => line(`probe:${name} fact ${i + 1}`, `• ${bareFact(f)}`))),
    ...section("report", v.body ? [quiet(`report:${id}`, "read it all")] : []),
  ];
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
  if (name === "questions") return `questions ${(s.card.questions ?? []).filter((q) => !s.answered.has(q.q)).length}`;
  return `${name} ${chipRows(name, s).length}`;
}

/** A card's lines; each inner list is one row the arrows move along. */
export function cardRows(
  c: Card,
  name: string,
  answered: Set<string>,
  ran: Set<string>,
): Item[][] {
  if (name === "intent" || name === "shape")
    // Each sentence its own paragraph, set in from the pane's edge.
    return c[name] ? [[under(line(`probe:${name}`, sentences(c[name]!).join("\n\n")))]] : [];
  if (name === "facts")
    return spaced(
      (c.facts ?? []).map((f, i) => {
        const [head, rest] = factParts(f);
        return [[line(`probe:fact ${i + 1}`, `• ${head}`)], ...(rest ? [[under(note(`fact-note:${i}`, rest))]] : [])];
      }),
    );
  if (name === "questions")
    return spaced(
      (c.questions ?? []).flatMap((q, i) =>
        answered.has(q.q)
          ? []
          : [[[line(`probe:q${i + 1}`, `• ${q.q}`)], ...q.options.map((o, j) => [under(line(`answer:${i}:${j}`, `◦ ${o}`))])]],
      ),
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
export type Shown = { card: Card; answered: Set<string>; ran: Set<string>; rows: Row[]; paneItem: string | null };

/** The chip a pane item belongs to: a card's own, or agents for an agent's card or report. */
export function paneChip(paneItem: string | null): string | undefined {
  const [kind, ...rest] = (paneItem ?? "").split(":");
  return kind === "card" ? rest.join(":") : kind === "agent" || kind === "report" ? "agents" : undefined;
}

/** The rows a chip opens: the card's, or the session's agents. */
export function chipRows(name: string, s: Shown): Item[][] {
  return name === "agents"
    ? s.rows.map((r) => [agentItem(r, s.paneItem)])
    : cardRows(s.card, name, s.answered, s.ran);
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
let paneItem: string | null = null;
let lastPaneItem: string | null = null;
const answered = new Set<string>();
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

// ---- effects ----

async function registerCommands($: any) {
  await $.command.register({
    name: "cards",
    description: "Reopen the pane",
    immediate: true,
  });
}

async function readSession($: any) {
  const msgs: Msg[] = await $.session.messages();
  const next = latestCard(msgs);
  if (JSON.stringify(next) !== JSON.stringify(card)) planMoved = true;
  card = next;
  $.ui.invalidate("ui.render");
}

/** Runs a detached step; a failure is shown, never swallowed, and never breaks the hook that started it. */
function loud($: any, p: Promise<unknown>) {
  p.catch((err: unknown) => $.ui.toast(`tend: ${err instanceof Error ? err.message : String(err)}`));
}

/** The session this module now serves. `/clear` and a resume raise no `session.start`, so the
 * id is read at each use; a new one resets what the old session left in memory. */
async function sid($: any): Promise<string> {
  const id: string = await $.session.id();
  if (sessionId && id !== sessionId) reset();
  sessionId = id;
  return id;
}

// A reload wipes module memory; the store keeps which skills ran, which questions got answers,
// and which teammates sit idle.
async function remember($: any) {
  await sid($);
  await $.store.set(`tend:${sessionId}:ran`, [...ran]);
  await $.store.set(`tend:${sessionId}:answered`, [...answered]);
  await $.store.set(`tend:${sessionId}:idle`, [...idle]);
}

async function recall($: any) {
  await sid($);
  for (const r of ((await $.store.get(`tend:${sessionId}:ran`)) as string[]) ?? []) ran.add(r);
  for (const a of ((await $.store.get(`tend:${sessionId}:answered`)) as string[]) ?? []) answered.add(a);
  for (const i of ((await $.store.get(`tend:${sessionId}:idle`)) as string[]) ?? []) idle.add(i);
}

// Finished agents drop out of $.agent.list(); the store keeps them for the session.
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
  const stored = rows.length ? [] : (((await $.store.get(`tend:${sessionId}`)) as Row[]) ?? []);
  // Memory first, read after every await: a flag set a moment ago by another hook stands.
  const kept: Row[] = rows.length ? rows : stored;
  const next = [
    ...listed.map((l) => ({ ...kept.find((k) => k.id === l.id), ...l })),
    ...kept
      .filter((k) => !listed.some((l) => l.id === k.id))
      .map((k) => ({ ...k, done: true })),
  ];
  if (JSON.stringify(next) === JSON.stringify(rows)) return;
  rows = next;
  await $.store.set(`tend:${sessionId}`, rows);
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
    await $.store.set(`tend:${sessionId}`, rows);
  }
  $.ui.invalidate("ui.render");
  await shown;
}

async function openTarget($: any, target: string) {
  if (target.startsWith("pane:")) return showPane($, `file:${target.slice(5)}`);
  if (/\.(md|markdown)$/i.test(target) && !target.includes("://"))
    return showPane($, `file:${target}`);
  const run = (argv: string[]) =>
    $.process.run(argv, { timeoutMs: 10000 }).catch((err: unknown) => ({ exitCode: -1, stderr: String(err) }));
  // A source file opens in VS Code (`code`), else by the system's default, as does everything else.
  const inEditor = isSourceFile(target) && (await run(["code", "-g", target])).exitCode === 0;
  if (!inEditor && (await run(["open", target])).exitCode !== 0) $.ui.toast(`can't open ${target}`);
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
  return CARD_SKILLS.has(skill) ? [CARD_FORMAT] : [];
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

function reset() {
  // The old session's agents can linger in `$.agent.list()`; they are never this session's.
  for (const r of rows) gone.add(r.id);
  card = {};
  rows = [];
  paneItem = null;
  lastPaneItem = null;
  answered.clear();
  ran.clear();
  idle.clear();
  views.clear();
  paneText.clear();
  typedFrom.clear();
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
    if (q) await fill($, `q${i + 1}: ${q.options[j]} — `);
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
    if (e.origin.kind !== "composer") return withContext(asked);
    // A sent `q2: …` answers question 2.
    const q = card.questions?.[Number(e.text.match(/^q(\d+):/)?.[1]) - 1];
    if (q) {
      answered.add(q.q);
      await remember($);
      $.ui.invalidate("ui.render");
    }
    if (asked.length || !Object.keys(card).length) return withContext(asked);
    return withContext([`Only if this turn settles or changes what the card holds:\n${CARD_FORMAT}`]);
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
      const nextSkill = planMoved && card.skills?.find((k) => !hasRun(ran, k.name));
      planMoved = false;
      // A suggestion made while the turn is live never shows.
      nextCmd = (nextSkill && (await slash($, nextSkill.name))) || undefined;
      const cmd = nextCmd;
      if (cmd) $.clock.after(1500, () => loud($, $.prompt.suggest({ text: cmd })));
    }
    return r;
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
    const text = stripCards(e.props.text);
    if (text === e.props.text) return next(e);
    if (!text.trim()) {
      const { Box } = $.ui.resolve(e);
      return <Box />;
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
        await recall($);
        await registerCommands($);
        await readSession($);
        await readAgents($);
      })());
    }
    const els = $.ui.resolve(e);
    // Surfaces with no Client (mobile, the editor's panel) keep their own band.
    if (!("Client" in els)) return next(e);
    const { Box, Client } = els;
    const band = bandModel({ card, paneItem, answered, ran, rows });
    if (!band.chips.length) return <Box />;
    return (
      <Box>
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
              [{ id: "title", label: kind === "card" ? rest : (rest.split("/").pop() ?? rest), kind: "title" }, close],
              [],
              ...(kind === "card"
                ? chipRows(rest, { card, answered, ran, rows, paneItem })
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
