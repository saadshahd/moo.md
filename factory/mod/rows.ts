import { render, total, type Wait } from "../lib/formats.ts";
import { STUCK_LABEL, factoryComments, issueOf, latest, type Actors } from "../lib/github.ts";
import { undone, type Snapshot } from "../lib/snapshot.ts";
import { answerTo, openWait } from "../lib/wait.ts";

export type WaitRow = {
  waitId: number;
  issue: number;
  title: string;
  wait: Wait;
  /** The text of the plan the wait asks approval for; null when it asks none. */
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
  /** What GitHub listed only in part, so the tabs may miss rows. */
  truncated: string[];
};

export function rows(s: Snapshot, a: Actors): Rows {
  const reversed = undone(s, a);

  /** A wait stays listed until an answer lands, even before the worker writes it into the wait. */
  const waits = s.issues.flatMap((i): WaitRow[] => {
    const w = openWait(i.comments, a);

    if (w === null || answerTo(i.comments, a, w) !== null) return [];

    const plan = factoryComments(i.comments, a).flatMap(({ c }) =>
      c.kind === "plan" && c.seal === w.c.approves ? [c.text] : [],
    );

    return [
      {
        waitId: w.id,
        issue: i.number,
        title: i.title,
        wait: w.c,
        plan:
          w.c.approves === null
            ? null
            : (plan.at(-1) ?? `plan ${w.c.approves.slice(0, 8)} is not on this issue`),
      },
    ];
  });

  const stuck = s.issues.flatMap((i) =>
    i.labels.includes(STUCK_LABEL)
      ? [
          {
            issue: i.number,
            title: i.title,
            url: i.url,
            reason: latest(i.comments, a, "stuck")?.c.reason ?? "no reason posted",
          },
        ]
      : [],
  );

  const calls = s.issues.flatMap((i) => {
    const urls = new Map(i.comments.map((c) => [c.id, c.url]));

    return factoryComments(i.comments, a).flatMap(({ id, c }) =>
      c.kind === "call" && !reversed.has(id)
        ? [
            {
              callId: id,
              issue: i.number,
              url: urls.get(id) ?? i.url,
              choice: c.choice,
              picked: c.picked,
              others: c.others,
              why: c.why,
              undo: c.undo,
            },
          ]
        : [],
    );
  });

  const costs = s.merged.flatMap((pr) => {
    const cost = issueOf(pr.head) === null ? null : latest(pr.comments, a, "cost");

    return cost === null ? [] : [{ pr: pr.number, tokens: total(cost.c) }];
  });

  return {
    questions: waits.filter((w) => w.plan === null),
    plans: waits.filter((w) => w.plan !== null),
    stuck,
    calls,
    costs,
    truncated: s.truncated,
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
    body: render({
      kind: "undo",
      call: call.callId,
      text: [
        `A factory run on #${call.issue} made this call without asking: ${call.url}`,
        `Picked: ${call.picked}`,
        `To undo: ${call.undo}`,
      ].join("\n\n"),
    }),
  };
}
