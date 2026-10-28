import { describe, expect, test } from "bun:test";
import { usage } from "../lib/commands.ts";
import { parse, render, type FactoryComment, type Wait } from "../lib/formats.ts";
import { STUCK_LABEL, type Actors, type Comment } from "../lib/github.ts";
import { planGaps } from "../lib/plan.ts";
import type { Rules } from "../lib/rules.ts";
import type { Issue, Pr, Snapshot } from "../lib/snapshot.ts";
import { APPROVAL_QUESTION } from "../lib/wait.ts";
import { seal } from "./cli.ts";
import {
  actionsFor,
  classify,
  CRASHES_BEFORE_STUCK,
  decide,
  deathsSinceRetry,
  NEXT,
  occupies,
  pick,
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
import { actorsOf, readRules, RULES_PATH } from "../lib/rules.ts";
import { AGENTS_AT_TICK, AGENTS_LATER, ISSUES, OPEN_ASK, RULES as SMOKE_RULES } from "./fixtures/smoke1.ts";
import { run } from "./proc.ts";
import { claimIn, runView, sessionsNamed } from "./snapshot.ts";
import { ISSUE_5, PR_8 } from "./fixtures/smoke2.ts";
import { upsert, type Run } from "../lib/github.ts";
import { gitConfigEnv } from "../lib/bot.ts";
import { runSettings } from "./sandbox.ts";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
  base: { name: "main", sha: "m1", checks: "SUCCESS" },
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
  path: `/wt/${n}`,
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
  mergeable: "MERGEABLE",
  mergeState: "BLOCKED",
  headSha: "h1",
  comments: [],
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

    expect(state).toEqual({ kind: "ended", why: "closed", pr: 57 });
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
        open: [{ ...pr(3), number: 9, head, files: ["src/a.ts"] }],
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
  test("failed checks while the base's own newest commit is red hold the PR: no wake, no count", () => {
    const failing = pr(7, { checks: "FAILURE" });

    const onBase = (checks: string) =>
      step(world(gh(failing, { base: { name: "main", sha: "m1", checks } }), [here(7, [session("stopped")])]));

    const red = onBase("FAILURE");

    expect(red.state).toEqual({ kind: "held", on: { kind: "red", pr: 57, base: "main" }, posted: false });
    expect(red.actions).toEqual([]);
    expect(occupies(red.state)).toBe(false);
    expect(stateLine(red.state)).toBe("held: main is red, so PR #57's failed checks wait for it to go green");
    expect(onBase("PENDING").state.kind).toBe("checksFailed");
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
    const w = world({ ...gh, open: [{ ...pr(3), files: ["src/a.ts"] }] }, [here(7, [session("done")])]);

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
      open: [{ ...pr(3), number: 9, head: "x", files: null }],
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
  test("it dictates the approval question the ask hook recognises, and watches checks once a minute", () => {
    expect(p()).toContain(`question "${APPROVAL_QUESTION}"`);
    expect(p()).toContain("gh pr checks --watch --interval 60");

    function p() {
      return runPrompt(base);
    }
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

describe("a worktree counts as this machine's run only when its branch carries this machine's claim", () => {
  test("its own claim, another machine's, none, and an unreadable ref", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-claim-"));
    const git = (...a: string[]) => run(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
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

describe("a missing rules file says to run setup, not git's words", () => {
  test("absent, present, and malformed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "factory-rules-"));
    const git = (...a: string[]) => run(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
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
