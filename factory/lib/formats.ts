// The comments a factory run leaves on GitHub, which is the factory's only store. Each starts
// with a marker line `<!-- factory:<kind> {json} -->` that carries the fields; the text under it
// is for a person on github.com. The pane reads rows from `parse`; the run side writes with `render`.

export type Plan = {
  kind: "plan";
  issue: number;
  /** sha256 of the plan text, hex. */
  seal: string;
  /** The seal the human approved; the plan stands approved only while it equals `seal`. */
  approved: string | null;
  text: string;
};

/** A choice the run made without asking, which the human can reverse. */
export type Call = {
  kind: "call";
  issue: number;
  choice: string;
  picked: string;
  /** What reversing the call takes. */
  undo: string;
};

/** One question a run asks, with the choices it offers and why it asks. */
export type Question = {
  question: string;
  why: string;
  options: string[];
};

/**
 * Questions a run asked the human, answered on the issue; the run waits with its turn ended until
 * `answers` is set, one per question.
 */
export type Wait = {
  kind: "wait";
  issue: number;
  questions: Question[];
  answers: string[] | null;
};

/** The human's answers to the wait comment `wait`, one per question, posted from anywhere. */
export type Answer = {
  kind: "answer";
  issue: number;
  wait: number;
  answers: string[];
};

/** What the next session needs to go on: what is left, and a step cut off mid-run. */
export type Handoff = {
  kind: "handoff";
  issue: number;
  text: string;
};

/** Tokens a run spent, read from its transcripts, posted on its PR. */
export type Cost = {
  kind: "cost";
  issue: number;
  pr: number;
  sessions: string[];
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
};

export type Restart = {
  kind: "restart";
  issue: number;
  reason: "crash" | "context";
  session: string;
};

export type Stuck = {
  kind: "stuck";
  issue: number;
  reason: string;
};

export type FactoryComment =
  Plan | Call | Wait | Answer | Handoff | Cost | Restart | Stuck;

export type Kind = FactoryComment["kind"];

const KINDS: readonly Kind[] = [
  "plan",
  "call",
  "wait",
  "answer",
  "handoff",
  "cost",
  "restart",
  "stuck",
];

const MARKER = /^<!-- factory:([a-z]+) (\{.*\}) -->\n?/;

/** Fields that ride in the marker; long text rides in the body, so `--` in it never ends the marker. */
function head(c: FactoryComment) {
  switch (c.kind) {
    case "plan":
      return { issue: c.issue, seal: c.seal, approved: c.approved };
    case "handoff":
      return { issue: c.issue };
    default: {
      const { kind: _, ...rest } = c;

      return rest;
    }
  }
}

function body(c: FactoryComment): string {
  switch (c.kind) {
    case "plan":
      return `**Plan** · seal \`${c.seal.slice(0, 8)}\` · ${
        c.approved === c.seal ? "approved" : "waiting for approval"
      }\n\n${c.text}`;
    case "call":
      return `**Call** · ${c.choice}\n\nPicked: ${c.picked}\n\nTo undo: ${c.undo}`;
    case "wait":
      return c.questions
        .map(
          (q, i) =>
            `**Waiting for you** · ${q.question}\n\nWhy: ${q.why}\n\nChoices: ${q.options.join(" · ")}${
              c.answers === null ? "" : `\n\nAnswer: ${c.answers[i] ?? ""}`
            }`,
        )
        .join("\n\n---\n\n");
    case "answer":
      return `**Answer** · ${c.answers.join(" · ")}`;
    case "handoff":
      return `**Handoff**\n\n${c.text}`;
    case "cost":
      return `**Cost** · ${total(c).toLocaleString("en-US")} tokens: ${c.input} input, ${c.cacheRead} cache read, ${c.cacheWrite} cache write, ${c.output} output, over ${c.sessions.length} session(s)`;
    case "restart":
      return `**Restarted** · ${c.reason === "crash" ? "the run died" : "its context passed the cap"}; a fresh session goes on from the plan, branch and handoff`;
    case "stuck":
      return `**Stuck** · ${c.reason}`;
  }
}

/** Every token the run spent, of every kind. */
export function total(c: Cost): number {
  return c.input + c.cacheRead + c.cacheWrite + c.output;
}

/** The comment body for `c`: its marker line, then the text a person reads. */
export function render(c: FactoryComment): string {
  // A `-->` inside a field would end the marker early; JSON escapes `>` so it can't.
  const json = JSON.stringify(head(c)).replace(/>/g, "\\u003e");

  return `<!-- factory:${c.kind} ${json} -->\n${body(c)}`;
}

/** The factory comment `text` holds, or null when it is anyone else's comment. */
export function parse(text: string): FactoryComment | null {
  const m = MARKER.exec(text);

  if (!m) return null;
  const kind = KINDS.find((k) => k === m[1]);

  if (kind === undefined) return null;
  let fields: ReturnType<typeof head>;

  try {
    // SAFETY: only render() writes a marker, and it writes head() of a comment of this kind.
    fields = JSON.parse(m[2]!) as ReturnType<typeof head>;
  } catch {
    return null;
  }

  const rest = text.slice(m[0].length);

  switch (kind) {
    case "plan":
      return {
        // SAFETY: a plan's marker holds head() of a plan: issue, seal, approved.
        ...(fields as Omit<Plan, "kind" | "text">),
        kind,
        text: rest.replace(/^\*\*Plan\*\*[^\n]*\n\n/, ""),
      };
    case "handoff":
      return {
        // SAFETY: a handoff's marker holds head() of a handoff: its issue.
        ...(fields as Omit<Handoff, "kind" | "text">),
        kind,
        text: rest.replace(/^\*\*Handoff\*\*\n\n/, ""),
      };
    default:
      // SAFETY: every other kind's marker holds all its fields but `kind`, which the marker names.
      return { ...fields, kind } as FactoryComment;
  }
}

/** Whether `text` is a comment the factory wrote, of any kind. */
export function isFactory(text: string): boolean {
  return parse(text) !== null;
}

/** The question a run asks to have its plan approved, naming the seal it asks about. */
export function approvalQuestion(issue: number, seal: string): string {
  return `Approve plan ${seal.slice(0, 8)} for #${issue}?`;
}

export const APPROVE = "Approve";

/** The seal prefix and issue an approval question names, or null for any other question. */
export function parseApprovalQuestion(
  q: string,
): { issue: number; seal8: string } | null {
  const m = /^Approve plan ([0-9a-f]{8}) for #(\d+)\?$/.exec(q.trim());

  return m ? { seal8: m[1]!, issue: Number(m[2]) } : null;
}
