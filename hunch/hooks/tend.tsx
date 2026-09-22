import type { Register } from "claude-code";
import type { Band, Item } from "./band.tsx";

export type Card = {
  intent?: string;
  shape?: string;
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
export type Row = { id: string; label: string; done: boolean };

export const CARD_FORMAT = `End your reply with a \`\`\`card JSON block of what it settled; omit unchanged keys, [] clears a list:
{"intent":"…","shape":"…","facts":["…"],"questions":[{"q":"…","options":["…"]}],"skills":[{"name":"hope:…","outcome":"…"}],"watch":[{"label":"…","open":"url|path|pane:path","see":"…"}]}
facts: bare claims; one that settles a choice names what lost. skills: the planned skills in order. watch: where a human looks and what should appear there, never agent state.
The user cites items by 1-based position: \`fact 2: …\`, \`q1: <option> — …\`.`;
const CARD_SKILLS = new Set([
  "hope:intent",
  "hope:shape",
  "hope:clarify",
  "hope:elicit",
  "hope:draft",
  "hope:compose",
]);
const CARD_RE = /```card[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*\n?/g;
const BOX_LINES = 6;
const PANE = "tend";
const CHIPS = ["intent", "shape", "facts", "questions", "skills", "watch"] as const;

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

/** Items a card shows; 0 hides its chip. */
export function cardCount(
  c: Card,
  name: string,
  answered: Set<string>,
): number {
  if (name === "intent" || name === "shape") return c[name] ? 1 : 0;
  if (name === "facts") return c.facts?.length ?? 0;
  if (name === "questions")
    return (c.questions ?? []).filter((q) => !answered.has(q.q)).length;
  if (name === "skills") return c.skills?.length ?? 0;
  if (name === "watch") return c.watch?.length ?? 0;
  return 0;
}

export function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

/** A chip's label with the one number that previews its card: how many, or skills run of planned. */
export function chipLabel(c: Card, name: string, answered: Set<string>, ran: Set<string>): string {
  if (name === "intent" || name === "shape") return name;
  if (name === "skills") {
    const planned = c.skills ?? [];
    return `skills ${planned.filter((k) => hasRun(ran, k.name)).length}/${planned.length}`;
  }
  return `${name} ${cardCount(c, name, answered)}`;
}

/** A card's lines; each inner list is one row the arrows move along. */
export function cardRows(
  c: Card,
  name: string,
  answered: Set<string>,
  ran: Set<string>,
): Item[][] {
  const line = (id: string, label: string): Item => ({ id, label, kind: "line" });
  const quiet = (id: string, label: string): Item => ({ id, label, kind: "quiet" });
  const note = (id: string, label: string): Item => ({ id, label, kind: "note" });
  if (name === "intent" || name === "shape")
    return c[name] ? [[line(`probe:${name}`, c[name]!)]] : [];
  if (name === "facts")
    return (c.facts ?? []).map((f, i) => [line(`probe:fact ${i + 1}`, bareFact(f))]);
  if (name === "questions")
    return (c.questions ?? []).flatMap((q, i) =>
      answered.has(q.q)
        ? []
        : [[line(`probe:q${i + 1}`, q.q), ...q.options.map((o, j) => quiet(`answer:${i}:${j}`, o))]],
    );
  if (name === "skills")
    return (c.skills ?? []).map((k, i) => [
      { ...line(`skill:${i}`, k.name), ...(hasRun(ran, k.name) ? { mark: "done" as const } : {}) },
      note(`skill-note:${i}`, k.outcome),
    ]);
  if (name === "watch")
    return (c.watch ?? []).map((w, i) => [
      line(`watch:${i}`, w.label),
      ...(w.see ? [note(`watch-note:${i}`, w.see)] : []),
      quiet(`probe:watch ${i + 1}`, "?"),
    ]);
  return [];
}

export function bandModel(s: {
  card: Card;
  open: string | null;
  paneItem: string | null;
  answered: Set<string>;
  ran: Set<string>;
  rows: Row[];
}): Band {
  const count = (n: string) => cardCount(s.card, n, s.answered);
  return {
    chips: CHIPS.filter((n) => count(n) > 0).map((n) => ({
      id: `chip:${n}`,
      label: chipLabel(s.card, n, s.answered, s.ran),
      kind: "chip",
      // Client props refuse undefined, so an unmarked chip has no key at all.
      ...(s.open === n || s.paneItem === `card:${n}` ? { mark: "open" as const } : {}),
    })),
    body: s.open && count(s.open) > 0 ? cardRows(s.card, s.open, s.answered, s.ran) : [],
    agents: s.rows.map((r) => ({
      id: `agent:${r.id}`,
      label: clip(r.label),
      kind: "agent",
      mark: r.done ? "done" : "running",
    })),
  };
}

// ---- state ----

let card: Card = {};
let rows: Row[] = [];
let open: string | null = null;
let paneItem: string | null = null;
let lastPaneItem: string | null = null;
const answered = new Set<string>();
const ran = new Set<string>();
// The plan moved this turn (new card, or a skill ran): only then suggest the next skill.
let planMoved = false;
let nextCmd: string | undefined;
const paneText = new Map<string, string>();
const paneHead = new Map<string, string>();
// What each opened agent was asked: a wrong brief is the cheapest thing to catch.
const briefs = new Map<string, string>();
let started = false;
let sessionId = "";
// Bumped per fill: the Client redraws under a new key, handing the keys back to the prompt.
let fills = 0;

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

// A reload wipes module memory; the store keeps which skills ran and which questions got answers.
async function remember($: any) {
  sessionId ||= await $.session.id();
  await $.store.set(`tend:${sessionId}:ran`, [...ran]);
  await $.store.set(`tend:${sessionId}:answered`, [...answered]);
}

async function recall($: any) {
  for (const r of ((await $.store.get(`tend:${sessionId}:ran`)) as string[]) ?? []) ran.add(r);
  for (const a of ((await $.store.get(`tend:${sessionId}:answered`)) as string[]) ?? []) answered.add(a);
}

// Finished agents drop out of $.agent.list(); the store keeps them until opened.
async function readAgents($: any) {
  const kept: Row[] = ((await $.store.get(`tend:${sessionId}`)) as Row[]) ?? [];
  const opened: string[] = ((await $.store.get(`tend:${sessionId}:opened`)) as string[]) ?? [];
  const listed: Row[] = ((await $.agent.list()) as any[])
    .filter((a) => !a.parentId && a.type !== "teammate" && !opened.includes(a.id))
    .map((a) => ({
      id: a.id,
      label: a.name ?? a.description,
      done: a.status !== "running" && a.status !== "pending",
    }));
  const next = [
    ...listed.map((l) => ({ ...kept.find((k) => k.id === l.id), ...l })),
    ...kept
      .filter((k) => !listed.some((l) => l.id === k.id))
      .map((k) => ({ ...k, done: true })),
  ];
  if (JSON.stringify(next) === JSON.stringify(rows)) return;
  rows = next;
  await $.store.set(`tend:${sessionId}`, rows);
  $.ui.invalidate("ui.render");
}

async function openAgent($: any, id: string) {
  const r = rows.find((x) => x.id === id);
  const msgs: Msg[] = await $.session.messages({ agentId: id });
  const ask = msgs.find((m) => m.role === "user" && m.text.trim());
  if (ask) briefs.set(`agent:${id}`, firstLine(ask.text));
  if (r?.done) {
    const last = [...msgs].reverse().find((m) => m.role === "assistant" && m.text.trim());
    paneText.set(`agent:${id}`, last?.text ?? "_no result_");
    paneHead.set(`agent:${id}`, r.label);
    rows = rows.filter((x) => x.id !== id);
    const opened: string[] = ((await $.store.get(`tend:${sessionId}:opened`)) as string[]) ?? [];
    await $.store.set(`tend:${sessionId}:opened`, [...opened, id]);
    await $.store.set(`tend:${sessionId}`, rows);
  }
  await showPane($, `agent:${id}`);
}

async function openTarget($: any, target: string) {
  if (target.startsWith("pane:")) return showPane($, `file:${target.slice(5)}`);
  if (/\.(md|markdown)$/i.test(target) && !target.includes("://"))
    return showPane($, `file:${target}`);
  const r = await $.process
    .run(["open", target], { timeoutMs: 10000 })
    .catch((err: unknown) => ({ exitCode: -1, stderr: String(err) }));
  if (r.exitCode !== 0) $.ui.toast(`can't open ${target}`);
}

async function showPane($: any, item: string) {
  paneItem = item;
  lastPaneItem = item;
  // Open before reading: an open answering the press is placed at any width.
  const opened = $.ui.open({ id: PANE, title: "tend", focus: true, closeOnEscape: true });
  if (item.startsWith("file:"))
    await $.fs.read(item.slice(5)).then(
      (t: any) => paneText.set(item, typeof t === "string" ? t : String(t?.text ?? "")),
      (err: unknown) => paneText.set(item, `_${String(err)}_`),
    );
  $.ui.invalidate("ui.render");
  const r = await opened;
  if (!r.isPlaced) $.ui.toast(r.reason);
}

async function slash($: any, name: string): Promise<string | undefined> {
  const names = ((await $.command.list()) as { name: string }[]).map((c) => c.name);
  const cmd = commandFor(names, name);
  return cmd && `/${cmd} `;
}

// A stem the user finishes and sends as their own words.
async function fill($: any, text: string) {
  // A second press of the same line leaves the box as it is.
  const box = await $.prompt.read().catch(() => undefined);
  if (typeof box?.text === "string" && box.text.trimEnd().endsWith(text.trimEnd())) return;
  const f = await $.prompt.fill({ text, mode: "insert" });
  if (f.isFilled) fills++;
  else await $.prompt.suggest({ text });
}

function reset() {
  card = {};
  rows = [];
  open = null;
  paneItem = null;
  lastPaneItem = null;
  answered.clear();
  ran.clear();
  planMoved = false;
  nextCmd = undefined;
}

// What a press or Enter on a band or pane item does.
async function act($: any, id: string) {
  const [kind, ...rest] = id.split(":");
  const arg = rest.join(":");
  if (kind === "chip") {
    if (open !== arg && cardCount(card, arg, answered) > BOX_LINES) {
      open = null;
      await showPane($, `card:${arg}`);
    } else open = open === arg ? null : arg;
  } else if (kind === "probe") await fill($, `${arg}: `);
  else if (kind === "answer") {
    const [i, j] = rest.map(Number);
    const q = card.questions?.[i];
    if (q) {
      answered.add(q.q);
      await remember($);
      await fill($, `q${i + 1}: ${q.options[j]} — `);
    }
  } else if (kind === "skill") {
    const k = card.skills?.[Number(arg)];
    const cmd = k && (await slash($, k.name));
    cmd ? await fill($, cmd) : $.ui.toast(`no command ${k?.name ?? ""}`);
  } else if (kind === "watch") {
    const w = card.watch?.[Number(arg)];
    if (w) await openTarget($, w.open);
  } else if (kind === "agent") await openAgent($, arg);
  $.ui.invalidate("ui.render");
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    sessionId = await $.session.id();
    await registerCommands($);
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

  on("skill.prompt", async ($, e, next) => {
    const r = await next(e);
    if (!e.agentId) {
      ran.add(e.skill);
      planMoved = true;
      await remember($);
    }
    return CARD_SKILLS.has(e.skill)
      ? { text: `${r.text}\n\n${CARD_FORMAT}` }
      : r;
  });

  // The engine's own guess would replace the plan's next skill; the plan wins.
  on("prompt.suggest", async ($, e, next) =>
    e.origin.kind === "suggestion" && nextCmd ? next({ ...e, text: nextCmd }) : next(e),
  );

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) await readAgents($);
    else {
      await readSession($);
      const nextSkill = planMoved && card.skills?.find((k) => !hasRun(ran, k.name));
      planMoved = false;
      // A suggestion made while the turn is live never shows.
      nextCmd = (nextSkill && (await slash($, nextSkill.name))) || undefined;
      const cmd = nextCmd;
      if (cmd) $.clock.after(1500, () => void $.prompt.suggest({ text: cmd }));
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

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e);
    if (!started) {
      started = true;
      void (async () => {
        sessionId = await $.session.id();
        await registerCommands($);
        await recall($);
        await readSession($);
        await readAgents($);
        $.clock.every(2000, () => void readAgents($));
      })();
    }
    const { Box, Client } = $.ui.resolve(e);
    const band = bandModel({ card, open, paneItem, answered, ran, rows });
    if (!band.chips.length && !band.agents.length) return <Box />;
    return (
      <Box>
        <Client key={`band-${fills}`} module="./band.tsx" props={band} width={e.props.bodyColumns} />
      </Box>
    );
  });

  on("ui.message", async ($, e, next) => {
    const act_ = (e.data as { act?: unknown } | undefined)?.act;
    if (typeof act_ === "string") await act($, act_);
    return next(e);
  });

  on("ui.render", { component: "Pane" }, ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const { Box, Text, Markdown, Client } = $.ui.resolve(e);
    const item = paneItem ?? "";
    const kind = item.slice(0, item.indexOf(":"));
    const rest = item.slice(kind.length + 1);
    const head =
      kind === "agent"
        ? (paneHead.get(item) ?? rows.find((r) => r.id === rest)?.label ?? "agent")
        : kind === "card"
          ? rest
          : rest.split("/").pop();
    const body =
      kind === "card" ? (
        <Client
          key={`pane-card-${fills}`}
          module="./band.tsx"
          width={e.props.bodyColumns}
          props={{ chips: [], body: cardRows(card, rest, answered, ran), agents: [] }}
        />
      ) : kind === "agent" && !paneText.has(item) ? (
        <Text dimColor>running</Text>
      ) : (
        <Markdown
          key="pane-md"
          text={tablesToLists(paneText.get(item) ?? "")}
          onLinkPress={(link) =>
            void openTarget($, link.href.replace(/^file:\/\//, ""))
          }
        />
      );
    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text dimColor>{head}</Text>
        {briefs.has(item) ? <Text dimColor wrap="truncate-end">asked: {briefs.get(item)}</Text> : <Box />}
        {body}
      </Box>
    );
  });
};
