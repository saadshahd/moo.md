import type { CommandRunInput } from "claude-code";
import { describe, expect, test, type MountTarget } from "claude-code/testing";
import { render, type FactoryComment } from "../lib/formats.ts";
import {
  STUCK_LABEL,
  UNDO_LABEL,
  rows,
  undoLine,
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
});

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
                    picked: "text, since no asset exists",
                    undo: "draw an illustration",
                  }),
                  comment(81, {
                    kind: "call",
                    issue: 8,
                    choice: "kept the old Rail API",
                    picked: "old API",
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

test("/factory draws GitHub's rows and an undo opens one issue", async ($, on) => {
  const ran: string[][] = [];

  on("process.run", async (_$, e) => {
    ran.push([...e.argv]);

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

    return out("");
  });

  const toasts: string[] = [];

  on("session.cwd", async () => ({ value: "/work/smoke" }));
  on("clock.every", async () => ({ value: undefined }));
  on("ui.open", async () => ({ value: { isPlaced: true } }));
  on("ui.toast", async (_$, e) => {
    toasts.push(e.text);

    return { value: undefined };
  });

  // SAFETY: the command reads neither who ran it nor how its answer shows.
  await $.command.run({ command: "factory", args: "" } as CommandRunInput);

  const ui = await $.ui.mount(PANE);

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
