// What /factory shows, read from GitHub alone: one GraphQL query per refresh, turned into rows.
// Every machine running the factory sees the same rows, since none of them come from a local store.

import { parse, total } from "../lib/formats.ts";
import { issueOf } from "../lib/github.ts";

// A copy of worker/cli.ts's STUCK_LABEL: cli.ts spawns processes through Bun, which a hooks
// module can't load. Raised on #63 to move the label into lib/.
export const STUCK_LABEL = "factory:stuck";

/** The label on an issue the pane opened to reverse a call; the worker never picks it up. */
export const UNDO_LABEL = "factory:undo";

export const QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    work: issues(labels: ["factory"], first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number title url state
        labels(first: 20) { nodes { name } }
        comments(last: 50) { nodes { databaseId body url } }
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

/** The answer to QUERY, as `gh api graphql` prints it. */
export type Snapshot = {
  data: {
    repository: {
      work: Nodes<{
        number: number;
        title: string;
        url: string;
        state: "OPEN" | "CLOSED";
        labels: Nodes<{ name: string }>;
        comments: Nodes<{ databaseId: number; body: string; url: string }>;
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

export type StuckRow = {
  issue: number;
  title: string;
  url: string;
  reason: string;
};

export type CallRow = {
  /** The call comment's id, which its undo issue names. */
  id: number;
  issue: number;
  url: string;
  choice: string;
  picked: string;
  undo: string;
};

export type CostRow = { pr: number; tokens: number };

export type Rows = { stuck: StuckRow[]; calls: CallRow[]; costs: CostRow[] };

/** The line an undo issue's body carries, naming the call it reverses. */
export const undoLine = (callId: number) => `Undoes factory call ${callId}.`;

/** The call ids the undo issues in `bodies` reverse. */
export function undone(bodies: readonly string[]): Set<number> {
  return new Set(
    bodies.flatMap((b) => {
      const m = /Undoes factory call (\d+)\./.exec(b);

      return m ? [Number(m[1])] : [];
    }),
  );
}

export function rows(s: Snapshot): Rows {
  const { work, undos, merged } = s.data.repository;
  const reversed = undone(undos.nodes.map((u) => u.body));

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
          id: c.databaseId,
          issue: i.number,
          url: c.url,
          choice: call.choice,
          picked: call.picked,
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

  return { stuck, calls, costs };
}

/** The mean tokens per merged PR, or null before any factory PR merged with its cost. */
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

/** The issue that reverses `call`: the worker skips it until the user labels it for the factory. */
export function undoIssue(call: CallRow): UndoIssue {
  return {
    title: `Undo: ${call.choice}`,
    body: [
      `A factory run on #${call.issue} made this call without asking: ${call.url}`,
      `Picked: ${call.picked}`,
      `To undo: ${call.undo}`,
      undoLine(call.id),
    ].join("\n\n"),
  };
}
