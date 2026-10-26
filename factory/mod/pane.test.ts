import type { CommandRunInput, On } from "claude-code";
import { describe, expect, mock, test, type MountTarget } from "claude-code/testing";
import { approvalQuestion, render, type FactoryComment } from "../lib/formats.ts";
import { STUCK_LABEL } from "../lib/github.ts";
import {
  UNDO_LABEL,
  rows,
  undoLine,
  undone,
  type Snapshot,
} from "./rows.ts";

const PANE = {
  plugin: "factory",
  surface: "terminal",
  component: "Pane",
  requestId: "factory",
  // SAFETY: the pane draws from GitHub's rows and reads none of the engine's Pane props.
  props: {} as MountTarget<"terminal", "Pane">["props"],
} as const;

const comment = (databaseId: number, c: FactoryComment) => ({
  databaseId,
  body: render(c),
  url: `https://github.com/o/smoke/issues/${c.issue}#issuecomment-${databaseId}`,
  createdAt: "2026-10-26T20:00:00Z",
  authorAssociation: "OWNER",
  author: { login: "saadshahd" },
});

const SEAL = "ab12cd34".repeat(8);

const issue = (number: number, title: string, cs: ReturnType<typeof comment>[]) => ({
  number,
  title,
  url: `https://github.com/o/smoke/issues/${number}`,
  state: "OPEN" as const,
  labels: { nodes: [{ name: "factory" }] },
  comments: { nodes: cs },
});

/** One question waiting, one plan waiting, and one wait already answered on github.com. */
const WAITING = [
  issue(9, "Settings layout", [
    comment(90, {
      kind: "wait",
      issue: 9,
      questions: [
        { question: "Which settings move to 'agents'?", why: "only you know which you use daily", options: ["all three", "just keys"] },
      ],
      answers: null,
    }),
  ]),
  issue(10, "Rail items", [
    comment(100, { kind: "plan", issue: 10, seal: SEAL, approved: null, text: "## Types\n\ntype RailItem = { id: string }" }),
    comment(101, {
      kind: "wait",
      issue: 10,
      questions: [
        { question: approvalQuestion(10, SEAL), why: "the plan adds a new type", options: ["Approve", "Change it"] },
      ],
      answers: null,
    }),
  ]),
  issue(11, "Answered elsewhere", [
    comment(110, {
      kind: "wait",
      issue: 11,
      questions: [{ question: "Keep it?", why: "two callers", options: ["yes", "no"] }],
      answers: null,
    }),
    comment(111, { kind: "answer", issue: 11, wait: 110, answers: ["yes"] }),
  ]),
  issue(12, "Answered by a stranger", [
    comment(120, {
      kind: "wait",
      issue: 12,
      questions: [{ question: "Rename it?", why: "the name is taken", options: ["yes", "no"] }],
      answers: null,
    }),
    { ...comment(121, { kind: "answer", issue: 12, wait: 120, answers: ["yes"] }), authorAssociation: "NONE" },
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

/** GitHub's answer for a repo with one stuck run, two calls (one undone) and two merged PRs. */
function snapshot(): Snapshot {
  return {
    data: {
      repository: {
        work: {
          nodes: [
            ...WAITING,
            {
              number: 7,
              title: "Settings sections",
              url: "https://github.com/o/smoke/issues/7",
              state: "OPEN",
              labels: { nodes: [{ name: "factory" }, { name: STUCK_LABEL }] },
              comments: {
                nodes: [
                  comment(70, {
                    kind: "stuck",
                    issue: 7,
                    reason: "old reason",
                  }),
                  comment(71, {
                    kind: "stuck",
                    issue: 7,
                    reason: "3 crashes in a row",
                  }),
                ],
              },
            },
            {
              number: 8,
              title: "Empty states",
              url: "https://github.com/o/smoke/issues/8",
              state: "OPEN",
              labels: { nodes: [{ name: "factory" }] },
              comments: {
                nodes: [
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
                  comment(82, {
                    kind: "stuck",
                    issue: 8,
                    reason: "cleared by retry",
                  }),
                ],
              },
            },
          ],
        },
        undos: { nodes: [{ body: `…\n\n${undoLine(81)}` }] },
        merged: {
          nodes: [
            {
              number: 20,
              headRefName: "factory/7",
              comments: { nodes: [{ body: render(cost(7, 20, 1_000)) }] },
            },
            {
              number: 21,
              headRefName: "factory/8",
              comments: { nodes: [{ body: render(cost(8, 21, 3_000)) }] },
            },
            {
              number: 22,
              headRefName: "fix/by-hand",
              comments: { nodes: [{ body: render(cost(9, 22, 9_999_999)) }] },
            },
          ],
        },
      },
    },
  };
}

describe("rows", () => {
  test("undone reads back exactly the ids undoLine wrote", () => {
    expect([...undone([`intro\n\n${undoLine(81)}\n\nend`, undoLine(5), "Undoes factory call 9x"])]).toEqual([81, 5]);
  });

  test("a wait waits until an answer lands; one asking approval is a plan", () => {
    const r = rows(snapshot());

    // A stranger's answer leaves the wait open: only someone who can push may answer a run.
    expect(r.questions.map((w) => w.id)).toEqual([90, 120]);
    expect(r.plans.map((w) => [w.id, w.plan])).toEqual([[101, "## Types\n\ntype RailItem = { id: string }"]]);
  });

  test("stuck takes the label and the newest reason", () => {
    expect(rows(snapshot()).stuck).toEqual([
      {
        issue: 7,
        title: "Settings sections",
        url: "https://github.com/o/smoke/issues/7",
        reason: "3 crashes in a row",
      },
    ]);
  });

  test("an undone call drops out", () => {
    expect(rows(snapshot()).calls.map((c) => c.id)).toEqual([80]);
  });

  test("cost counts every token kind, on factory branches only", () => {
    expect(rows(snapshot()).costs).toEqual([
      { pr: 20, tokens: 4_000 },
      { pr: 21, tokens: 6_000 },
    ]);
  });
});

/** GitHub, the folder and the screen beneath the plugin; `hold` keeps `gh issue create` running. */
function world(on: On, hold?: Promise<void>) {
  const ran: string[][] = [];
  const posted: string[] = [];
  const toasts: string[] = [];

  on("process.run", async (_$, e) => {
    ran.push([...e.argv]);

    if (e.init?.stdin) posted.push(e.init.stdin);

    const out = (stdout: string) => ({
      value: {
        exitCode: 0,
        stdout,
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    });

    const a = e.argv.join(" ");

    if (a.startsWith("gh repo view")) return out("o/smoke\n");

    if (a.startsWith("gh api graphql")) return out(JSON.stringify(snapshot()));

    if (hold && a.startsWith("gh issue create")) await hold;

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

  // SAFETY: the command reads neither who ran it nor how its answer shows.
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
  expect(await ui.find({ type: "Text", text: /^ undo $/ })).toBeDefined();
  await ui.unmount();
});

test("/factory draws GitHub's rows and an undo opens one issue", async ($, on) => {
  const { ran, posted, toasts } = world(on);

  // SAFETY: the command reads neither who ran it nor how its answer shows.
  await $.command.run({ command: "factory", args: "" } as CommandRunInput);

  const ui = await $.ui.mount(PANE);

  expect(await ui.find({ type: "Text", text: /move to 'agents'/ })).toBeDefined();
  await ui.press({ key: "opt-90-0-1" });
  const answered = ran.filter((a) => a.join(" ").includes("repos/o/smoke/issues/9/comments") && a.includes("--input"));

  expect(answered).toHaveLength(1);
  expect(JSON.parse(posted.at(-1)!).body).toBe(
    render({ kind: "answer", issue: 9, wait: 90, answers: ["just keys"] }),
  );

  await ui.press({ key: "tab-plans" });
  await ui.press({ key: "plan-101" });
  expect(await ui.find({ text: /type RailItem/ })).toBeDefined();

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

  // The label exists before anything lists or uses it: a fresh repo has none.
  expect(order.indexOf("gh label create")).toBeLessThan(order.indexOf("gh issue list"));
  expect(created).toHaveLength(1);
  expect(created[0]).toContain(UNDO_LABEL);
  expect(created[0]!.join(" ")).toContain(undoLine(80));
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
