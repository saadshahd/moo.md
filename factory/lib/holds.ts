/**
 * What an issue waits for that GitHub alone shows, so the worker, a run's `plan` and the pane
 * agree on it and say it in the same words.
 */

import { branchFor, latest, STUCK_LABEL, type Actors } from "./github.ts";
import { overlap, overlappingPr, planFiles } from "./plan.ts";
import { trustedIssue, type Issue, type Merge, type Snapshot } from "./snapshot.ts";

export type Hold =
  | { kind: "pr"; pr: number; files: string[] }
  | { kind: "plan"; issue: number; files: string[] }
  | { kind: "red"; pr: number; base: string }
  | { kind: "behind"; pr: number; base: string }
  | { kind: "conflict"; pr: number; base: string };

type PlanHold = Extract<Hold, { kind: "pr" | "plan" }>;

type PrHold = Extract<Hold, { kind: "red" | "behind" | "conflict" }>;

export const failed = (checks: string | null) => checks === "FAILURE" || checks === "ERROR";

/** The issue's posted plan, and when its comment was posted: an edited plan keeps that time. */
export function postedPlan(i: Issue, a: Actors): { text: string; at: string } | null {
  const p = latest(i.comments, a, "plan");
  const at = i.comments.find((c) => c.id === p?.id)?.createdAt;

  return p === null || at === undefined ? null : { text: p.c.text, at };
}

/**
 * What holds issue `n`'s plan touching `files`: an open PR changing any of them, else the plan of
 * an open, trusted, unstuck issue posted before `n`'s and touching any. Posting time, then issue
 * number, orders plans strictly, so no two hold each other; a plan not yet posted comes last.
 */
export function planHold(n: number, files: readonly string[], s: Snapshot, a: Actors): PlanHold | null {
  const pr = overlappingPr(files, s.open, branchFor(n));

  if (pr !== null) return { kind: "pr", ...pr };

  const plans = s.issues.flatMap((i) => {
    const p = trustedIssue(i, a) && !i.labels.includes(STUCK_LABEL) ? postedPlan(i, a) : null;

    return p === null ? [] : [{ issue: i.number, at: p.at, files: planFiles(p.text) }];
  });

  const own = plans.find((p) => p.issue === n);

  const first = plans
    .filter((p) => p.issue !== n && (own === undefined || p.at < own.at || (p.at === own.at && p.issue < n)))
    .sort((x, y) => x.at.localeCompare(y.at) || x.issue - y.issue)
    .map((p) => ({ issue: p.issue, files: overlap(files, p.files) }))
    .find((p) => p.files.length > 0);

  return first === undefined ? null : { kind: "plan", ...first };
}

/** What an open PR waits for before it can merge; GitHub's UNKNOWN is no answer yet, so nothing. */
export function prHold(p: Merge & { number: number }, base: Snapshot["base"]): PrHold | null {
  const at = { pr: p.number, base: base.name };

  if (p.mergeable === "CONFLICTING" || p.mergeState === "DIRTY") return { kind: "conflict", ...at };

  if (p.mergeState === "BEHIND") return { kind: "behind", ...at };

  return failed(p.checks) && failed(base.checks) ? { kind: "red", ...at } : null;
}

/** What a trusted, unstuck issue waits for: its open PR's, else its posted plan's. */
export function waitsFor(i: Issue, s: Snapshot, a: Actors): Hold | null {
  const pr = s.open.find((p) => p.head === branchFor(i.number));

  if (pr !== undefined) return prHold(pr, s.base);
  const plan = postedPlan(i, a);

  return plan === null ? null : planHold(i.number, planFiles(plan.text), s, a);
}

export function holdLine(h: Hold): string {
  switch (h.kind) {
    case "pr":
      return `held until PR #${h.pr} merges: it also changes ${h.files.join(", ")}`;
    case "plan":
      return `held until #${h.issue} merges or ends: its plan, posted first, also touches ${h.files.join(", ")}`;
    case "red":
      return `held: ${h.base} is red, so PR #${h.pr}'s failed checks wait for it to go green`;
    case "behind":
      return `PR #${h.pr} is behind ${h.base}; the worker updates its branch`;
    case "conflict":
      return `PR #${h.pr} conflicts with ${h.base}; its run merges ${h.base} in`;
  }
}
