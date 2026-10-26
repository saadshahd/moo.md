import { STUCK_LABEL, latest, issueOf, type Comment } from "../lib/github.ts";
import { parse, parseApprovalQuestion, total, type Question } from "../lib/formats.ts";
import { answerTo, openWait } from "../lib/wait.ts";

/** The label on an issue the pane opened to reverse a call; the worker never picks it up. */
export const UNDO_LABEL = "factory:undo";

/** Everything the pane shows, in one query: no machine's local state, so every machine agrees. */
export const QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    work: issues(labels: ["factory"], first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number title url state
        labels(first: 20) { nodes { name } }
        comments(last: 50) { nodes { databaseId body url createdAt authorAssociation author { login } } }
      }
    }
    undos: issues(labels: ["${UNDO_LABEL}"], first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes { body }
    }
    merged: pullRequests(states: MERGED, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number headRefName comments(last: 20) { nodes { body } } }
    }
  }
}`;

type Nodes<T> = { nodes: T[] };

export type Snapshot = {
  data: {
    repository: {
      work: Nodes<{
        number: number;
        title: string;
        url: string;
        state: "OPEN" | "CLOSED";
        labels: Nodes<{ name: string }>;
        comments: Nodes<{
          databaseId: number;
          body: string;
          url: string;
          createdAt: string;
          authorAssociation: string;
          author: { login: string } | null;
        }>;
      }>;
      undos: Nodes<{ body: string }>;
      merged: Nodes<{
        number: number;
        headRefName: string;
        comments: Nodes<{ body: string }>;
      }>;
    };
  };
};

export type WaitRow = {
  waitId: number;
  issue: number;
  title: string;
  questions: Question[];
  plan: string | null;
};

export type StuckRow = {
  issue: number;
  title: string;
  url: string;
  reason: string;
};

export type CallRow = {
  callId: number;
  issue: number;
  url: string;
  choice: string;
  picked: string;
  others: string[];
  why: string;
  undo: string;
};

export type CostRow = { pr: number; tokens: number };

export type Rows = {
  questions: WaitRow[];
  plans: WaitRow[];
  stuck: StuckRow[];
  calls: CallRow[];
  costs: CostRow[];
};

const undoFormat = (id: string) => `Undoes factory call ${id}.`;

export const undoLine = (callId: number) => undoFormat(String(callId));

const ID = "\u0000";

const UNDO_LINE = new RegExp(
  undoFormat(ID)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(ID, "(\\d+)"),
);

export function undone(bodies: readonly string[]): Set<number> {
  return new Set(
    bodies.flatMap((b) => {
      const m = UNDO_LINE.exec(b);

      return m ? [Number(m[1])] : [];
    }),
  );
}

export function rows(s: Snapshot): Rows {
  const { work, undos, merged } = s.data.repository;
  const reversed = undone(undos.nodes.map((u) => u.body));

  /** A wait stays listed until an answer lands, even before the worker writes it into the wait. */
  const waits = work.nodes.flatMap((i): WaitRow[] => {
    if (i.state !== "OPEN") return [];

    const cs: Comment[] = i.comments.nodes.map((c) => ({
      id: c.databaseId,
      body: c.body,
      author: c.author?.login ?? "",
      createdAt: c.createdAt,
      association: c.authorAssociation,
    }));

    const w = openWait(cs);

    if (w === null || answerTo(cs, w.id, w.c.questions.length) !== null) return [];
    const asksApproval = w.c.questions.some((q) => parseApprovalQuestion(q.question) !== null);

    return [
      {
        waitId: w.id,
        issue: i.number,
        title: i.title,
        questions: w.c.questions,
        plan: asksApproval ? (latest(cs, "plan")?.c.text ?? "") : null,
      },
    ];
  });

  const stuck = work.nodes.flatMap((i) => {
    if (
      i.state !== "OPEN" ||
      !i.labels.nodes.some((l) => l.name === STUCK_LABEL)
    )
      return [];

    const said = i.comments.nodes
      .map((c) => parse(c.body))
      .findLast((c) => c?.kind === "stuck");

    return [
      {
        issue: i.number,
        title: i.title,
        url: i.url,
        reason: said?.kind === "stuck" ? said.reason : "no reason posted",
      },
    ];
  });

  const calls = work.nodes.flatMap((i) =>
    i.comments.nodes.flatMap((c) => {
      const call = parse(c.body);

      if (call?.kind !== "call" || reversed.has(c.databaseId)) return [];

      return [
        {
          callId: c.databaseId,
          issue: i.number,
          url: c.url,
          choice: call.choice,
          picked: call.picked,
          others: call.others,
          why: call.why,
          undo: call.undo,
        },
      ];
    }),
  );

  const costs = merged.nodes.flatMap((pr) => {
    if (issueOf(pr.headRefName) === null) return [];

    const cost = pr.comments.nodes
      .map((c) => parse(c.body))
      .findLast((c) => c?.kind === "cost");

    return cost?.kind === "cost"
      ? [{ pr: pr.number, tokens: total(cost) }]
      : [];
  });

  return {
    questions: waits.filter((w) => w.plan === null),
    plans: waits.filter((w) => w.plan !== null),
    stuck,
    calls,
    costs,
  };
}

export function perPr(costs: readonly CostRow[]): number | null {
  if (costs.length === 0) return null;

  return costs.reduce((sum, c) => sum + c.tokens, 0) / costs.length;
}

/** A token count short enough for a tab: 950, 12k, 1.2M. */
export function tokens(n: number): string {
  if (n < 1_000) return String(Math.round(n));

  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;

  return `${(n / 1_000_000).toFixed(1)}M`;
}

export type UndoIssue = { title: string; body: string };

export function undoIssue(call: CallRow): UndoIssue {
  return {
    title: `Undo: ${call.choice}`,
    body: [
      `A factory run on #${call.issue} made this call without asking: ${call.url}`,
      `Picked: ${call.picked}`,
      `To undo: ${call.undo}`,
      undoLine(call.callId),
    ].join("\n\n"),
  };
}
