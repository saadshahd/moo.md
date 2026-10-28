import { render, total, type Call, type Wait } from "../lib/formats.ts";
import {
  STUCK_LABEL,
  factoryComments,
  issueOf,
  latest,
  type Actors,
} from "../lib/github.ts";
import { holdLine, waitsFor } from "../lib/holds.ts";
import { trustedIssue, undone, type Snapshot } from "../lib/snapshot.ts";
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

/** An issue the factory holds, and what it waits for. */
export type HeldRow = {
  issue: number;
  title: string;
  url: string;
  line: string;
};

export type CallRow = Call & { callId: number; url: string };

export type Rows = {
  questions: WaitRow[];
  plans: WaitRow[];
  held: HeldRow[];
  stuck: StuckRow[];
  calls: CallRow[];
  costs: { pr: number; tokens: number }[];
  /** Mean tokens per merged factory PR; null before the first. */
  avg: number | null;
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
            : (plan.at(-1) ??
              `plan ${w.c.approves.slice(0, 8)} is not on this issue`),
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
            reason:
              latest(i.comments, a, "stuck")?.c.reason ?? "no reason posted",
          },
        ]
      : [],
  );

  const held = s.issues.flatMap((i) => {
    const h = trustedIssue(i, a) && !i.labels.includes(STUCK_LABEL) ? waitsFor(i, s, a) : null;

    return h === null ? [] : [{ issue: i.number, title: i.title, url: i.url, line: holdLine(h) }];
  });

  const calls = s.issues.flatMap((i) => {
    const urls = new Map(i.comments.map((c) => [c.id, c.url]));

    return factoryComments(i.comments, a).flatMap(({ id, c }) =>
      c.kind === "call" && !reversed.has(id)
        ? [{ ...c, callId: id, url: urls.get(id) ?? i.url }]
        : [],
    );
  });

  const costs = s.merged.flatMap((pr) => {
    const cost =
      issueOf(pr.head) === null ? null : latest(pr.comments, a, "cost");

    return cost === null ? [] : [{ pr: pr.number, tokens: total(cost.c) }];
  });

  return {
    questions: waits.filter((w) => w.plan === null),
    plans: waits.filter((w) => w.plan !== null),
    held,
    stuck,
    calls,
    costs,
    avg:
      costs.length === 0
        ? null
        : costs.reduce((sum, c) => sum + c.tokens, 0) / costs.length,
    truncated: s.truncated,
  };
}

/** A token count short enough for a tab: 950, 12k, 1.2M. */
export function tokens(n: number): string {
  if (n < 1_000) return String(Math.round(n));

  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;

  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function undoIssue(call: CallRow) {
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
