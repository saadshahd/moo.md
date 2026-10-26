/**
 * GitHub is the factory's only store. A factory comment is a marker line
 * `<!-- factory:<kind> {json} -->`, a heading for a person, and for some kinds a blank line and
 * long text. One codec per kind writes and reads it.
 */

import * as z from "./vendor/zod-mini.js";

const Issue = z.int().check(z.minimum(1));
const Id = z.int().check(z.minimum(1));
const Tokens = z.int().check(z.minimum(0));
const Seal = z.string().check(z.regex(/^[0-9a-f]{64}$/));

/** A why rides once, in its comment's marker or text, and never past this length. */
export const WHY_MAX = 2_000;
const Why = z.string().check(z.maxLength(WHY_MAX));

const Plan = z.object({
  kind: z.literal("plan"),
  issue: Issue,
  /** sha256 of `text`, hex. */
  seal: Seal,
  text: z.string(),
});

export type Plan = z.infer<typeof Plan>;

const Call = z.object({
  kind: z.literal("call"),
  issue: Issue,
  choice: z.string(),
  picked: z.string(),
  others: z.array(z.string()),
  why: Why,
  /** What reversing the call takes. */
  undo: z.string(),
});

export type Call = z.infer<typeof Call>;

const Question = z.object({
  question: z.string(),
  why: Why,
  options: z.array(z.string()),
});

export type Question = z.infer<typeof Question>;

/**
 * Questions a run asked the human, answered on the issue; the run waits with its turn ended.
 * `approves` names the plan seal its approval question asks about. `answers` is the worker's
 * record that the run got its answer, never itself an approval.
 */
const Wait = z.object({
  kind: z.literal("wait"),
  issue: Issue,
  questions: z.array(Question),
  approves: z.nullable(Seal),
  answers: z.nullable(z.array(z.string())),
});

export type Wait = z.infer<typeof Wait>;

/** A trusted person's answer to a wait; `approves` is the seal it approves, if any. */
const Answer = z.object({
  kind: z.literal("answer"),
  issue: Issue,
  wait: Id,
  answers: z.array(z.string()),
  approves: z.nullable(Seal),
});

export type Answer = z.infer<typeof Answer>;

const Handoff = z.object({
  kind: z.literal("handoff"),
  issue: Issue,
  text: z.string(),
});

export type Handoff = z.infer<typeof Handoff>;

/** Tokens a run spent, read from its transcripts, posted on its PR. */
const Cost = z.object({
  kind: z.literal("cost"),
  issue: Issue,
  pr: Issue,
  sessions: z.array(z.string()),
  input: Tokens,
  cacheRead: Tokens,
  cacheWrite: Tokens,
  output: Tokens,
});

export type Cost = z.infer<typeof Cost>;

const Restart = z.object({
  kind: z.literal("restart"),
  issue: Issue,
  reason: z.literal(["crash", "context", "checks"]),
  session: z.string(),
});

export type Restart = z.infer<typeof Restart>;

const Stuck = z.object({
  kind: z.literal("stuck"),
  issue: Issue,
  reason: z.string(),
});

export type Stuck = z.infer<typeof Stuck>;

/** The body of an issue a person opened to reverse call comment `call`. */
const Undo = z.object({
  kind: z.literal("undo"),
  call: Id,
  text: z.string(),
});

export type Undo = z.infer<typeof Undo>;

export type FactoryComment =
  Plan | Call | Wait | Answer | Handoff | Cost | Restart | Stuck | Undo;

export type Kind = FactoryComment["kind"];

/** Who may write a kind: the factory's bot, or a person the rules file trusts. */
export type Author = "bot" | "trusted";

type TextField<C> = {
  [K in Exclude<keyof C, "kind">]: C[K] extends string ? K : never;
}[Exclude<keyof C, "kind">];

type Spec = {
  by: Author;
  codec: z.ZodMiniType<FactoryComment, string>;
};

const MARKER = /^<!-- factory:([a-z]+) (\{.*\}) -->\n?/;

const lf = (s: string) => s.replace(/\r\n/g, "\n");

/** A heading is one paragraph, so the first blank line always ends it. */
const paragraph = (s: string) => s.replace(/\n{2,}/g, "\n");

function markerFields(body: string): object | null {
  const m = MARKER.exec(body);

  if (!m) return null;

  try {
    /** SAFETY: a JSON object; the kind's schema checks every field. */
    return { ...(JSON.parse(m[2]!) as object), kind: m[1] };
  } catch {
    return null;
  }
}

function textOf(body: string): string {
  const rest = body.replace(MARKER, "");
  const at = rest.indexOf("\n\n");

  return at < 0 ? "" : rest.slice(at + 2);
}

function kind<C extends FactoryComment>(
  schema: z.ZodMiniType<C, C>,
  by: Author,
  text: TextField<C> | null,
  show: (c: C) => string,
) {
  const codec = z.codec(z.string(), schema, {
    decode: (body) => {
      const fields = markerFields(body);

      /** SAFETY: unchecked here; the codec checks the result against `schema` next. */
      return (fields === null || text === null
        ? fields
        : { ...fields, [text]: textOf(body) }) as C;
    },
    encode: (c) => {
      const { kind: k, ...rest } = c;

      const fields = Object.fromEntries(
        Object.entries(rest).filter(([f]) => f !== text),
      );

      /** A `-->` inside a field would end the marker early; JSON escapes `>` so it can't. */
      const json = JSON.stringify(fields).replace(/>/g, "\\u003e");
      const head = `<!-- factory:${k} ${json} -->\n${paragraph(show(c))}`;

      return text === null ? head : `${head}\n\n${String(c[text])}`;
    },
  });

  return { by, codec };
}

const RESTARTED = {
  crash: "**Restarted** · the run died; a fresh session goes on from the plan, branch and handoff",
  context:
    "**Restarted** · its context passed the cap; a fresh session goes on from the plan, branch and handoff",
  checks: "**Woken** · its PR's checks failed after it ended its turn",
} satisfies { [R in Restart["reason"]]: string };

const CODECS = {
  plan: kind(
    Plan,
    "bot",
    "text",
    (c) => `**Plan** · seal \`${c.seal.slice(0, 8)}\``,
  ),
  call: kind(
    Call,
    "bot",
    "why",
    (c) =>
      `**Call** · ${c.choice}\nPicked: ${c.picked}${
        c.others.length === 0 ? "" : ` (not ${c.others.join(", not ")})`
      }\nTo undo: ${c.undo}`,
  ),
  wait: kind(Wait, "bot", null, (c) =>
    c.questions
      .map(
        (q, i) =>
          `**Waiting for you** · ${q.question}\nChoices: ${q.options.join(" · ")}${
            c.answers === null ? "" : `\nAnswer: ${c.answers[i] ?? ""}`
          }`,
      )
      .join("\n"),
  ),
  answer: kind(
    Answer,
    "trusted",
    null,
    (c) => `**Answer** · ${c.answers.join(" · ")}`,
  ),
  handoff: kind(Handoff, "bot", "text", () => "**Handoff**"),
  cost: kind(
    Cost,
    "bot",
    null,
    (c) =>
      `**Cost** · ${total(c).toLocaleString("en-US")} tokens: ${c.input} input, ${c.cacheRead} cache read, ${c.cacheWrite} cache write, ${c.output} output, over ${c.sessions.length} session(s)`,
  ),
  restart: kind(
    Restart,
    "bot",
    null,
    (c) => RESTARTED[c.reason],
  ),
  stuck: kind(Stuck, "bot", null, (c) => `**Stuck** · ${c.reason}`),
  undo: kind(
    Undo,
    "trusted",
    "text",
    (c) => `**Undo** · factory call ${c.call}`,
  ),
} satisfies {
  [C in FactoryComment as C["kind"]]: {
    by: Author;
    codec: z.ZodMiniType<C, string>;
  };
};

type Table = { [K in Kind]: Spec };

const TABLE: Table = CODECS;
const SPECS = new Map<string, Spec>(Object.entries(TABLE));

export function total(c: Cost): number {
  return c.input + c.cacheRead + c.cacheWrite + c.output;
}

/** GitHub refuses a comment body longer than this. */
export const BODY_MAX = 65_536;

/** Throws on a comment that breaks its kind's schema or GitHub's size limit, so none is posted. */
export function render(c: FactoryComment): string {
  const body = z.encode(TABLE[c.kind].codec, c);

  if (body.length > BODY_MAX)
    throw new Error(`a factory ${c.kind} comment of ${body.length} characters is over GitHub's ${BODY_MAX}`);

  return body;
}

/** The comment `body` holds, or null when it is no well-formed factory comment. */
export function parse(body: string): FactoryComment | null {
  const text = lf(body);
  const spec = SPECS.get(MARKER.exec(text)?.[1] ?? "");

  if (spec === undefined) return null;
  const r = z.safeDecode(spec.codec, text);

  return r.success ? r.data : null;
}

export function writer(kind: Kind): Author {
  return TABLE[kind].by;
}
