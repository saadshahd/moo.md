import type { CommandRunInput, On } from "claude-code";
import { describe, expect, mock, test, type MountTarget } from "claude-code/testing";
import { parse, render, type FactoryComment } from "../lib/formats.ts";
import { STUCK_LABEL } from "../lib/github.ts";
import { actorsOf, parseRules } from "../lib/rules.ts";
import { UNDO_LABEL, readSnapshot, type Snapshot } from "../lib/snapshot.ts";
import { APPROVAL_QUESTION, answerFor } from "../lib/wait.ts";
import { rows, undoIssue } from "./rows.ts";

const PANE = {
  plugin: "factory",
  surface: "terminal",
  component: "Pane",
  requestId: "factory",
  /** SAFETY: the pane draws from GitHub's rows and reads none of the engine's Pane props. */
  props: {} as MountTarget<"terminal", "Pane">["props"],
} as const;

const ME = { __typename: "User", login: "o" };
const BOT = { __typename: "Bot", login: "moo-factory" };
const STRANGER = { __typename: "User", login: "drive-by" };

const RULES = {
  atOnce: 1,
  waitsPerDay: 5,
  contextCap: 150_000,
  bot: "moo-factory[bot]",
  taste: [],
  layers: { check: [], plan: [], judge: [], none: [] },
};

const rules = parseRules(JSON.stringify(RULES));

if ("errors" in rules) throw new Error(rules.errors.join("; "));

const ACTORS = actorsOf(rules, "o/smoke");

type Actor = { __typename: string; login: string };

const comment = (databaseId: number, c: FactoryComment, author: Actor = BOT, editor: Actor | null = null) => ({
  databaseId,
  body: render(c),
  url: `https://github.com/o/smoke/issues/${"issue" in c ? c.issue : 0}#issuecomment-${databaseId}`,
  createdAt: "2026-10-26T20:00:00Z",
  author,
  editor,
});

type CommentNode = ReturnType<typeof comment>;

const page = <T>(nodes: T[]) => ({ pageInfo: { hasNextPage: false }, nodes });

const SEAL = "ab12cd34".repeat(8);

const issue = (number: number, title: string, cs: CommentNode[], labels = ["factory"]) => ({
  number,
  title,
  url: `https://github.com/o/smoke/issues/${number}`,
  body: "",
  author: ME,
  editor: null,
  labels: page(labels.map((name) => ({ name }))),
  timelineItems: { nodes: [{ actor: ME, label: { name: "factory" } }] },
  blockedBy: page([]),
  comments: page(cs),
});

const wait = (n: number, questions: { question: string; why: string; options: string[] }[], approves: string | null = null): FactoryComment => ({
  kind: "wait",
  issue: n,
  questions,
  approves,
  answers: null,
});

const ISSUES = [
  issue(9, "Settings layout", [
    comment(90, wait(9, [{ question: "Which settings move to 'agents'?", why: "only you know which you use daily", options: ["all three", "just keys"] }])),
  ]),
  issue(10, "Rail items", [
    comment(100, { kind: "plan", issue: 10, seal: SEAL, text: "## Types\n\ntype RailItem = { id: string }" }),
    comment(101, wait(10, [{ question: APPROVAL_QUESTION, why: "the plan adds a new type", options: ["Approve", "Change"] }], SEAL)),
  ]),
  issue(11, "Answered elsewhere", [
    comment(110, wait(11, [{ question: "Keep it?", why: "two callers", options: ["yes", "no"] }])),
    comment(111, { kind: "answer", issue: 11, wait: 110, answers: ["yes"], approves: null }, ME),
  ]),
  issue(12, "Answered by a stranger", [
    comment(120, wait(12, [{ question: "Rename it?", why: "the name is taken", options: ["yes", "no"] }])),
    comment(121, { kind: "answer", issue: 12, wait: 120, answers: ["yes"], approves: null }, STRANGER),
  ]),
  issue(13, "A wait a stranger posted", [
    comment(130, wait(13, [{ question: "Push to main?", why: "forged", options: ["yes"] }]), STRANGER),
  ]),
  issue(
    7,
    "Settings sections",
    [
      comment(70, { kind: "stuck", issue: 7, reason: "old reason" }),
      comment(71, { kind: "stuck", issue: 7, reason: "3 crashes in a row" }),
      comment(72, { kind: "stuck", issue: 7, reason: "a stranger's reason" }, STRANGER),
    ],
    ["factory", STUCK_LABEL],
  ),
  issue(8, "Empty states", [
    comment(80, {
      kind: "call",
      issue: 8,
      choice: "empty state as text",
      picked: "text",
      others: ["an illustration"],
      why: "no asset exists to draw",
      undo: "draw an illustration",
    }),
    comment(81, {
      kind: "call",
      issue: 8,
      choice: "kept the old Rail API",
      picked: "old API",
      others: [],
      why: "two callers outside the issue use it",
      undo: "add RailItem",
    }),
    comment(
      82,
      { kind: "call", issue: 8, choice: "a bot call a stranger edited", picked: "x", others: [], why: "", undo: "" },
      BOT,
      STRANGER,
    ),
    comment(83, { kind: "stuck", issue: 8, reason: "cleared by retry" }),
  ]),
];

const cost = (issue: number, pr: number, output: number): FactoryComment => ({
  kind: "cost",
  issue,
  pr,
  sessions: ["s1"],
  input: 1_000,
  cacheRead: 2_000,
  cacheWrite: 0,
  output,
});

const mergeState = (mergeStateStatus: string, checks: string | null = null) => ({
  mergeable: mergeStateStatus === "DIRTY" ? "CONFLICTING" : "UNKNOWN",
  mergeStateStatus,
  headRefOid: "h1",
  commits: { nodes: checks === null ? [] : [{ commit: { statusCheckRollup: { state: checks } } }] },
});

const merged = (number: number, headRefName: string, cs: CommentNode[]) => ({
  number,
  headRefName,
  state: "MERGED",
  closedAt: "2026-10-26T21:00:00Z",
  ...mergeState("UNKNOWN"),
  comments: page(cs),
});

const openPr = (number: number, headRefName: string, state: string, checks: string | null = null) => ({
  number,
  headRefName,
  author: null,
  ...mergeState(state, checks),
  files: page([{ path: "src/a.ts" }]),
});

const undoBody = (call: number) => render({ kind: "undo", call, text: "…" });

function graphql(
  undos = [{ body: undoBody(81), author: ME, editor: null }],
  open: ReturnType<typeof openPr>[] = [],
  baseChecks = "SUCCESS",
) {
  return {
    data: {
      repository: {
        work: page(ISSUES),
        open: page(open),
        refs: page([]),
        undos: page([...undos, { body: undoBody(80), author: STRANGER, editor: null }]),
        merged: {
          pageInfo: { hasNextPage: true },
          nodes: [
            merged(20, "factory/7", [comment(200, cost(7, 20, 1_000))]),
            merged(21, "factory/8", [comment(210, cost(8, 21, 3_000)), comment(211, cost(8, 21, 99_000_000), STRANGER)]),
            merged(22, "fix/by-hand", [comment(220, cost(9, 22, 9_999_999))]),
          ],
        },
        base: {
          name: "main",
          target: { oid: "m1", statusCheckRollup: { contexts: page([{ __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: baseChecks }]) } },
        },
      },
    },
  };
}

/** Any PR's newest commit as the second query reads it: the one check its PR requires, `test`, failed. */
const REQUIRED = {
  data: {
    repository: {
      pullRequest: {
        commits: {
          nodes: [{ commit: { statusCheckRollup: { contexts: page([{ __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "FAILURE", isRequired: true }]) } } }],
        },
      },
    },
  },
};

const asksRequired = (argv: readonly string[]) => argv.some((a) => a.startsWith("query=") && a.includes("isRequired"));

async function snapshot(raw = graphql()): Promise<Snapshot> {
  return readSnapshot(async (argv) => ({ exitCode: 0, stdout: JSON.stringify(asksRequired(argv) ? REQUIRED : raw), stderr: "" }), "o/smoke", []);
}

describe("rows", () => {
  test("a wait waits until a trusted person answers it; a stranger's wait never shows", async () => {
    expect(rows(await snapshot(), ACTORS).questions.map((w) => w.waitId)).toEqual([90, 120]);
  });

  test("a wait whose approves names a seal is a plan, with that plan's text", async () => {
    const r = rows(await snapshot(), ACTORS);

    expect(r.plans.map((w) => [w.waitId, w.plan])).toEqual([[101, "## Types\n\ntype RailItem = { id: string }"]]);
  });

  test("stuck takes the label and the bot's newest reason", async () => {
    expect(rows(await snapshot(), ACTORS).stuck).toEqual([
      {
        issue: 7,
        title: "Settings sections",
        url: "https://github.com/o/smoke/issues/7",
        reason: "3 crashes in a row",
      },
    ]);
  });

  test("a call drops out once a trusted person's undo issue names it, or a stranger edits it", async () => {
    expect(rows(await snapshot(), ACTORS).calls.map((c) => c.callId)).toEqual([80]);
  });

  test("cost counts the bot's cost comments on factory branches only", async () => {
    expect(rows(await snapshot(), ACTORS).costs).toEqual([
      { pr: 20, tokens: 4_000 },
      { pr: 21, tokens: 6_000 },
    ]);
  });

  test("windows GitHub listed only in part reach the rows", async () => {
    expect(rows(await snapshot(), ACTORS).truncated).toEqual(["merged PRs"]);
  });

  test("held says what each trusted, unstuck issue waits for: its PR's merge state, or a red main", async () => {
    const open = [
      openPr(30, "factory/9", "BEHIND"),
      openPr(31, "factory/10", "DIRTY"),
      openPr(32, "factory/11", "BLOCKED", "FAILURE"),
      openPr(33, "factory/7", "DIRTY"),
      openPr(34, "factory/13", "DIRTY"),
    ];

    expect(rows(await snapshot(graphql(undefined, open, "FAILURE")), ACTORS).held).toEqual([
      { issue: 9, title: "Settings layout", url: "https://github.com/o/smoke/issues/9", line: "PR #30 is behind main; the worker updates its branch" },
      { issue: 10, title: "Rail items", url: "https://github.com/o/smoke/issues/10", line: "PR #31 conflicts with main; its run merges main in" },
      { issue: 11, title: "Answered elsewhere", url: "https://github.com/o/smoke/issues/11", line: "held: main is red, so PR #32's failed checks wait for it to go green" },
      { issue: 13, title: "A wait a stranger posted", url: "https://github.com/o/smoke/issues/13", line: "PR #34 conflicts with main; its run merges main in" },
    ]);
    expect(rows(await snapshot(graphql(undefined, [openPr(32, "factory/11", "BLOCKED", "FAILURE")])), ACTORS).held).toEqual([]);
  });
  test("an undo issue's body reads back as the call it undoes", async () => {
    const r = rows(await snapshot(), ACTORS);
    const body = parse(undoIssue(r.calls[0]!).body);

    expect(body?.kind === "undo" && body.call).toBe(80);
  });
});

function world(on: On, holdIssueCreate?: Promise<void>, rulesFile: (typeof RULES & { paneEverySeconds?: number }) | null = RULES) {
  const ran: string[][] = [];
  const posted: string[] = [];
  const toasts: string[] = [];
  const undos = [{ body: undoBody(81), author: ME, editor: null }];

  on("process.run", async (_$, e) => {
    ran.push([...e.argv]);

    if (e.init?.stdin) posted.push(e.init.stdin);

    const out = (stdout: string, exitCode = 0, stderr = "") => ({
      value: {
        exitCode,
        stdout,
        stderr,
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    });

    const a = e.argv.join(" ");

    if (a.startsWith("gh repo view")) return out("o/smoke\n");

    if (a.startsWith("git show"))
      return rulesFile === null
        ? out("", 128, "fatal: path '.claude/factory.json' does not exist in 'refs/remotes/origin/HEAD'")
        : out(JSON.stringify(rulesFile));

    if (a.startsWith("git symbolic-ref")) return out("origin/main\n");

    if (a.startsWith("gh api graphql --paginate")) {
      const n = Number(e.argv.find((x) => x.startsWith("n="))?.slice(2));
      const nodes = ISSUES.find((i) => i.number === n)?.comments.nodes ?? [];

      return out(JSON.stringify([{ data: { repository: { issueOrPullRequest: { comments: { nodes } } } } }]));
    }

    if (a.startsWith("gh api graphql")) return out(JSON.stringify(asksRequired(e.argv) ? REQUIRED : graphql(undos)));

    if (a.startsWith("gh issue create")) {
      if (holdIssueCreate) await holdIssueCreate;
      undos.push({ body: e.argv[e.argv.indexOf("--body") + 1]!, author: ME, editor: null });
    }

    return out("");
  });

  on("session.cwd", async () => ({ value: "/work/smoke" }));
  on("ui.open", async () => ({ value: { isPlaced: true } }));
  on("ui.toast", async (_$, e) => {
    toasts.push(e.text);

    return { value: undefined };
  });

  return { ran, posted, toasts, clock: mock.clock(on) };
}

test("a module reload leaves the pane open; its next draw reads GitHub again", async ($, on) => {
  const w = world(on);
  const ui = await $.ui.mount(PANE);

  expect(await ui.find({ type: "Text", text: /reading GitHub/ })).toBeDefined();
  await w.clock.advance(1);
  expect(await ui.find({ type: "Text", text: /move to 'agents'/ })).toBeDefined();
  await ui.unmount();
});

test("a pressed action spins until its write ends, and other actions wait", async ($, on) => {
  let release = () => {};
  const w = world(on, new Promise<void>((r) => (release = r)));

  /** SAFETY: the command reads neither who ran it nor how its answer shows. */
  await $.command.run({ command: "factory", args: "" } as CommandRunInput);
  const ui = await $.ui.mount(PANE);

  await ui.press({ key: "tab-calls" });
  const pressing = ui.press({ key: "undo-80" });

  await w.clock.advance(1);
  expect(await ui.find({ type: "Text", text: /⠋ undo/ })).toBeDefined();
  await w.clock.advance(80);
  expect(await ui.find({ type: "Text", text: /⠙ undo/ })).toBeDefined();
  await ui.press({ key: "tab-stuck" });
  await ui.press({ key: "retry-7" });
  expect(w.ran.some((a) => a.slice(0, 3).join(" ") === "gh issue edit")).toBe(false);
  await ui.press({ key: "tab-calls" });
  release();
  await pressing;
  expect(await ui.find({ type: "Text", text: /undo/ })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: /no call to review/ })).toBeDefined();
  await ui.unmount();
});

test("/factory draws GitHub's rows; an undo makes its label first and opens one issue", async ($, on) => {
  const { ran, posted, toasts } = world(on);

  /** SAFETY: the command reads neither who ran it nor how its answer shows. */
  await $.command.run({ command: "factory", args: "" } as CommandRunInput);

  const ui = await $.ui.mount(PANE);

  expect(await ui.find({ type: "Text", text: /move to 'agents'/ })).toBeDefined();
  await ui.press({ key: "opt-90-0-1" });
  const answered = ran.filter((a) => a.join(" ").includes("repos/o/smoke/issues/9/comments") && a.includes("--input"));

  expect(answered).toHaveLength(1);
  expect(JSON.parse(posted.at(-1)!).body).toBe(
    render({ kind: "answer", issue: 9, wait: 90, answers: ["just keys"], approves: null }),
  );

  await ui.press({ key: "tab-plans" });
  await ui.press({ key: "plan-101" });
  expect(await ui.find({ text: /type RailItem/ })).toBeDefined();
  await ui.press({ key: "opt-101-0-0" });
  expect(JSON.parse(posted.at(-1)!).body).toBe(
    render(answerFor(101, { kind: "wait", issue: 10, questions: [{ question: APPROVAL_QUESTION, why: "the plan adds a new type", options: ["Approve", "Change"] }], approves: SEAL, answers: null }, ["Approve"])),
  );
  expect(parse(JSON.parse(posted.at(-1)!).body)).toMatchObject({ kind: "answer", approves: SEAL });

  await ui.press({ key: "tab-stuck" });
  await ui.press({ key: "retry-7" });
  expect(ran.some((a) => a.join(" ") === `gh issue edit 7 --repo o/smoke --remove-label ${STUCK_LABEL}`)).toBe(true);

  expect(
    await ui.find({ type: "Text", text: /3 crashes in a row/ }),
  ).toBeDefined();
  expect(
    await ui.find({ type: "Text", text: /tokens\/PR\(5k\)/ }),
  ).toBeDefined();

  await ui.press({ key: "tab-calls" });
  expect(
    await ui.find({ type: "Text", text: /empty state as text/ }),
  ).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^an illustration$/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /no asset exists to draw/ })).toBeDefined();
  expect(
    await ui.find({ type: "Text", text: /kept the old Rail API/ }),
  ).toBeUndefined();

  await ui.press({ key: "undo-80" });

  const created = ran.filter(
    (a) => a.slice(0, 3).join(" ") === "gh issue create",
  );

  const order = ran.map((a) => a.slice(0, 3).join(" "));

  expect(order.lastIndexOf("gh label create")).toBeLessThan(order.lastIndexOf("gh issue create"));
  expect(created).toHaveLength(1);
  expect(created[0]).toContain(UNDO_LABEL);
  expect(parse(created[0]![created[0]!.indexOf("--body") + 1]!)).toMatchObject({ kind: "undo", call: 80 });
  expect(created[0]).not.toContain("factory");
  expect(toasts).toEqual([
    'factory: opened an issue to undo "empty state as text"',
  ]);

  await ui.press({ key: "tab-cost" });
  expect(
    await ui.find({ type: "Text", text: /2 PRs · avg 5k tokens/ }),
  ).toBeDefined();
  expect(await ui.find({ type: "Text", text: /6,000/ })).toBeDefined();
  await ui.unmount();
});

const snapshotReads = (ran: string[][]) =>
  ran.filter((a) => a.slice(0, 3).join(" ") === "gh api graphql" && !a.includes("--paginate")).length;

test("the open pane reads GitHub every 20 s by default, and again right after a press", async ($, on) => {
  const w = world(on);

  /** SAFETY: the command reads neither who ran it nor how its answer shows. */
  await $.command.run({ command: "factory", args: "" } as CommandRunInput);
  const ui = await $.ui.mount(PANE);

  await w.clock.advance(1);
  const first = snapshotReads(w.ran);

  await w.clock.advance(19_000);
  expect(snapshotReads(w.ran)).toBe(first);
  await w.clock.advance(1_000);
  expect(snapshotReads(w.ran)).toBe(first + 1);
  await ui.press({ key: "tab-stuck" });
  await ui.press({ key: "retry-7" });
  expect(snapshotReads(w.ran)).toBe(first + 2);
  await ui.unmount();
});

test("paneEverySeconds in the rules sets how often the pane reads GitHub", async ($, on) => {
  const w = world(on, undefined, { ...RULES, paneEverySeconds: 30 });

  /** SAFETY: the command reads neither who ran it nor how its answer shows. */
  await $.command.run({ command: "factory", args: "" } as CommandRunInput);
  const ui = await $.ui.mount(PANE);

  await w.clock.advance(1);
  const first = snapshotReads(w.ran);

  await w.clock.advance(29_000);
  expect(snapshotReads(w.ran)).toBe(first);
  await w.clock.advance(1_000);
  expect(snapshotReads(w.ran)).toBe(first + 1);
  await ui.unmount();
});

test("the rules refuse a pane refresh under 10 s", () => {
  expect("errors" in parseRules(JSON.stringify({ ...RULES, paneEverySeconds: 9 }))).toBe(true);
  expect("errors" in parseRules(JSON.stringify({ ...RULES, paneEverySeconds: 10 }))).toBe(false);
});

test("with no rules file on origin, the pane names setup once", async ($, on) => {
  const w = world(on, undefined, null);
  const ui = await $.ui.mount(PANE);

  await w.clock.advance(1);
  const shown = await ui.find({ type: "Text", text: /factory:setup/ });

  expect(shown?.text).toBe("no .claude/factory.json on origin/main; run /factory:setup");
  await ui.unmount();
});
