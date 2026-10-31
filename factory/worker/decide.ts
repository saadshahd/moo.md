/**
 * What the worker does each tick, as data: each local issue's state, the actions that state
 * takes, and which waiting issues to start. Pure: `apply` in act.ts is the only edge.
 */

import { holder, parse, type FactoryComment, type HeldOn, type Wait } from "../lib/formats.ts";
import { branchFor, factoryComments, fromBot, issueOf, STUCK_LABEL, type Actors, type Comment } from "../lib/github.ts";
import { failed, heldOn, heldSince, holdLine, planHold, postedPlan, prHold, type Hold } from "../lib/holds.ts";
import { HANDOFF_PATH, planFiles } from "../lib/plan.ts";
import { RULES_PATH, type Rules } from "../lib/rules.ts";
import { LABEL, trustedIssue, type Issue, type OpenPr, type Pr, type Review, type Snapshot } from "../lib/snapshot.ts";
import { answerMessage, answerTo, openWait } from "../lib/wait.ts";

export const CRASHES_BEFORE_STUCK = 3;

/** Review wakes a run gets between retries; the next actionable review marks the issue stuck. */
export const REVIEW_ROUNDS = 2;

/** `failed`: its process died and would not respawn. `claude stop` leaves it failed. */
export const SESSION_STATES = ["working", "blocked", "done", "stopped", "failed"] as const;

export type SessionState = (typeof SESSION_STATES)[number];

/** A run's session, with what its transcript says. */
export type RunView = {
  id: string;
  sessionId: string;
  state: SessionState;
  /** Tokens the newest turn read as context. */
  context: number;
  /** It asked in its own question box and got no answer. */
  pendingAsk: boolean;
  /** Epoch seconds when a usage-limit refusal resets, while that refusal is its newest reply. */
  rejectedUntil: number | null;
};

/** An issue with a worktree on this machine. */
export type Local = {
  issue: number;
  path: string;
  /** The worktree's plan file, if written. */
  plan: string | null;
  /** Its sessions, oldest first. */
  runs: RunView[];
};

export type World = {
  /** Epoch milliseconds. */
  now: number;
  gh: Snapshot;
  actors: Actors;
  rules: Rules;
  local: Local[];
  /** Claimed branches whose claim commit this machine pushed. */
  claimedHere: ReadonlySet<number>;
  /** Issues with a `factory/<n>` worktree here that this machine never claimed: never acted on. */
  foreign: readonly number[];
};

export type IssueState =
  | { kind: "ended"; why: "closed" | "stuck" | "untrusted"; pr: Pick<Pr, "number" | "state"> | null }
  /** Its open PR changes the rules file, which only a person changes. */
  | { kind: "rulesChanged"; pr: number }
  | { kind: "overCap" }
  | { kind: "working" }
  | { kind: "askedInBox" }
  | { kind: "waiting"; wait: { id: number; c: Wait }; answers: string[] | null }
  | { kind: "prOpen"; pr: number }
  | { kind: "prMerged"; pr: number }
  | { kind: "prClosedUnmerged"; pr: number }
  | { kind: "checksFailed"; pr: number; deaths: number }
  /** The worker updates the branch itself, at the head it saw. */
  | { kind: "behind"; pr: number; head: string; base: string }
  /** `deaths` counts the wakes that left the PR conflicting while the base stayed at `baseSha`. */
  | { kind: "conflicting"; pr: number; base: string; baseSha: string; deaths: number }
  /** A trusted review asks for changes; `rounds` counts review wakes since the last retry. */
  | { kind: "reviewed"; pr: number; review: Review; rounds: number }
  | { kind: "limited"; until: number }
  | { kind: "limitReset" }
  /** `posted` once the issue records a plan hold for the current session. */
  | { kind: "held"; on: Extract<Hold, { kind: "pr" | "plan" | "red" }>; posted: boolean }
  /** What held the current session's plan is gone. */
  | { kind: "released" }
  /** A person ran `claude stop` on it; `posted` once the issue says so. */
  | { kind: "stoppedByHand"; session: string; posted: boolean }
  | { kind: "crashed"; deaths: number };

type Ended = Extract<IssueState, { kind: "ended" }>;

/**
 * The comment an ended issue's open PR closes with. A stuck issue keeps its PR: closed after the
 * stuck comment, `livePr` would read it as closed since the retry, and the retry would mark the
 * issue stuck again.
 */
const CLOSES_PR = {
  closed: (n: number) => `Issue #${n} was closed or lost its ${LABEL} label, so the factory closed this PR.`,
  untrusted: (n: number) => `Issue #${n} was labelled or edited by someone the factory does not trust, so the factory closed this PR.`,
  stuck: null,
} as const satisfies Record<Ended["why"], ((n: number) => string) | null>;

const RULES_CHANGED = `This PR changes ${RULES_PATH}, and only a person changes the factory's rules, so the factory closed it.`;

/**
 * Whether open PR `p` changes the rules file. A PR changing more files than one page lists is
 * left to the worker's check of who last changed the rules on the base.
 */
const changesRules = (p: OpenPr | undefined) => p?.files?.includes(RULES_PATH) ?? false;

/** Why a listed issue is over for the factory, or null while it goes on. */
function endedWhy(i: Issue, a: Actors): "stuck" | "untrusted" | null {
  if (i.labels.includes(STUCK_LABEL)) return "stuck";

  return trustedIssue(i, a) ? null : "untrusted";
}

/** Which session an action stops or wakes: `claude stop` takes `id`, `--resume` takes `sessionId`. */
export type RunId = Pick<RunView, "id" | "sessionId">;

export type Action =
  | { kind: "claim"; issue: number }
  | { kind: "start"; issue: number; restart: "crash" | "context" | "held" | null; after: string | null }
  | { kind: "stop"; issue: number; run: RunId }
  | {
      kind: "wake";
      issue: number;
      run: RunId;
      message: string;
      restart: { reason: "checks" } | { reason: "conflict"; baseSha: string } | { reason: "review"; review: number } | null;
    }
  | { kind: "updateBranch"; issue: number; pr: number; head: string }
  | { kind: "postHeld"; issue: number; on: HeldOn }
  | { kind: "closeWait"; issue: number; wait: { id: number; c: Wait }; answers: string[] }
  | { kind: "markStuck"; issue: number; reason: string }
  | { kind: "postCost"; issue: number; pr: number; sessions: string[] }
  | { kind: "postStopped"; issue: number; session: string }
  | { kind: "closePr"; issue: number; pr: number; reason: string }
  | { kind: "removeWorktree"; issue: number };

/** The states each state's actions can lead to; `gone` is a removed worktree. */
export const NEXT = {
  ended: ["gone"],
  rulesChanged: ["ended"],
  overCap: ["working"],
  working: ["working"],
  askedInBox: ["ended"],
  waiting: ["waiting", "working"],
  prOpen: ["prOpen", "behind"],
  prMerged: ["prMerged"],
  prClosedUnmerged: ["ended"],
  checksFailed: ["working", "ended"],
  behind: ["behind"],
  conflicting: ["working", "ended"],
  reviewed: ["working", "ended"],
  limited: ["limited"],
  limitReset: ["working"],
  held: ["held"],
  released: ["working"],
  stoppedByHand: ["stoppedByHand"],
  crashed: ["working", "ended"],
} satisfies { [K in IssueState["kind"]]: readonly (IssueState["kind"] | "gone")[] };

/** The factory comments since the issue was last marked stuck: removing the label is a retry. */
function sinceRetry(cs: readonly Comment[], a: Actors): FactoryComment[] {
  const fs = factoryComments(cs, a).map((x) => x.c);

  return fs.slice(fs.findLastIndex((c) => c.kind === "stuck") + 1);
}

/** Restarts after a death, and wakes for failed checks, since the last retry. */
export function deathsSinceRetry(cs: readonly Comment[], a: Actors): number {
  return sinceRetry(cs, a).filter((c) => c.kind === "restart" && (c.reason === "crash" || c.reason === "checks")).length;
}

/** Wakes to merge the base in, since the last retry, that were for base commit `sha`. */
const conflictWakes = (cs: readonly Comment[], a: Actors, sha: string) =>
  sinceRetry(cs, a).filter((c) => c.kind === "restart" && c.reason === "conflict" && c.baseSha === sha).length;

/** The reviews `fs` woke a run for, one per review wake. */
const reviewsIn = (fs: readonly FactoryComment[]) =>
  fs.flatMap((c) => (c.kind === "restart" && c.reason === "review" ? [c.review] : []));

/** The reviews woken for since the last retry, one per review wake. */
const reviewWakes = (cs: readonly Comment[], a: Actors) => reviewsIn(sinceRetry(cs, a));

/**
 * The newest review the run should answer: a trusted person's, commenting or asking for changes
 * (an approval stands, and a push would dismiss it), saying something, its author not approving
 * since, and not woken for since the last retry. One woken for before the retry counts again
 * only on the PR's head: a push since then answered it.
 */
function actionableReview(pr: Pr, cs: readonly Comment[], a: Actors): Review | null {
  const woken = new Set(reviewWakes(cs, a));
  const ever = new Set(reviewsIn(factoryComments(cs, a).map((x) => x.c)));

  return (
    pr.reviews.findLast(
      (r, i) =>
        r.author !== null &&
        a.trusted.includes(r.author) &&
        (r.state === "COMMENTED" || r.state === "CHANGES_REQUESTED") &&
        (r.body.trim() !== "" || r.comments.length > 0) &&
        !pr.reviews.slice(i + 1).some((later) => later.author === r.author && later.state === "APPROVED") &&
        !woken.has(r.id) &&
        (!ever.has(r.id) || r.commit === pr.headSha),
    ) ?? null
  );
}

/** The issue's PR, unless it was closed unmerged before the issue was last marked stuck. */
function livePr(pr: Pr | undefined, cs: readonly Comment[], a: Actors): Pr | null {
  if (pr === undefined) return null;
  const stuckAt = cs.findLast((c) => fromBot(c, a) && parse(c.body)?.kind === "stuck")?.createdAt ?? "";

  return pr.state === "CLOSED" && (pr.closedAt ?? "") < stuckAt ? null : pr;
}

export function classify(l: Local, w: World): IssueState {
  const issue = w.gh.issues.find((i) => i.number === l.issue);

  const ended = (why: Ended["why"]): IssueState => {
    const pr = w.gh.prs.get(l.issue);

    return { kind: "ended", why, pr: pr === undefined ? null : { number: pr.number, state: pr.state } };
  };

  if (issue === undefined) return ended("closed");
  const why = endedWhy(issue, w.actors);

  if (why !== null) return ended(why);
  const own = w.gh.open.find((p) => p.number === w.gh.prs.get(l.issue)?.number);

  if (own !== undefined && changesRules(own)) return { kind: "rulesChanged", pr: own.number };
  const current = l.runs.at(-1);
  const cs = issue.comments;

  if (current?.state === "working")
    return current.context > w.rules.contextCap ? { kind: "overCap" } : { kind: "working" };

  if (current?.pendingAsk) return { kind: "askedInBox" };
  const wait = openWait(cs, w.actors);

  if (wait !== null && current !== undefined)
    return { kind: "waiting", wait, answers: answerTo(cs, w.actors, wait)?.answers ?? null };
  const pr = livePr(w.gh.prs.get(l.issue), cs, w.actors);

  const deaths = deathsSinceRetry(cs, w.actors) + (current === undefined ? 0 : 1);

  if (pr?.state === "MERGED") return { kind: "prMerged", pr: pr.number };

  if (pr?.state === "CLOSED") return { kind: "prClosedUnmerged", pr: pr.number };

  if (pr !== null) {
    const hold = prHold(pr, w.gh.base);
    const stopped = current === undefined || current.state === "stopped" || current.state === "failed";

    if (hold?.kind === "conflict")
      return {
        kind: "conflicting",
        pr: pr.number,
        base: hold.base,
        baseSha: w.gh.base.sha,
        deaths: deathsSinceRetry(cs, w.actors) + conflictWakes(cs, w.actors, w.gh.base.sha),
      };
    const review = actionableReview(pr, cs, w.actors);

    if (review !== null) return { kind: "reviewed", pr: pr.number, review, rounds: reviewWakes(cs, w.actors).length };

    switch (hold?.kind) {
      case "behind":
        return stopped ? { kind: "behind", pr: pr.number, head: pr.headSha, base: hold.base } : { kind: "prOpen", pr: pr.number };
      case "red":
        return { kind: "held", on: hold, posted: false };
      case undefined:
        return failed(pr.checks) ? { kind: "checksFailed", pr: pr.number, deaths } : { kind: "prOpen", pr: pr.number };
    }
  }

  /** The worker stops a run only to restart it, and names it in the restart it posts first. */
  const fs = factoryComments(cs, w.actors).map((x) => x.c);

  if (current?.state === "stopped" && !fs.some((c) => c.kind === "restart" && c.session === current.sessionId))
    return {
      kind: "stoppedByHand",
      session: current.sessionId,
      posted: fs.some((c) => c.kind === "stopped" && c.session === current.sessionId),
    };

  if (current?.rejectedUntil != null)
    return current.rejectedUntil * 1000 > w.now
      ? { kind: "limited", until: current.rejectedUntil }
      : { kind: "limitReset" };

  const on = planHold(l.issue, planFiles(l.plan ?? postedPlan(issue, w.actors)?.text ?? ""), w.gh, w.actors);

  const stoppedOn = heldSince(cs, w.actors);

  if (on !== null)
    return { kind: "held", on, posted: stoppedOn !== null && holder(stoppedOn) === holder(heldOn(on)) };
  const until = limitedUntil(w);

  if (until !== null) return { kind: "limited", until };

  if (stoppedOn !== null && current !== undefined) return { kind: "released" };

  return { kind: "crashed", deaths };
}

/** The newest usage-limit reset still ahead, across every run here: one account, one limit. */
export function limitedUntil(w: World): number | null {
  const ahead = w.local
    .flatMap((l) => l.runs.map((r) => r.rejectedUntil ?? 0))
    .filter((s) => s * 1000 > w.now);

  return ahead.length === 0 ? null : Math.max(...ahead);
}

/** The wake for a review: its words and inline comments, then what to fix and how to answer it. */
function reviewMessage(n: number, s: Extract<IssueState, { kind: "reviewed" }>, catchUp: string): string {
  const body = s.review.body.trim();
  const inline = s.review.comments.map((c) => `${c.path}${c.line === null ? "" : `:${c.line}`}: ${c.body.trim()}`);

  return [
    `A review on PR #${s.pr} asks for changes.`,
    ...(body === "" ? [] : [body.split("\n").map((line) => `> ${line}`).join("\n")]),
    ...(inline.length === 0 ? [] : [`Inline comments:\n${inline.join("\n")}`]),
    `${catchUp} Fix what is in the scope of issue #${n}, and list the rest as follow-ups in ${HANDOFF_PATH}.`,
    `Then push, then reply once on the PR (\`gh pr comment ${s.pr}\`) with what changed and what was left.`,
  ].join("\n\n");
}

export function actionsFor(s: IssueState, l: Local): Action[] {
  const n = l.issue;
  const current = l.runs.at(-1);

  const stop: Action[] =
    current === undefined || current.state === "stopped" ? [] : [{ kind: "stop", issue: n, run: current }];

  const cost = (pr: number): Action => ({ kind: "postCost", issue: n, pr, sessions: l.runs.map((r) => r.sessionId) });
  const stuck = (reason: string): Action[] => [...stop, { kind: "markStuck", issue: n, reason }];

  const start = (restart: Extract<Action, { kind: "start" }>["restart"]): Action => ({
    kind: "start",
    issue: n,
    restart,
    after: current?.sessionId ?? null,
  });

  /** `--resume` wakes a failed run, which no stop can end, without its flags: a new run takes its place. */
  const wake = (message: string, restart: Extract<Action, { kind: "wake" }>["restart"] = null): Action[] =>
    current === undefined
      ? []
      : current.state === "failed"
        ? [start("crash")]
        : [{ kind: "wake", issue: n, run: current, message, restart }];

  /** The worker may have merged the base into the branch on GitHub, so the run's copy is behind it. */
  const catchUp = `First run \`git fetch origin\` and \`git merge origin/${branchFor(n)}\`: merge, never rebase or force-push.`;

  switch (s.kind) {
    case "ended": {
      const comment = CLOSES_PR[s.why];

      const close: Action[] =
        s.pr?.state === "OPEN" && comment !== null ? [{ kind: "closePr", issue: n, pr: s.pr.number, reason: comment(n) }] : [];

      return [...stop, ...(s.pr === null ? [] : [cost(s.pr.number)]), ...close, { kind: "removeWorktree", issue: n }];
    }

    case "rulesChanged":
      return [
        ...stop,
        { kind: "closePr", issue: n, pr: s.pr, reason: RULES_CHANGED },
        { kind: "markStuck", issue: n, reason: `its PR #${s.pr} changed ${RULES_PATH}` },
      ];
    case "overCap":
      return [...stop, start("context")];
    case "working":
    case "limited":
      return [];
    case "held":
      return s.posted || s.on.kind === "red" || current === undefined
        ? []
        : [{ kind: "postHeld", issue: n, on: heldOn(s.on) }];
    case "released":
      return [...stop, start("held")];
    case "stoppedByHand":
      return s.posted ? [] : [{ kind: "postStopped", issue: n, session: s.session }];
    case "askedInBox":
      return stuck("the run asked in its own question box, which nobody watches");
    case "waiting":
      return s.answers === null || current === undefined
        ? []
        : [
            { kind: "closeWait", issue: n, wait: s.wait, answers: s.answers },
            ...wake(answerMessage(s.wait.c, s.answers)),
          ];
    case "prOpen":
    case "prMerged":
      return [cost(s.pr), ...stop];
    case "prClosedUnmerged":
      return stuck(`its PR #${s.pr} was closed without merging`);
    case "checksFailed":
      return s.deaths >= CRASHES_BEFORE_STUCK || current === undefined
        ? stuck(`the checks on PR #${s.pr} failed ${s.deaths} times`)
        : wake(`The checks on PR #${s.pr} failed. ${catchUp} Read them with \`gh pr checks ${s.pr}\`, fix and push.`, {
            reason: "checks",
          });
    case "reviewed":
      if (s.rounds >= REVIEW_ROUNDS) return stuck(`PR #${s.pr} got a third review round`);

      return current === undefined
        ? stuck(`a review on PR #${s.pr} asks for changes, and no session of its run is left to wake`)
        : wake(reviewMessage(n, s, catchUp), { reason: "review", review: s.review.id });
    case "behind":
      return [cost(s.pr), { kind: "updateBranch", issue: n, pr: s.pr, head: s.head }];
    case "conflicting":
      return s.deaths >= CRASHES_BEFORE_STUCK || current === undefined
        ? stuck(`PR #${s.pr} still conflicts with ${s.base} after its run was woken ${s.deaths} times to merge ${s.base} in`)
        : wake(
            `PR #${s.pr} conflicts with ${s.base}. ${catchUp} Then run \`git merge origin/${s.base}\`. Resolve the conflicts, run the checks locally, then push.`,
            { reason: "conflict", baseSha: s.baseSha },
          );
    case "limitReset":
      return wake("Your usage limit has reset. Go on with the work.");
    case "crashed":
      return s.deaths >= CRASHES_BEFORE_STUCK
        ? stuck(`the run died or ended without a PR ${s.deaths} times`)
        : [...stop, start(current === undefined ? null : "crash")];
  }
}

/** Whether the state holds one of the `atOnce` slots after its actions. */
export function occupies(s: IssueState): boolean {
  switch (s.kind) {
    case "working":
    case "overCap":
    case "waiting":
    case "limitReset":
    case "released":
      return true;
    case "checksFailed":
    case "conflicting":
    case "crashed":
      return s.deaths < CRASHES_BEFORE_STUCK;
    case "reviewed":
      return s.rounds < REVIEW_ROUNDS;
    case "ended":
    case "rulesChanged":
    case "askedInBox":
    case "prOpen":
    case "prMerged":
    case "prClosedUnmerged":
    case "behind":
    case "limited":
    case "held":
    case "stoppedByHand":
      return false;
  }
}

/** The worker's log line for a state: it logs one each time an issue's line changes. */
export function stateLine(s: IssueState): string {
  switch (s.kind) {
    case "ended":
      return `ended: ${s.why}${s.pr === null ? "" : `, PR #${s.pr.number}`}`;
    case "rulesChanged":
      return `PR #${s.pr} changes ${RULES_PATH}`;
    case "overCap":
      return "its context passed the cap";
    case "working":
      return "working";
    case "askedInBox":
      return "asked in its own question box";
    case "waiting":
      return s.answers === null ? "waiting for an answer on the issue" : "answered on the issue";
    case "prOpen":
      return `PR #${s.pr} open`;
    case "prMerged":
      return `PR #${s.pr} merged`;
    case "prClosedUnmerged":
      return `PR #${s.pr} closed without merging`;
    case "checksFailed":
      return `checks failed on PR #${s.pr} (${s.deaths} of ${CRASHES_BEFORE_STUCK})`;
    case "behind":
      return holdLine({ kind: "behind", pr: s.pr, base: s.base });
    case "conflicting":
      return `${holdLine({ kind: "conflict", pr: s.pr, base: s.base })} (${s.deaths} of ${CRASHES_BEFORE_STUCK})`;
    case "reviewed":
      return `a review on PR #${s.pr} asks for changes (${s.rounds} of ${REVIEW_ROUNDS} review rounds used)`;
    case "limited":
      return `usage limit until ${new Date(s.until * 1000).toISOString()}`;
    case "limitReset":
      return "usage limit reset";
    case "held":
      return holdLine(s.on);
    case "released":
      return "what held it is gone; a fresh session goes on";
    case "stoppedByHand":
      return "stopped by hand";
    case "crashed":
      return `died or ended without a PR (${s.deaths} of ${CRASHES_BEFORE_STUCK})`;
  }
}

/**
 * Whether `i` may start here now: trusted, unblocked, held by no open PR or earlier plan, and
 * unclaimed or claimed by this machine.
 */
function startable(i: Issue, w: World): { resume: boolean; planned: boolean } | null {
  if (!trustedIssue(i, w.actors) || i.blocked) return null;
  const plan = postedPlan(i, w.actors);

  if (plan !== null && planHold(i.number, planFiles(plan.text), w.gh, w.actors) !== null) return null;
  const planned = plan !== null;

  if (!w.gh.claimed.has(i.number)) return { resume: false, planned };

  return w.claimedHere.has(i.number) ? { resume: true, planned } : null;
}

/**
 * The issues to start, up to the free slots: unfinished ones (with a plan) first, then the
 * oldest. Nothing starts while a usage limit holds.
 */
export function pick(w: World): { issue: number; resume: boolean }[] {
  const local = new Set(w.local.map((l) => l.issue));
  const free = w.rules.atOnce - w.local.filter((l) => occupies(classify(l, w))).length;

  if (free <= 0 || limitedUntil(w) !== null) return [];

  return w.gh.issues
    .filter((i) => !local.has(i.number) && !i.labels.includes(STUCK_LABEL))
    .flatMap((i) => {
      const c = startable(i, w);

      return c === null ? [] : [{ issue: i.number, ...c }];
    })
    .sort((a, b) => Number(b.planned) - Number(a.planned) || a.issue - b.issue)
    .slice(0, free)
    .map(({ issue, resume }) => ({ issue, resume }));
}

/**
 * The bot's open `factory/<n>` PRs with no worktree here that must close: one changing the rules
 * file, or one whose issue was closed, unlabelled or lost its trust. A stuck issue's PR stays, as
 * it does for a local issue. Each machine decides from GitHub alone, so any one of them closes it.
 */
export function prsToClose(w: World): Action[] {
  const here = new Set([...w.local.map((l) => l.issue), ...w.foreign]);

  return w.gh.open.flatMap((p): Action[] => {
    const n = issueOf(p.head);

    if (n === null || here.has(n) || p.author !== w.actors.bot) return [];
    const issue = w.gh.issues.find((i) => i.number === n);
    const why = issue === undefined ? "closed" : endedWhy(issue, w.actors);
    const reason = changesRules(p) ? RULES_CHANGED : why === null ? null : CLOSES_PR[why]?.(n);

    return reason == null ? [] : [{ kind: "closePr", issue: n, pr: p.number, reason }];
  });
}

/** Every action this tick, grouped by issue: a group stops at its first failure. */
export function decide(w: World): Action[][] {
  return [
    ...w.local.map((l) => actionsFor(classify(l, w), l)),
    ...prsToClose(w).map((a) => [a]),
    ...pick(w).map(({ issue, resume }): Action[] => [
      ...(resume ? [] : [{ kind: "claim", issue } satisfies Action]),
      { kind: "start", issue, restart: null, after: null },
    ]),
  ];
}
