import { describe, expect, test } from "bun:test";
import { usage } from "../lib/commands.ts";
import { parse, render, type FactoryComment, type Plan, type Wait } from "../lib/formats.ts";
import { STUCK_LABEL, type Actors, type Comment } from "../lib/github.ts";
import { PLAN_PATH, PR_PATH, planGaps } from "../lib/plan.ts";
import { LABEL, UNDO_LABEL, type Check, type Issue, type Pr, type Review, type Snapshot } from "../lib/snapshot.ts";
import { APPROVAL_QUESTION } from "../lib/wait.ts";
import { prBody, prCreate, prMerge, prText, seal } from "./cli.ts";
import {
  actionsFor,
  classify,
  CRASHES_BEFORE_STUCK,
  decide,
  deathsSinceRetry,
  NEXT,
  occupies,
  pick,
  prsToClose,
  stateLine,
  type Action,
  type Local,
  type RunView,
  type World,
} from "./decide.ts";
import { runPrompt, type RunInput } from "./prompt.ts";
import { machineId, platformOf } from "./platform.ts";
import { checksReason, loginRefusal } from "./guard.ts";
import { pendingAsk, usage as usageOf } from "../lib/transcript.ts";
import { actorsOf, readRules, Rules, RULES_PATH, rulesChangedBy } from "../lib/rules.ts";
import { AGENTS_AT_TICK, AGENTS_LATER, ISSUES, OPEN_ASK, RULES as SMOKE_RULES } from "./fixtures/smoke1.ts";
import { run } from "./proc.ts";
import { claimIn, factoryWorktrees, runView, sessionsNamed, worktrees } from "./snapshot.ts";
import { createdPath, letGo, onBranch, worktreeFor } from "./act.ts";
import { ISSUE_5, PR_8 } from "./fixtures/smoke2.ts";
import { closePr, must, upsert, type Run } from "../lib/github.ts";
import { gitConfigEnv } from "../lib/bot.ts";
import { runSettings } from "./sandbox.ts";
import { chmod, mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const BOT = "moo-factory[bot]";
const ME = "owner";
const A: Actors = { bot: BOT, trusted: [ME] };
const NOW = Date.parse("2026-10-26T12:00:00Z");
const SEAL = "a".repeat(64);

const RULES: Rules = {
  atOnce: 2,
  waitsPerDay: 3,
  contextCap: 1000,
  bot: BOT,
  taste: ["CLAUDE.md"],
  layers: {
    check: [],
    plan: ["no classes"],
    judge: ["names read well"],
    none: [],
  },
};

let ids = 100;

const said = (
  body: string,
  author: string | null = ME,
  createdAt = "2026-10-26T10:00:00Z",
): Comment => ({
  id: ids++,
  body,
  author,
  editor: null,
  createdAt,
  url: "",
});

const posted = (c: FactoryComment, createdAt?: string) =>
  said(render(c), BOT, createdAt);

const issue = (n: number, more: Partial<Issue> = {}): Issue => ({
  number: n,
  title: `Issue ${n}`,
  url: "",
  body: "Do the thing.",
  author: ME,
  editor: null,
  labels: ["factory"],
  labelledBy: ME,
  blocked: false,
  comments: [],
  ...more,
});

const snapshot = (more: Partial<Snapshot> = {}): Snapshot => ({
  issues: [],
  open: [],
  prs: new Map(),
  claimed: new Set(),
  undos: [],
  merged: [],
  truncated: [],
  base: { name: "main", sha: "m1", checks: [] },
  ...more,
});

const session = (
  state: RunView["state"],
  more: Partial<RunView> = {},
): RunView => ({
  id: "s1",
  sessionId: "sid-1",
  state,
  context: 10,
  pendingAsk: false,
  rejectedUntil: null,
  ...more,
});

const here = (
  n: number,
  runs: RunView[] = [],
  plan: string | null = null,
): Local => ({
  issue: n,
  path: `/r.factory-${n}`,
  plan,
  runs,
});

const world = (
  gh: Snapshot,
  local: Local[],
  more: Partial<World> = {},
): World => ({
  now: NOW,
  gh,
  actors: A,
  rules: RULES,
  local,
  claimedHere: new Set(),
  foreign: [],
  ...more,
});

const pr = (n: number, more: Partial<Pr> = {}): Pr => ({
  number: 50 + n,
  head: `factory/${n}`,
  state: "OPEN",
  closedAt: null,
  checks: "PENDING",
  required: [],
  mergeable: "MERGEABLE",
  mergeState: "BLOCKED",
  headSha: "h1",
  comments: [],
  reviews: [],
  ...more,
});

const crash = (createdAt?: string) =>
  posted(
    { kind: "restart", issue: 7, reason: "crash", session: "s" },
    createdAt,
  );

const QUESTION = {
  question: "Which store?",
  why: "both fit",
  options: ["Map", "Array"],
};

const waitFor: Wait = {
  kind: "wait",
  issue: 7,
  questions: [QUESTION],
  approves: null,
  answers: null,
};

/** What each action does to the world, as far as classify can see it. */
function after(
  w: World,
  n: number,
  actions: readonly Action[],
): World | "gone" {
  let next = w;

  const local = (f: (l: Local) => Local) => ({
    ...next,
    local: next.local.map((l) => (l.issue === n ? f(l) : l)),
  });

  const setRun = (f: (r: RunView) => RunView) =>
    local((l) => ({
      ...l,
      runs: l.runs.map((r, i) => (i === l.runs.length - 1 ? f(r) : r)),
    }));

  for (const a of actions)
    switch (a.kind) {
      case "removeWorktree":
        return "gone";
      case "stop":
        next = setRun((r) => ({ ...r, state: "stopped" }));
        break;
      case "wake":
        next = setRun((r) => ({
          ...r,
          state: "working",
          pendingAsk: false,
          rejectedUntil: null,
        }));
        break;
      case "start":
        next = local((l) => ({
          ...l,
          runs: [
            ...l.runs,
            session("working", { id: "s2", sessionId: "sid-2", context: 0 }),
          ],
        }));
        break;
      case "closeWait":
        next = {
          ...next,
          gh: {
            ...next.gh,
            issues: next.gh.issues.map((i) =>
              i.number !== n
                ? i
                : {
                    ...i,
                    comments: i.comments.map((c) =>
                      c.id === a.wait.id
                        ? {
                            ...c,
                            body: render({ ...a.wait.c, answers: a.answers }),
                          }
                        : c,
                    ),
                  },
            ),
          },
        };
        break;
      case "markStuck":
        next = {
          ...next,
          gh: {
            ...next.gh,
            issues: next.gh.issues.map((i) =>
              i.number === n ? { ...i, labels: [...i.labels, STUCK_LABEL] } : i,
            ),
          },
        };
        break;
      case "closePr":
        next = {
          ...next,
          gh: {
            ...next.gh,
            prs: new Map([...next.gh.prs].map(([i, p]): [number, Pr] => [i, p.number === a.pr ? { ...p, state: "CLOSED", closedAt: "2026-10-26T12:00:00Z" } : p])),
            open: next.gh.open.filter((p) => p.number !== a.pr),
          },
        };
        break;
      case "postCost":
      case "claim":
      case "updateBranch":
        break;
      case "postHeld":
        next = {
          ...next,
          gh: {
            ...next.gh,
            issues: next.gh.issues.map((i) =>
              i.number === n ? { ...i, comments: [...i.comments, posted({ kind: "held", issue: n, on: a.on })] } : i,
            ),
          },
        };
        break;
    }

  return next;
}

/** Classifies the world's one local issue, checks its actions land in a NEXT state, and returns both. */
function step(w: World) {
  const l = w.local[0]!;
  const state = classify(l, w);
  const actions = actionsFor(state, l);
  const next = after(w, l.issue, actions);
  const landed = next === "gone" ? "gone" : classify(next.local[0]!, next).kind;

  const allowed: readonly string[] = NEXT[state.kind];

  expect(allowed).toContain(landed);

  return { state, actions };
}

const kinds = (as: readonly Action[]) => as.map((a) => a.kind);

describe("a local issue's state and actions", () => {
  test("an issue no longer open and labelled ends; its PR's cost goes on first", () => {
    const { state, actions } = step(
      world(snapshot({ prs: new Map([[7, pr(7, { state: "MERGED" })]]) }), [
        here(7, [session("done")]),
      ]),
    );

    expect(state).toEqual({ kind: "ended", why: "closed", pr: { number: 57, state: "MERGED" } });
    expect(kinds(actions)).toEqual(["stop", "postCost", "removeWorktree"]);
  });
  test("a stuck label, or a body a stranger edited, ends it", () => {
    expect(
      step(
        world(
          snapshot({
            issues: [issue(7, { labels: ["factory", STUCK_LABEL] })],
          }),
          [here(7)],
        ),
      ).state.kind,
    ).toBe("ended");

    const edited = step(
      world(snapshot({ issues: [issue(7, { editor: "stranger" })] }), [
        here(7, [session("working")]),
      ]),
    );

    expect(edited.state).toEqual({ kind: "ended", why: "untrusted", pr: null });
  });
  test("a working run goes on; past the context cap it restarts fresh", () => {
    const gh = snapshot({ issues: [issue(7)] });

    expect(step(world(gh, [here(7, [session("working")])])).actions).toEqual(
      [],
    );

    const over = step(
      world(gh, [here(7, [session("working", { context: 5000 })])]),
    );

    expect(over.state.kind).toBe("overCap");
    expect(over.actions[1]).toEqual({
      kind: "start",
      issue: 7,
      restart: "context",
      after: "sid-1",
    });
  });
  test("a question left in the run's own box marks the issue stuck", () => {
    const { state, actions } = step(
      world(snapshot({ issues: [issue(7)] }), [
        here(7, [session("blocked", { pendingAsk: true })]),
      ]),
    );

    expect(state.kind).toBe("askedInBox");
    expect(kinds(actions)).toEqual(["stop", "markStuck"]);
  });
  test("an answered wait closes first, then wakes the run with the answer", () => {
    const w = posted(waitFor);

    const open = step(
      world(snapshot({ issues: [issue(7, { comments: [w] })] }), [
        here(7, [session("blocked")]),
      ]),
    );

    expect(open.state).toMatchObject({ kind: "waiting", answers: null });
    expect(open.actions).toEqual([]);

    const answered = step(
      world(snapshot({ issues: [issue(7, { comments: [w, said("Map")] })] }), [
        here(7, [session("blocked")]),
      ]),
    );

    expect(kinds(answered.actions)).toEqual(["closeWait", "wake"]);
    expect(answered.actions[1]).toMatchObject({
      message: expect.stringContaining("Answer: Map"),
    });
  });
  test("an open PR holds no slot and gets its cost; a merged one too", () => {
    const gh = (p: Pr) =>
      snapshot({ issues: [issue(7)], prs: new Map([[7, p]]) });

    expect(
      kinds(step(world(gh(pr(7)), [here(7, [session("done")])])).actions),
    ).toEqual(["postCost", "stop"]);
    expect(
      step(
        world(gh(pr(7, { state: "MERGED" })), [here(7, [session("stopped")])]),
      ).state.kind,
    ).toBe("prMerged");
  });
  test("a PR closed unmerged marks the issue stuck; after a retry it is history", () => {
    const closed = pr(7, { state: "CLOSED", closedAt: "2026-10-26T09:00:00Z" });

    const first = world(
      snapshot({ issues: [issue(7)], prs: new Map([[7, closed]]) }),
      [here(7, [session("done")])],
    );

    expect(step(first).state.kind).toBe("prClosedUnmerged");

    const stuckLater = posted(
      { kind: "stuck", issue: 7, reason: "closed" },
      "2026-10-26T09:30:00Z",
    );

    const retried = world(
      snapshot({
        issues: [issue(7, { comments: [stuckLater] })],
        prs: new Map([[7, closed]]),
      }),
      [here(7, [session("done")])],
    );

    expect(step(retried).state.kind).toBe("crashed");
  });
  test("failed checks wake the run, until the deaths reach the cap", () => {
    const failing = pr(7, { checks: "FAILURE" });

    const once = step(
      world(snapshot({ issues: [issue(7)], prs: new Map([[7, failing]]) }), [
        here(7, [session("done")]),
      ]),
    );

    expect(once.actions[0]).toMatchObject({
      kind: "wake",
      restart: { reason: "checks" },
      message: expect.stringContaining("git merge origin/factory/7"),
    });

    const twice = [crash(), crash()];

    const last = step(
      world(
        snapshot({
          issues: [issue(7, { comments: twice })],
          prs: new Map([[7, failing]]),
        }),
        [here(7, [session("done")])],
      ),
    );

    expect(kinds(last.actions)).toEqual(["stop", "markStuck"]);
  });
  test("a usage limit holds the run until it resets, then wakes it", () => {
    const gh = snapshot({ issues: [issue(7)] });
    const until = NOW / 1000 + 3600;

    expect(
      step(world(gh, [here(7, [session("done", { rejectedUntil: until })])]))
        .state,
    ).toEqual({ kind: "limited", until });
    expect(
      step(
        world(gh, [
          here(7, [session("done", { rejectedUntil: NOW / 1000 - 1 })]),
        ]),
      ).state.kind,
    ).toBe("limitReset");
  });
  test("a run whose plan overlaps another open PR waits for it; its own PR never holds it", () => {
    const plan = "## Files\n- src/a.ts";

    const gh = (head: string) =>
      snapshot({
        issues: [issue(7)],
        open: [{ ...pr(3), author: BOT, number: 9, head, files: ["src/a.ts"] }],
      });

    expect(
      step(world(gh("factory/3"), [here(7, [session("done")], plan)])).state,
    ).toEqual({ kind: "held", on: { kind: "pr", pr: 9, files: ["src/a.ts"] }, posted: false });
    expect(
      step(world(gh("factory/7"), [here(7, [session("done")], plan)])).state
        .kind,
    ).toBe("crashed");
  });
  test("a dead run is stopped, then restarts and says so; a fresh worktree starts without a restart", () => {
    const gh = snapshot({ issues: [issue(7)] });

    expect(step(world(gh, [here(7, [session("done")])])).actions).toEqual([
      { kind: "stop", issue: 7, run: session("done") },
      { kind: "start", issue: 7, restart: "crash", after: "sid-1" },
    ]);
    expect(step(world(gh, [here(7)])).actions).toEqual([
      { kind: "start", issue: 7, restart: null, after: null },
    ]);
  });
  test("the third death marks the issue stuck", () => {
    const gh = snapshot({
      issues: [issue(7, { comments: [crash(), crash()] })],
    });

    expect(step(world(gh, [here(7, [session("done")])])).state).toEqual({
      kind: "crashed",
      deaths: 3,
    });
  });
  test("a dead run waits while another run here is refused for a usage limit", () => {
    const gh = snapshot({ issues: [issue(7), issue(8)] });

    const limited = here(8, [
      session("done", { rejectedUntil: NOW / 1000 + 60 }),
    ]);

    const w = world(gh, [here(7, [session("done")]), limited]);

    expect(classify(w.local[0]!, w).kind).toBe("limited");
    expect(pick(w)).toEqual([]);
  });
});

describe("an open PR GitHub can't merge as it stands", () => {
  const gh = (p: Pr, more: Partial<Snapshot> = {}, comments: Comment[] = []) =>
    snapshot({ issues: [issue(7, { comments })], prs: new Map([[7, p]]), ...more });

  const conflictWake = (baseSha: string) =>
    posted({ kind: "restart", issue: 7, reason: "conflict", session: "s", baseSha });

  const dirty = pr(7, { mergeable: "CONFLICTING", mergeState: "DIRTY" });

  test("behind its base with its run stopped, the worker updates the branch at the head it saw, with no model", () => {
    const { state, actions } = step(world(gh(pr(7, { mergeState: "BEHIND" })), [here(7, [session("stopped")])]));

    expect(state).toEqual({ kind: "behind", pr: 57, head: "h1", base: "main" });
    expect(actions).toEqual([
      { kind: "postCost", issue: 7, pr: 57, sessions: ["sid-1"] },
      { kind: "updateBranch", issue: 7, pr: 57, head: "h1" },
    ]);
    expect(occupies(state)).toBe(false);
    expect(stateLine(state)).toBe("PR #57 is behind main; the worker updates its branch");
  });
  test("behind with its run not yet stopped, the run is stopped first", () => {
    const { state, actions } = step(world(gh(pr(7, { mergeState: "BEHIND" })), [here(7, [session("done")])]));

    expect(state.kind).toBe("prOpen");
    expect(kinds(actions)).toEqual(["postCost", "stop"]);
  });
  test("conflicting, the run is woken to merge the base in, and the wake records the base commit it was for", () => {
    const { state, actions } = step(world(gh(dirty), [here(7, [session("done")])]));

    expect(state).toEqual({ kind: "conflicting", pr: 57, base: "main", baseSha: "m1", deaths: 0 });
    expect(occupies(state)).toBe(true);
    expect(stateLine(state)).toBe(`PR #57 conflicts with main; its run merges main in (0 of ${CRASHES_BEFORE_STUCK})`);
    expect(actions).toEqual([expect.objectContaining({ kind: "wake", restart: { reason: "conflict", baseSha: "m1" } })]);

    const message = actions.flatMap((a) => (a.kind === "wake" ? [a.message] : [])).join("");

    for (const s of ["git merge origin/factory/7", "git merge origin/main", "never rebase or force-push", "run the checks", "push"])
      expect(message).toContain(s);
    expect(message.indexOf("origin/factory/7")).toBeLessThan(message.indexOf("origin/main"));
  });
  test("GitHub's DIRTY alone is a conflict too; UNKNOWN does nothing until GitHub works it out", () => {
    const stopped = (p: Pr) => step(world(gh(p), [here(7, [session("stopped")])])).state.kind;

    expect(stopped(pr(7, { mergeState: "DIRTY" }))).toBe("conflicting");
    expect(stopped(pr(7, { mergeable: "UNKNOWN", mergeState: "UNKNOWN" }))).toBe("prOpen");
  });
  test("a fix fails when the run ended and the PR still conflicts while the base has not moved, whatever it pushed", () => {
    const thrice = (baseSha: string, p = dirty) =>
      step(world(gh(p, {}, [conflictWake(baseSha), conflictWake(baseSha), conflictWake(baseSha)]), [here(7, [session("done")])]));

    expect(thrice("m1", { ...dirty, headSha: "h9" }).state).toMatchObject({ kind: "conflicting", deaths: 3 });

    const sameBase = thrice("m1");

    expect(sameBase.state).toMatchObject({ kind: "conflicting", deaths: 3 });
    expect(sameBase.actions).toEqual([
      { kind: "stop", issue: 7, run: session("done") },
      { kind: "markStuck", issue: 7, reason: "PR #57 still conflicts with main after its run was woken 3 times to merge main in" },
    ]);

    const newConflict = thrice("m0");

    expect(newConflict.state).toMatchObject({ kind: "conflicting", deaths: 0 });
    expect(kinds(newConflict.actions)).toEqual(["wake"]);
  });
  test("a wake to merge the base in is no death", () => {
    expect(deathsSinceRetry([conflictWake("m1"), crash()], A)).toBe(1);
  });
  test("failed checks while the base's newest commit fails the same required checks hold the PR: no wake, no count", () => {
    const failing = pr(7, { checks: "FAILURE", required: ["test"] });

    const onBase = (...checks: Check[]) =>
      step(world(gh(failing, { base: { name: "main", sha: "m1", checks } }), [here(7, [session("stopped")])]));

    const red = onBase({ name: "test", state: "FAILURE" });

    expect(red.state).toEqual({ kind: "held", on: { kind: "red", pr: 57, base: "main" }, posted: false });
    expect(red.actions).toEqual([]);
    expect(occupies(red.state)).toBe(false);
    expect(stateLine(red.state)).toBe("held: main is red, so PR #57's failed checks wait for it to go green");
    expect(onBase({ name: "test", state: "PENDING" }).state.kind).toBe("checksFailed");
    expect(onBase({ name: "lint", state: "FAILURE" }, { name: "test", state: "SUCCESS" }).state.kind).toBe("checksFailed");
  });
  test("a required check still waiting, on a person or a build, never fails the PR", () => {
    const waiting = pr(7, { checks: "PENDING", required: ["test", "approvers"] });

    expect(step(world(gh(waiting), [here(7, [session("stopped")])])).state.kind).toBe("prOpen");
  });
});

describe("a review on an open PR", () => {
  const review = (more: Partial<Review> = {}): Review => ({
    id: 900,
    state: "CHANGES_REQUESTED",
    body: "Keep the old name.\nAnd say why.",
    author: ME,
    commit: "h1",
    comments: [{ path: "src/a.ts", line: 3, body: "rename this back" }],
    ...more,
  });

  const reviewWake = (id: number, createdAt?: string) =>
    posted({ kind: "restart", issue: 7, reason: "review", session: "s", review: id }, createdAt);

  const at = (reviews: Review[], comments: Comment[] = [], more: Partial<Pr> = {}) =>
    world(snapshot({ issues: [issue(7, { comments })], prs: new Map([[7, pr(7, { reviews, ...more })]]) }), [here(7, [session("stopped")])]);

  test("a trusted request for changes on the PR's head wakes the run with every word of it", () => {
    const { state, actions } = step(at([review()]));

    expect(state).toEqual({ kind: "reviewed", pr: 57, review: review(), rounds: 0 });
    expect(occupies(state)).toBe(true);
    expect(actions).toEqual([expect.objectContaining({ kind: "wake", restart: { reason: "review", review: 900 } })]);

    const message = actions.flatMap((a) => (a.kind === "wake" ? [a.message] : [])).join("");

    for (const s of [
      "> Keep the old name.\n> And say why.",
      "src/a.ts:3: rename this back",
      "in the scope of issue #7",
      ".factory/handoff.md",
      "git merge origin/factory/7",
      "never rebase or force-push",
    ])
      expect(message).toContain(s);
    expect(message).toMatch(/push, then reply once on the PR .*with what changed and what was left\.$/);
  });
  test("a review on an older head, an approval, a stranger's, an empty one, or one already woken for never wakes it", () => {
    for (const w of [
      at([review({ commit: "h0" })]),
      at([review({ state: "APPROVED" })]),
      at([review({ author: "stranger" })]),
      at([review({ state: "COMMENTED", body: " ", comments: [] })]),
      at([review()], [reviewWake(900)]),
    ])
      expect(step(w).state.kind).toBe("prOpen");
  });
  test("a comment review counts; a wake before the last retry is forgotten", () => {
    expect(step(at([review({ state: "COMMENTED", body: "" })])).state.kind).toBe("reviewed");

    const retried = [reviewWake(900, "2026-10-26T09:00:00Z"), posted({ kind: "stuck", issue: 7, reason: "x" }, "2026-10-26T09:30:00Z")];

    expect(step(at([review()], retried)).state).toMatchObject({ kind: "reviewed", rounds: 0 });
  });
  test("a third review round marks the issue stuck", () => {
    const { state, actions } = step(at([review({ id: 903 })], [reviewWake(901), reviewWake(902)]));

    expect(state).toMatchObject({ kind: "reviewed", rounds: 2 });
    expect(occupies(state)).toBe(false);
    expect(actions).toEqual([{ kind: "markStuck", issue: 7, reason: "PR #57 got a third review round" }]);
  });
  test("a conflict comes before a review; a review before an update from the base or failed checks", () => {
    expect(step(at([review()], [], { mergeable: "CONFLICTING", mergeState: "DIRTY" })).state.kind).toBe("conflicting");
    expect(step(at([review()], [], { mergeState: "BEHIND" })).state.kind).toBe("reviewed");
    expect(step(at([review()], [], { checks: "FAILURE" })).state.kind).toBe("reviewed");
  });
});

describe("killing an issue closes its PR", () => {
  const killed = {
    closed: snapshot(),
    untrusted: snapshot({ issues: [issue(7, { editor: "stranger" })] }),
    stuck: snapshot({ issues: [issue(7, { labels: ["factory", STUCK_LABEL] })] }),
  };

  const end = (why: keyof typeof killed, p?: Pr) =>
    step(world({ ...killed[why], prs: new Map(p === undefined ? [] : [[7, p]]) }, [here(7, [session("done")])]));

  test("an issue closed or no longer trusted closes its open PR, after its cost and before its worktree goes", () => {
    const reasons = (["closed", "untrusted"] as const).map((why) => {
      const { state, actions } = end(why, pr(7));

      expect(state).toEqual({ kind: "ended", why, pr: { number: 57, state: "OPEN" } });
      expect(kinds(actions)).toEqual(["stop", "postCost", "closePr", "removeWorktree"]);
      expect(actions[2]).toEqual({ kind: "closePr", issue: 7, pr: 57, reason: expect.stringContaining("Issue #7") });

      return actions[2]?.kind === "closePr" ? actions[2].reason : "";
    });

    expect(new Set(reasons).size).toBe(2);
  });
  test("a stuck issue keeps its open PR, so removing the label retries from it", () => {
    expect(kinds(end("stuck", pr(7)).actions)).toEqual(["stop", "postCost", "removeWorktree"]);
  });
  test("a merged PR, one closed already, or none has nothing to close", () => {
    for (const why of ["closed", "untrusted", "stuck"] as const)
      for (const p of [pr(7, { state: "MERGED" }), pr(7, { state: "CLOSED", closedAt: "2026-10-26T09:00:00Z" }), undefined])
        expect(kinds(end(why, p).actions)).not.toContain("closePr");
  });
  test("auto-merge goes off first; a PR that never had it armed still closes, one still armed does not", async () => {
    const gh = (offFails: boolean, armed = false) => {
      const calls: string[][] = [];

      const fake: Run = async (argv) => {
        calls.push([...argv]);
        const failed = offFails && argv.includes("--disable-auto");

        return { exitCode: failed ? 1 : 0, stdout: argv.includes("view") ? `${armed}\n` : "", stderr: failed ? "no auto-merge to disable" : "" };
      };

      return { fake, calls };
    };

    const plain = gh(false);
    await closePr(plain.fake, "o/r", 57, "Issue #7 was closed.");

    expect(plain.calls).toEqual([
      ["gh", "pr", "merge", "57", "--repo", "o/r", "--disable-auto"],
      ["gh", "pr", "close", "57", "--repo", "o/r", "--comment", "Issue #7 was closed."],
    ]);

    const unarmed = gh(true);
    await closePr(unarmed.fake, "o/r", 57, "why");

    expect(unarmed.calls.map((c) => c[2])).toEqual(["merge", "view", "close"]);

    const armed = gh(true, true);

    await expect(closePr(armed.fake, "o/r", 57, "why")).rejects.toThrow("no auto-merge to disable");
    expect(armed.calls.map((c) => c[2])).toEqual(["merge", "view"]);
  });
});

describe("only a person changes the factory's rules", () => {
  const touching = (files: string[] | null, author = BOT) => ({ ...pr(7), author, files });

  const at = (files: string[] | null, runs = [session("working")]) =>
    world(snapshot({ issues: [issue(7)], prs: new Map([[7, pr(7)]]), open: [touching(files)] }), [here(7, runs)]);

  test("a run's open PR that changes the rules file is closed and the issue marked stuck, the run stopped first, even mid-work", () => {
    const { state, actions } = step(at(["src/a.ts", RULES_PATH]));

    expect(state).toEqual({ kind: "rulesChanged", pr: 57 });
    expect(occupies(state)).toBe(false);
    expect(kinds(actions)).toEqual(["stop", "closePr", "markStuck"]);
    expect(actions[1]).toMatchObject({ pr: 57, reason: expect.stringContaining(RULES_PATH) });
  });
  test("a PR leaving the rules file alone, or listing more files than one page, goes on", () => {
    expect(step(at(["src/a.ts"])).state.kind).toBe("working");
    expect(step(at(null)).state.kind).toBe("working");
  });
  test("the bot's PR with no worktree here closes when it changes the rules, whatever its issue says", () => {
    const w = world(snapshot({ issues: [issue(7)], open: [touching([RULES_PATH])] }), []);

    expect(prsToClose(w)).toEqual([{ kind: "closePr", issue: 7, pr: 57, reason: expect.stringContaining(RULES_PATH) }]);
  });
});

describe("an issue that ends with no worktree here still closes its PR", () => {
  const open = (author = BOT) => ({ ...pr(7), author, files: ["src/a.ts"] });
  const at = (issues: Issue[], more: Partial<World> = {}, author = BOT) => prsToClose(world(snapshot({ issues, open: [open(author)] }), [], more));

  test("closed, unlabelled or no longer trusted, its open PR closes, saying why", () => {
    expect(at([])).toEqual([{ kind: "closePr", issue: 7, pr: 57, reason: expect.stringContaining("was closed or lost its") }]);
    expect(at([issue(7, { editor: "stranger" })])).toEqual([{ kind: "closePr", issue: 7, pr: 57, reason: expect.stringContaining("does not trust") }]);
  });
  test("a stuck or live issue keeps its PR, as does a PR the bot never opened or one a worktree here watches", () => {
    expect(at([issue(7, { labels: ["factory", STUCK_LABEL] })])).toEqual([]);
    expect(at([issue(7)])).toEqual([]);
    expect(at([], {}, ME)).toEqual([]);
    expect(at([], { local: [here(7)] })).toEqual([]);
    expect(at([], { foreign: [7] })).toEqual([]);
  });
  test("decide closes it in a group of its own", () => {
    expect(decide(world(snapshot({ open: [open()] }), []))).toEqual([[expect.objectContaining({ kind: "closePr", pr: 57 })]]);
  });
});

describe("plans posted first hold later ones", () => {
  const planned = (n: number, at: string) =>
    posted({ kind: "plan", issue: n, seal: SEAL, text: "## Files\n- src/a.ts" }, at);

  const both = (at4: string, at7: string) =>
    snapshot({
      issues: [issue(4, { comments: [planned(4, at4)] }), issue(7, { comments: [planned(7, at7)] })],
    });

  const gh = both("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z");

  test("the later plan is held, saying which issue it waits for; the earlier goes on", () => {
    const w = world(gh, [here(7, [session("done")]), here(4, [session("done")])]);
    const later = classify(w.local[0]!, w);

    expect(later).toEqual({ kind: "held", on: { kind: "plan", issue: 4, files: ["src/a.ts"] }, posted: false });
    expect(stateLine(later)).toBe("held until #4 merges or ends: its plan, posted first, also touches src/a.ts");
    expect(classify(w.local[1]!, w).kind).toBe("crashed");
  });
  test("a hold on a run that exists is posted once, so its release is no crash", () => {
    const first = step(world(gh, [here(7, [session("done")])]));

    expect(first.actions).toEqual([{ kind: "postHeld", issue: 7, on: { kind: "plan", issue: 4 } }]);

    const seven = gh.issues[1]!;
    const recorded = { ...seven, comments: [...seven.comments, posted({ kind: "held", issue: 7, on: { kind: "plan", issue: 4 } })] };

    expect(step(world({ ...gh, issues: [gh.issues[0]!, recorded] }, [here(7, [session("done")])])).actions).toEqual([]);
  });
  test("plans posted in the same second go by issue number, so two never hold each other", () => {
    const at = "2026-10-26T09:00:00Z";
    const w = world(both(at, at), [here(4, [session("done")]), here(7, [session("done")])]);

    expect(w.local.map((l) => classify(l, w).kind)).toEqual(["crashed", "held"]);
  });
  test("a plan in the worktree not yet posted comes after every posted one", () => {
    const first = issue(4, { comments: [planned(4, "2026-10-26T09:00:00Z")] });
    const w = world(snapshot({ issues: [first, issue(7)] }), [here(7, [session("done")], "## Files\n- src/a.ts")]);

    expect(classify(w.local[0]!, w)).toMatchObject({ kind: "held", on: { kind: "plan", issue: 4 } });
  });
  test("a stuck or untrusted earlier issue, or none, holds nothing", () => {
    const at = "2026-10-26T09:00:00Z";
    const seven = issue(7, { comments: [planned(7, "2026-10-26T10:00:00Z")] });
    const alone = (others: Issue[]) => classify(here(7, [session("done")]), world(snapshot({ issues: [...others, seven] }), [])).kind;

    expect(alone([issue(4, { comments: [planned(4, at)], labels: ["factory", STUCK_LABEL] })])).toBe("crashed");
    expect(alone([issue(4, { comments: [planned(4, at)], labelledBy: "stranger" })])).toBe("crashed");
    expect(alone([])).toBe("crashed");
  });
  test("an open PR holds before a plan does", () => {
    const w = world({ ...gh, open: [{ ...pr(3), author: BOT, files: ["src/a.ts"] }] }, [here(7, [session("done")])]);

    expect(classify(w.local[0]!, w)).toMatchObject({ kind: "held", on: { kind: "pr", pr: 53, files: ["src/a.ts"] } });
  });
  test("a later plan is never started while the earlier issue is open", () => {
    expect(pick(world(gh, []))).toEqual([{ issue: 4, resume: false }]);
  });
});

describe("a run its hold stopped goes on once the hold is gone, and no release is a death", () => {
  const held = (on: { kind: "pr"; pr: number } | { kind: "plan"; issue: number }) => posted({ kind: "held", issue: 7, on });
  const released = posted({ kind: "restart", issue: 7, reason: "held", session: "s" });
  const at = (comments: Comment[]) => world(snapshot({ issues: [issue(7, { comments })] }), [here(7, [session("done")])]);

  test("three hold and release cycles never mark the issue stuck", () => {
    const cycles = [held({ kind: "pr", pr: 9 }), released, held({ kind: "plan", issue: 4 }), released, held({ kind: "pr", pr: 9 })];
    const { state, actions } = step(at(cycles));

    expect(state).toEqual({ kind: "released" });
    expect(actions).toEqual([
      { kind: "stop", issue: 7, run: session("done") },
      { kind: "start", issue: 7, restart: "held", after: "sid-1" },
    ]);
    expect(occupies(state)).toBe(true);
    expect(stateLine(state)).toBe("what held it is gone; a fresh session goes on");
    expect(deathsSinceRetry([...cycles, released], A)).toBe(0);
  });
  test("a run that dies after its release is a crash, and real crashes still reach stuck", () => {
    expect(step(at([held({ kind: "pr", pr: 9 }), released])).state).toEqual({ kind: "crashed", deaths: 1 });
    expect(kinds(step(at([crash(), crash(), held({ kind: "pr", pr: 9 }), released])).actions)).toEqual(["stop", "markStuck"]);
  });
});

describe("the base must require branches up to date", () => {
  const ruleset = (strict: boolean, checks = 1) =>
    JSON.stringify([
      { type: "deletion" },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: strict,
          required_status_checks: Array.from({ length: checks }, () => ({ context: "test" })),
        },
      },
    ]);

  const protection = (strict: boolean) => JSON.stringify({ strict, contexts: ["test"], checks: [] });

  /** `branches/<base>` as a token that can't read the protection sees it: the checks, no `strict`. */
  const branch = (contexts: string[]) =>
    JSON.stringify({
      name: "main",
      protected: true,
      protection: {
        enabled: true,
        required_status_checks: { enforcement_level: "everyone", contexts, checks: contexts.map((context) => ({ context, app_id: 1 })) },
      },
    });

  test("a strict ruleset or strict protection passes", () => {
    expect(checksReason("o/r", "main", [ruleset(true), null, branch(["test"])])).toBe(null);
    expect(checksReason("o/r", "main", [null, protection(true), branch(["test"])])).toBe(null);
    expect(checksReason("o/r", "main", [ruleset(false), protection(true), branch(["test"])])).toBe(null);
  });
  test("checks required, but not up to date, refuses and says how to turn it on", () => {
    const no = checksReason("o/r", "main", [ruleset(false), protection(false), branch(["test"])]);

    expect(no?.kind).toBe("refusal");

    for (const s of ["up to date", "strict_required_status_checks_policy", "required_status_checks.strict"])
      expect(no?.text).toContain(s);
  });
  test("no check required refuses as before; a strict rule naming no check is no check", () => {
    expect(checksReason("o/r", "main", [null, null, null])?.text).toContain("requires no checks");
    expect(checksReason("o/r", "main", [ruleset(true, 0), null, branch([])])?.text).toContain("requires no checks");
  });
  test("branch protection that requires checks, its strict flag unreadable by this token, warns while no readable source is strict", () => {
    for (const rules of [ruleset(false), null]) {
      const gap = checksReason("o/r", "main", [rules, null, branch(["test"])]);

      expect(gap?.kind).toBe("warning");

      for (const s of ["can't read whether", "up to date", "red main"]) expect(gap?.text).toContain(s);
    }
  });
  test("with the protection unreadable and no checks in the branch's own view, it refuses as before", () => {
    expect(checksReason("o/r", "main", [ruleset(false), null, branch([])])?.text).toContain("not branches up to date");
    expect(checksReason("o/r", "main", [ruleset(false), null, null])?.text).toContain("not branches up to date");
    expect(checksReason("o/r", "main", [null, null, branch([])])?.text).toContain("requires no checks");
  });
});

describe("deaths since the last retry", () => {
  test("removing the stuck label starts the count again; context restarts and forged ones don't count", () => {
    const stuck = posted({ kind: "stuck", issue: 7, reason: "x" });

    const context = posted({
      kind: "restart",
      issue: 7,
      reason: "context",
      session: "s",
    });

    const forged = said(
      render({ kind: "restart", issue: 7, reason: "crash", session: "s" }),
      "stranger",
    );

    expect(deathsSinceRetry([crash(), crash(), crash()], A)).toBe(3);
    expect(deathsSinceRetry([crash(), crash(), stuck, crash()], A)).toBe(1);
    expect(deathsSinceRetry([context, forged], A)).toBe(0);
  });
});

describe("picking new work", () => {
  const plan = posted({
    kind: "plan",
    issue: 4,
    seal: SEAL,
    text: "## Files\n- src/b.ts",
  });

  test("trusted, unblocked, unclaimed issues start, planned ones first, up to the free slots", () => {
    const gh = snapshot({
      issues: [
        issue(3),
        issue(4, { comments: [plan] }),
        issue(5, { labelledBy: "stranger" }),
        issue(6, { blocked: true }),
        issue(8),
        issue(9, { labels: ["factory", STUCK_LABEL] }),
      ],
    });

    expect(pick(world(gh, []))).toEqual([
      { issue: 4, resume: false },
      { issue: 3, resume: false },
    ]);
    expect(
      pick(world({ ...gh, issues: [...gh.issues, issue(1)] }, [here(1, [session("working")])])),
    ).toEqual([
      { issue: 4, resume: false },
    ]);
  });
  test("a claimed branch resumes only on the machine that claimed it", () => {
    const gh = snapshot({ issues: [issue(3)], claimed: new Set([3]) });

    expect(pick(world(gh, []))).toEqual([]);
    expect(pick(world(gh, [], { claimedHere: new Set([3]) }))).toEqual([
      { issue: 3, resume: true },
    ]);
  });
  test("an issue whose plan overlaps an open PR waits", () => {
    const gh = snapshot({
      issues: [issue(4, { comments: [plan] })],
      open: [{ ...pr(3), author: BOT, number: 9, head: "x", files: null }],
    });

    expect(pick(world(gh, []))).toEqual([]);
  });
  test("a new issue is claimed, then started; a resumed one only started", () => {
    const gh = snapshot({
      issues: [issue(3), issue(4)],
      claimed: new Set([4]),
    });

    expect(decide(world(gh, [], { claimedHere: new Set([4]) }))).toEqual([
      [
        { kind: "claim", issue: 3 },
        { kind: "start", issue: 3, restart: null, after: null },
      ],
      [{ kind: "start", issue: 4, restart: null, after: null }],
    ]);
  });
});

const base: RunInput = {
  repo: "o/r",
  issue: 7,
  title: "Add due dates",
  body: "Tasks need a due date.",
  notes: [{ author: "you", body: "keep it in one file" }],
  plan: null,
  handoff: null,
  rules: RULES,
  cli: "bun /f/worker/cli.ts",
  base: "main",
};

describe("run prompt", () => {
  test("a first run gets the issue, the notes, the plan-layer rules and every factory command", () => {
    const p = runPrompt(base);

    for (const s of [
      "# Add due dates",
      "@you: keep it in one file",
      "no classes",
      "names read well",
      "hope:compose",
    ])
      expect(p).toContain(s);

    for (const cmd of Object.values(usage(base.cli))) expect(p).toContain(cmd);
    expect(p).not.toContain("You are continuing");
  });
  test("it dictates the approval question the ask hook recognises, and ends the turn after the PR, never watching its checks", () => {
    const p = runPrompt(base);

    expect(p).toContain(`question "${APPROVAL_QUESTION}"`);
    expect(p).not.toContain("gh pr checks --watch");
    expect(p).toContain("the worker wakes you when a required check fails, the PR conflicts with the base, or a review asks for changes");
  });
  test("the run writes the PR's body, by the project's PR rules, before it runs pr", () => {
    const p = runPrompt(base);

    expect(p).toContain(`Write ${PR_PATH}`);
    expect(p.indexOf(PR_PATH)).toBeLessThan(p.indexOf(usage(base.cli).pr));
  });
  test("before the PR it runs each check, then judges the diff from the base by each judge rule, and boxes what is left", () => {
    const p = runPrompt({ ...base, rules: { ...RULES, layers: { ...RULES.layers, check: ["bun run lint", "bun test"] } } });
    const at = (s: string) => p.indexOf(s);

    expect(p).toContain("bun test");
    expect(p).toContain("`git diff origin/main...HEAD`");
    expect(p).toContain("at most 2 rounds of fixes");
    expect(p).toContain("an unticked box (`- [ ] …`)");
    expect(at("bun run lint")).toBeLessThan(at("origin/main...HEAD"));
    expect(at("origin/main...HEAD")).toBeLessThan(at("names read well"));
    expect(at("names read well")).toBeLessThan(at(`Write ${PR_PATH}`));
    expect(at(`Write ${PR_PATH}`)).toBeLessThan(at(usage(base.cli).pr));
  });
  test("no verdict follows the PR, and the stuck rule holds only once the PR is open", () => {
    const p = runPrompt(base);

    expect(p).not.toContain("verdict");
    expect(p).not.toContain("never holds the merge");
    expect(p).toContain(`Once the PR is open, after 2 failed fixes of the same failure, run \`${usage(base.cli).stuck}\``);
  });
  test("where the project's own rules say to stop and wait, the run asks with AskUserQuestion", () => {
    expect(runPrompt(base)).toContain("Where the project's own rules say to stop and wait for a person, ask with AskUserQuestion instead");
  });
  test("a restarted run goes on from the plan and the handoff", () => {
    const p = runPrompt({
      ...base,
      plan: { text: "## Types\nDue", approved: true },
      handoff: "Left: the formatter",
    });

    expect(p).toContain("You are continuing");
    expect(p).toContain("The plan (approved)");
    expect(p).toContain("Left: the formatter");
  });
});

describe("seal", () => {
  test("is the sha256 of the plan text, so any edit changes it", () => {
    expect(seal("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(seal("## Types\na")).not.toBe(seal("## Types\nb"));
    expect(planGaps("## Types\na")).toEqual(["Signatures", "Files"]);
  });
});

describe("the PR a run opens", () => {
  const h = (draft?: boolean) => ({ repo: "o/r", issue: 7, rules: draft === undefined ? RULES : { ...RULES, pr: { draft } } });

  test("its body is the run's own text, then the line that closes the issue, then the sealed plan", () => {
    expect(prBody("## Context\n\nDue dates.\n\n", 7, SEAL)).toBe(
      `## Context\n\nDue dates.\n\nCloses #7\n\nPlan: seal \`${SEAL.slice(0, 8)}\`, approved on #7.`,
    );
  });
  test("it opens as a draft when the rules say so, and auto-merge is armed only on a PR that is no draft", () => {
    expect(prCreate(h(true), "Add due dates", "body")).toEqual([
      "gh", "pr", "create", "--repo", "o/r", "--head", "factory/7", "--label", "factory", "--title", "Add due dates", "--body", "body", "--draft",
    ]);
    expect(prCreate(h(), "Add due dates", "body")).not.toContain("--draft");
    expect(prCreate(h(false), "Add due dates", "body")).not.toContain("--draft");
    expect(prMerge(h(true), "https://github.com/o/r/pull/9")).toBe(null);
    expect(prMerge(h(), "https://github.com/o/r/pull/9")).toEqual(["gh", "pr", "merge", "https://github.com/o/r/pull/9", "--auto", "--squash"]);
  });
  test("pr refuses with exit 4 while its body file is missing or blank, naming the file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-pr-"));
    const refused = { code: 4, message: expect.stringContaining(PR_PATH) };

    await expect(prText(dir)).rejects.toMatchObject(refused);
    await Bun.write(join(dir, PR_PATH), " \n\n");
    await expect(prText(dir)).rejects.toMatchObject(refused);
    await Bun.write(join(dir, PR_PATH), "## Context\n\nDue dates.\n");
    expect(await prText(dir)).toBe("## Context\n\nDue dates.");
    await rm(dir, { recursive: true });
  });
});

describe("smoke run 1 (saadshahd/factory-smoke, 2026-10-27)", () => {
  const actors = actorsOf(SMOKE_RULES, "saadshahd/factory-smoke");
  const gh = snapshot({ issues: ISSUES, claimed: new Set([5, 6, 7]) });
  const noFacts = { usage: usageOf(""), context: 0, pendingAsk: false, rejectedUntil: null };

  const at = (agents: string, n: number): Local =>
    here(n, sessionsNamed(agents, `factory:saadshahd/factory-smoke#${n}`).map((s) => runView(s, noFacts)));

  const smoke = (l: Local): World => world(gh, [l], { actors, rules: SMOKE_RULES, claimedHere: new Set([5, 6, 7]) });

  test("an open ask in the run's own box leaves no line in its transcript; the session list shows it", () => {
    expect(pendingAsk(OPEN_ASK)).toBe(false);
    expect(at(AGENTS_AT_TICK, 5).runs.map((r) => r.pendingAsk)).toEqual([true]);
  });

  test("#5 and #7, asking in their own box, are stopped and marked stuck, never restarted as crashes", () => {
    for (const n of [5, 7]) {
      const { state, actions } = step(smoke(at(AGENTS_AT_TICK, n)));

      expect(state.kind).toBe("askedInBox");
      expect(kinds(actions)).toEqual(["stop", "markStuck"]);
      expect(actions[0]).toMatchObject({ run: { id: n === 5 ? "94637db3" : "167642fa" } });
    }
  });

  test("#6, still working, is left alone", () => {
    expect(step(smoke(at(AGENTS_AT_TICK, 6)))).toEqual({ state: { kind: "working" }, actions: [] });
  });

  test("the restarts the worker posted as the user count no deaths", () => {
    for (const i of ISSUES) expect(deathsSinceRetry(i.comments, actors)).toBe(0);
  });

  test("a run that ended its turn asking for help is stopped before its restart", () => {
    const { state, actions } = step(smoke(at(AGENTS_LATER, 5)));

    expect(state).toEqual({ kind: "crashed", deaths: 1 });
    expect(actions).toMatchObject([
      { kind: "stop", run: { id: "0e462418" } },
      { kind: "start", restart: "crash", after: "0e462418-b22d-4e15-a8ad-8d9676426c92" },
    ]);
  });
});

describe("proc", () => {
  test("a child sees the environment as it is now, so the worker's commands act as the bot", async () => {
    process.env.FACTORY_PROC_PROBE = "bot";
    const r = await run(["sh", "-c", "echo $FACTORY_PROC_PROBE"]);
    delete process.env.FACTORY_PROC_PROBE;

    expect(r.stdout.trim()).toBe("bot");
  });
});

describe("git under the factory's git config", () => {
  /** Real git, given the config through the environment the way the worker and the run hooks give it. */
  const git = async (...argv: string[]) =>
    (await new Response(Bun.spawn(["git", ...argv], { cwd: tmpdir(), env: { ...process.env, ...gitConfigEnv() }, stdout: "pipe" }).stdout).text()).trim();

  test("pushes to GitHub's SSH remotes over HTTPS, and signs no commit whatever the user's own config says", async () => {
    expect(await git("ls-remote", "--get-url", "git@github.com:o/r.git")).toBe("https://github.com/o/r.git");
    expect(await git("ls-remote", "--get-url", "ssh://git@github.com/o/r.git")).toBe("https://github.com/o/r.git");
    expect(await git("config", "--get", "commit.gpgsign")).toBe("false");
  });
});

describe("a run's sandbox", () => {
  const withPaths = (...paths: string[]) => runSettings({ ...RULES, sandbox: { paths } });

  test("adds the repo's hosts and folders to the factory's own, and keeps the App's key folder shut", () => {
    const own = runSettings(RULES);
    const s = runSettings({ ...RULES, sandbox: { domains: ["npm.example.com"], paths: ["~/Library/pnpm/store/v10"] } });

    expect(s.sandbox.network.allowedDomains).toEqual([...own.sandbox.network.allowedDomains, "npm.example.com"]);
    expect(s.sandbox.filesystem.allowWrite).toEqual([...own.sandbox.filesystem.allowWrite, "~/Library/pnpm/store/v10"]);
    expect(s.sandbox.filesystem.denyRead).toEqual(["~/.config/factory"]);
    expect(s.permissions.deny).toEqual(["Read(~/.config/factory/**)"]);
    expect(s.env).toEqual({ GIT_EDITOR: "true" });
  });
  test("refuses a path that is the App's key folder, holds it, or sits inside it, however it is spelled", () => {
    for (const p of [
      "~/.config/factory",
      "~/.config/factory/",
      `${homedir()}/.config/factory/app.pem`,
      "~/.config",
      "~",
      "/",
      "~/Library/../.config/factory",
      "~/**",
      "~/.config/fac*",
    ])
      expect(() => withPaths("/tmp/build", p)).toThrow(".config/factory");
  });
  test("a path that reaches the key folder through a symlink is refused", async () => {
    const root = await mkdtemp(join(tmpdir(), "factory-link-"));
    await symlink(homedir(), join(root, "home"));

    for (const p of [`${root}/home/.config/factory`, `${root}/home/.config`, `${root}/home/**`])
      expect(() => withPaths(p)).toThrow(".config/factory");
    expect(() => withPaths(`${root}/home/.config/factory-old`)).not.toThrow();
    await rm(root, { recursive: true });
  });
  test("a path beside the key folder passes; a relative one is refused, having no place to compare", () => {
    expect(() => withPaths("~/.config/factory-old", "/tmp/build", "~/Library/pnpm/**")).not.toThrow();
    expect(() => withPaths("../..")).toThrow("relative");
  });
});

describe("smoke run 2 (saadshahd/factory-smoke #5, 2026-10-27)", () => {
  const actors = actorsOf(SMOKE_RULES, "saadshahd/factory-smoke");
  const first = session("stopped", { id: "94637db3", sessionId: "94637db3-4da9-4b97-aa43-4088b6605e34" });
  const second = session("stopped", { id: "0e462418", sessionId: "0e462418-b22d-4e15-a8ad-8d9676426c92" });
  const third = session("working", { id: "3e793b54", sessionId: "3e793b54" });

  /** GitHub holds the wait as the worker closed it; before the answer it was open. */
  const reopened = (c: Comment): Comment => {
    const f = parse(c.body);

    return f?.kind === "wait" ? { ...c, body: render({ ...f, answers: null }) } : c;
  };

  const at = (t: string, runs: RunView[], more: Partial<Snapshot> = {}): World => {
    const answered = t >= "2026-10-27T00:50:00Z";
    const comments = ISSUE_5.filter((c) => c.createdAt <= t).map((c) => (answered ? c : reopened(c)));
    const gh = snapshot({ issues: [{ ...ISSUES[0]!, comments }], claimed: new Set([5]), ...more });

    return world(gh, [here(5, runs)], { actors, rules: SMOKE_RULES });
  };

  test("a run stopped by hand is its own state: posted once, never counted or restarted as a crash", () => {
    const { state, actions } = step(at("2026-10-27T00:48:00Z", [first, second]));

    expect(state).toEqual({ kind: "stoppedByHand", session: second.sessionId, posted: false });
    expect(actions).toEqual([{ kind: "postStopped", issue: 5, session: second.sessionId }]);
    expect(stateLine(state)).toBe("stopped by hand");
    expect(occupies(state)).toBe(false);

    const w = at("2026-10-27T00:48:00Z", [first, second]);
    const stopped = posted({ kind: "stopped", issue: 5, session: second.sessionId });
    const issue5 = w.gh.issues[0]!;
    const again = { ...w, gh: { ...w.gh, issues: [{ ...issue5, comments: [...issue5.comments, stopped] }] } };

    expect(step(again)).toEqual({
      state: { kind: "stoppedByHand", session: second.sessionId, posted: true },
      actions: [],
    });
  });

  test("a run the worker stopped for a restart, whose start then failed, is still a crash", () => {
    expect(classify(here(5, [first, second]), at("2026-10-27T00:48:11Z", [first, second])).kind).toBe("crashed");
  });

  test("the log gets one line per state the worker sees, PR opened and merged included", () => {
    const pr8 = (state: Pr["state"]) => new Map([[5, pr(5, { number: 8, state, checks: "SUCCESS", comments: PR_8 })]]);

    const story = [
      at("2026-10-27T00:48:30Z", [first, second, { ...third, state: "blocked" }]),
      at("2026-10-27T00:49:55Z", [first, second, { ...third, state: "blocked" }]),
      at("2026-10-27T00:50:00Z", [first, second, third]),
      at("2026-10-27T00:51:00Z", [first, second, { ...third, state: "done" }], { prs: pr8("OPEN") }),
      at("2026-10-27T00:51:12Z", [first, second, { ...third, state: "stopped" }], { prs: pr8("MERGED") }),
      world(snapshot({ prs: pr8("MERGED") }), [here(5, [first, second, third])], { actors }),
    ];

    expect(story.map((w) => stateLine(classify(w.local[0]!, w)))).toEqual([
      "waiting for an answer on the issue",
      "answered on the issue",
      "working",
      "PR #8 open",
      "PR #8 merged",
      "ended: closed, PR #8",
    ]);
  });
});

describe("upsert says what it did, so the log names a cost posted or changed", () => {
  const cost: FactoryComment = { kind: "cost", issue: 5, pr: 8, sessions: ["s"], input: 1, cacheRead: 2, cacheWrite: 3, output: 4 };
  const fake: Run = async (argv) => ({ exitCode: 0, stdout: argv.includes("PATCH") ? "" : "77", stderr: "" });

  test("posted, edited, unchanged", async () => {
    expect(await upsert(fake, "o/r", 8, cost, [], A)).toBe("posted");
    expect(await upsert(fake, "o/r", 8, cost, [posted(cost)], A)).toBe("unchanged");
    expect(await upsert(fake, "o/r", 8, { ...cost, issue: 6 }, [posted(cost)], A)).toBe("edited");
  });
});

/** Git in a scratch repo: a fixed author, no signing whatever the user's own config says, and a throw on any failure. */
const gitIn = (cwd: string, ...a: string[]) =>
  must(run, ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a], { cwd });

describe("a worktree counts as this machine's run only when its branch carries this machine's claim", () => {
  test("its own claim, another machine's, none, and an unreadable ref", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-claim-"));
    const git = (...a: string[]) => gitIn(dir, ...a);
    await git("init", "-q", "-b", "main");
    await git("commit", "-q", "--allow-empty", "-m", "base");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    const ctx = { dir, base: "main", machine: "MAC-A" } as const;

    expect(await claimIn(ctx, dir, "HEAD")).toBe(false);
    await git("commit", "-q", "--allow-empty", "-m", "factory: claim #9\n\nFactory-Claim: MAC-B");
    expect(await claimIn(ctx, dir, "HEAD")).toBe(false);
    await git("commit", "-q", "--allow-empty", "-m", "factory: claim #9\n\nFactory-Claim: MAC-A");
    expect(await claimIn(ctx, dir, "HEAD")).toBe(true);
    expect(await claimIn(ctx, dir, "refs/heads/nothing")).toBe(false);
    await rm(dir, { recursive: true });
  });
});

describe("worktrees from git or the repo's own commands", () => {
  /** As `git worktree list --porcelain` prints it, one block of each kind git writes. */
  const LISTED = [
    "worktree /r",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree /r.factory-5",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/factory/5",
    "",
    "worktree /envs/env 03",
    "HEAD 3333333333333333333333333333333333333333",
    "branch refs/heads/factory/12",
    "locked held by the pool",
    "",
    "worktree /envs/env-04",
    "HEAD 4444444444444444444444444444444444444444",
    "branch refs/heads/worktree-factory-6",
    "",
    "worktree /tmp/review",
    "HEAD 5555555555555555555555555555555555555555",
    "detached",
    "",
    "worktree /r.factory-8",
    "HEAD 6666666666666666666666666666666666666666",
    "branch refs/heads/factory/8",
    "prunable gitdir file points to non-existent location",
    "",
    "worktree /mirror.git",
    "bare",
    "",
  ].join("\n");

  test("only factory/<n> branches count, locked ones too; a detached, bare or prunable one never does", () => {
    expect(factoryWorktrees(LISTED)).toEqual([
      { issue: 5, path: "/r.factory-5" },
      { issue: 12, path: "/envs/env 03" },
    ]);
    expect(factoryWorktrees("")).toEqual([]);
  });

  test("a create command's worktree is the last line it prints, from the main worktree when relative", () => {
    expect(createdPath("syncing\n/envs/env-03\n\n", "/r")).toBe("/envs/env-03");
    expect(createdPath("../envs/env-03\n", "/r")).toBe("/envs/env-03");
    expect(() => createdPath(" \n", "/r")).toThrow("printed no worktree path");
  });

  test("a worktree another branch took is refused before anything goes on in it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-branch-"));
    const git = (...a: string[]) => gitIn(dir, ...a);
    await git("init", "-q", "-b", "factory/7");
    await git("commit", "-q", "--allow-empty", "-m", "base");

    await onBranch(dir, 7);
    await expect(onBranch(dir, 9)).rejects.toThrow("is on factory/7, not factory/9");
    await git("switch", "-q", "--detach");
    await expect(onBranch(dir, 7)).rejects.toThrow("is on no branch, not factory/7");
    await rm(dir, { recursive: true });
  });

  /** A main worktree whose origin holds `main` and a claimed `factory/7`, as the worker finds its repo. */
  async function claimedRepo() {
    const root = await realpath(await mkdtemp(join(tmpdir(), "factory-worktree-")));
    const dir = join(root, "r");
    await gitIn(root, "init", "-q", "--bare", "origin.git");
    await gitIn(root, "init", "-q", "-b", "main", "r");
    await gitIn(dir, "remote", "add", "origin", join(root, "origin.git"));
    await gitIn(dir, "commit", "-q", "--allow-empty", "-m", "claim");
    await gitIn(dir, "push", "-q", "origin", "HEAD:refs/heads/main", "HEAD:refs/heads/factory/7");

    return { root, dir };
  }

  test("with no commands of the repo's own, git adds the worktree beside the main one, and removes it", async () => {
    const { root, dir } = await claimedRepo();
    const plan: Plan = { kind: "plan", issue: 7, seal: SEAL, text: "## Files\n- a.ts" };
    const path = await worktreeFor({ dir }, RULES, 7, plan);

    expect(path).toBe(`${dir}.factory-7`);
    expect(await worktrees({ dir })).toEqual([{ issue: 7, path }]);
    expect(await Bun.file(join(path, PLAN_PATH)).text()).toBe(plan.text);
    expect((await run(["git", "status", "--porcelain"], { cwd: path })).stdout).toBe("");
    await letGo({ dir }, RULES, 7, path);
    expect(await worktrees({ dir })).toEqual([]);
    await rm(root, { recursive: true });
  });

  test("a hook a run's branch tracks never runs when the worker checks that branch out, by git or after a pool", async () => {
    const { root, dir } = await claimedRepo();
    const ran = join(root, "hook-ran");
    await gitIn(dir, "switch", "-q", "-c", "factory/7");
    await mkdir(join(dir, ".husky"));
    await Bun.write(join(dir, ".husky", "post-checkout"), `#!/bin/sh\ntouch ${ran}\n`);
    await chmod(join(dir, ".husky", "post-checkout"), 0o755);
    await gitIn(dir, "add", ".husky");
    await gitIn(dir, "commit", "-q", "-m", "a hook");
    await gitIn(dir, "push", "-q", "-f", "origin", "factory/7");
    await gitIn(dir, "switch", "-q", "main");
    await gitIn(dir, "branch", "-q", "-D", "factory/7");
    await gitIn(dir, "config", "core.hooksPath", ".husky");
    const pool = join(root, "pool.ts");
    await Bun.write(pool, POOL);
    const rules: Rules = { ...RULES, worktree: { create: ["bun", pool, "acquire", "{name}"], release: ["bun", pool, "release", "{dir}"] } };

    for (const r of [RULES, rules]) {
      const path = await worktreeFor({ dir }, r, 7, null);

      expect(await Bun.file(join(path, ".husky", "post-checkout")).exists()).toBe(true);
      expect(await Bun.file(ran).exists()).toBe(false);
      await gitIn(dir, "worktree", "remove", "--force", path);
    }

    await rm(root, { recursive: true });
  });

  /** A pool that lends a detached worktree after a line of progress, and keeps every one it lent. */
  const POOL = `import { resolve } from "node:path";
const [command, name] = process.argv.slice(2);

if (command === "acquire") {
  const slot = resolve("../slots", name);
  Bun.spawnSync(["git", "worktree", "add", "-q", "--detach", slot]);
  console.log("warming the slot");
  console.log(slot);
} else console.log("retained");
`;

  test("a pool's worktree is moved onto the issue's branch, and one its release keeps stays listed", async () => {
    const { root, dir } = await claimedRepo();
    const pool = join(root, "pool.ts");
    await Bun.write(pool, POOL);
    const rules: Rules = { ...RULES, worktree: { create: ["bun", pool, "acquire", "{name}"], release: ["bun", pool, "release", "{dir}"] } };
    const path = await worktreeFor({ dir }, rules, 7, null);

    expect(path).toBe(join(root, "slots", "factory-7"));
    expect(await worktrees({ dir })).toEqual([{ issue: 7, path }]);
    await letGo({ dir }, rules, 7, path);
    expect(await worktrees({ dir })).toEqual([{ issue: 7, path }]);
    await rm(root, { recursive: true });
  });
});

describe("platform", () => {
  const ran = (out: Record<string, { exitCode: number; stdout?: string }>): Run => async (argv) => {
    const r = out[argv.join(" ")] ?? { exitCode: 1 };

    return { exitCode: r.exitCode, stdout: r.stdout ?? "", stderr: r.exitCode === 0 ? "" : "No such file or directory" };
  };

  test("macOS reads its id from ioreg and holds awake with caffeinate until the worker exits", async () => {
    const mac = platformOf("darwin")!;

    expect(await machineId(ran({ "ioreg -rd1 -c IOPlatformExpertDevice": { exitCode: 0, stdout: '  "IOPlatformUUID" = "0A1B-2C3D"\n' } }), mac)).toBe("0A1B-2C3D");
    expect(mac.awake?.(42)).toEqual(["caffeinate", "-i", "-w", "42"]);
  });

  test("Linux reads /etc/machine-id, then dbus's copy, and never holds awake: polkit denies a user unit", async () => {
    const linux = platformOf("linux")!;

    expect(await machineId(ran({ "cat /etc/machine-id": { exitCode: 0, stdout: "3f9c0d\n" } }), linux)).toBe("3f9c0d");
    expect(await machineId(ran({ "cat /var/lib/dbus/machine-id": { exitCode: 0, stdout: "77ab\n" } }), linux)).toBe("77ab");
    expect(await machineId(ran({ "cat /etc/machine-id": { exitCode: 0, stdout: "\n" }, "cat /var/lib/dbus/machine-id": { exitCode: 0, stdout: "77ab\n" } }), linux)).toBe("77ab");
    expect(linux.awake).toBeNull();
  });

  test("a machine with no id fails naming every source it tried", async () => {
    const tried = machineId(ran({ "cat /etc/machine-id": { exitCode: 0, stdout: "\n" } }), platformOf("linux")!);

    await expect(tried).rejects.toThrow("no machine id: `cat /etc/machine-id` printed no id; `cat /var/lib/dbus/machine-id` failed: No such file or directory");
  });

  test("any other platform has none, so the worker refuses to start", () => {
    expect(platformOf("win32")).toBeNull();
  });

  test("this machine has an id", async () => {
    expect(await machineId(run, platformOf(process.platform)!)).toBeTruthy();
  });
});

describe("rules the bot's own PR changed stop the worker", () => {
  test("the newest commit to the rules file is asked for its PRs: the bot's names its PR, a person's or none is null", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-rules-by-"));
    const git = (...a: string[]) => gitIn(dir, ...a);
    await git("init", "-q", "-b", "main");
    await mkdir(join(dir, ".claude"));
    await Bun.write(join(dir, RULES_PATH), "{}");
    await git("add", RULES_PATH);
    await git("commit", "-q", "-m", "rules");
    const rules = (await git("rev-parse", "HEAD")).trim();
    await git("commit", "-q", "--allow-empty", "-m", "later");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    await git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");

    const asked: string[] = [];

    const github = (pulls: unknown[]): Run => async (argv, opts) => {
      if (argv[0] === "git") return run(argv, opts);
      asked.push(argv.at(-1) ?? "");

      return { exitCode: 0, stdout: JSON.stringify(pulls), stderr: "" };
    };

    expect(await rulesChangedBy(github([{ number: 12, user: { login: BOT } }]), dir, "o/r", BOT)).toBe(12);
    expect(await rulesChangedBy(github([{ number: 13, user: { login: ME } }]), dir, "o/r", BOT)).toBe(null);
    expect(await rulesChangedBy(github([]), dir, "o/r", BOT)).toBe(null);
    expect(asked).toEqual(Array(3).fill(`repos/o/r/commits/${rules}/pulls`));
    await rm(dir, { recursive: true });
  });
});

describe("a missing rules file says to run setup, not git's words", () => {
  test("absent, present, and malformed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-rules-"));
    const git = (...a: string[]) => gitIn(dir, ...a);
    await git("init", "-q", "-b", "main");
    await git("commit", "-q", "--allow-empty", "-m", "base");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    await git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");

    await expect(readRules(run, dir)).rejects.toThrow(/^no \.claude\/factory\.json on origin\/main; run \/factory:setup$/);

    await mkdir(join(dir, ".claude"));
    await Bun.write(join(dir, RULES_PATH), JSON.stringify(SMOKE_RULES));
    await git("add", RULES_PATH);
    await git("commit", "-q", "-m", "rules");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    expect(await readRules(run, dir)).toEqual(SMOKE_RULES);

    await Bun.write(join(dir, RULES_PATH), "{");
    await git("commit", "-q", "-am", "broken");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    await expect(readRules(run, dir)).rejects.toThrow(/is not JSON/);
    await rm(dir, { recursive: true });
  });
});

describe("the worker starts on any Claude setup and refuses only without one", () => {
  test("claude auth status: subscription, API key, apiKeyHelper, Bedrock, logged out (2.1.x, 2026-10-27)", () => {
    expect(loginRefusal({ stdout: '{"loggedIn": true, "authMethod": "claude.ai", "subscriptionType": "max"}', stderr: "" })).toBe("");
    expect(loginRefusal({ stdout: '{"loggedIn": true, "authMethod": "api_key", "apiKeySource": "ANTHROPIC_API_KEY"}', stderr: "" })).toBe("");
    expect(loginRefusal({ stdout: '{"loggedIn": true, "authMethod": "api_key_helper", "apiKeySource": "apiKeyHelper"}', stderr: "" })).toBe("");
    expect(loginRefusal({ stdout: '{"loggedIn": true, "authMethod": "third_party", "apiProvider": "bedrock"}', stderr: "" })).toBe("");
    expect(loginRefusal({ stdout: '{"loggedIn": false, "authMethod": "none", "apiProvider": "firstParty"}', stderr: "" })).toContain("claude auth login");
    expect(loginRefusal({ stdout: "", stderr: "unknown command" })).toContain("unknown command");
  });
});

describe("the setup skill", () => {
  const skill = () => Bun.file(join(import.meta.dir, "..", "skills", "setup", "SKILL.md")).text();

  test("creates every label the factory reads or writes", async () => {
    const text = await skill();

    for (const label of [LABEL, STUCK_LABEL, UNDO_LABEL]) expect(text).toContain(`gh label create ${label} --force`);
  });
  test("names every field of the rules file", async () => {
    const text = await skill();

    for (const key of Object.keys(Rules.shape)) expect(text).toMatch(new RegExp(`\`${key}[\`.]`));
  });
});
