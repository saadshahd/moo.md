import { describe, expect, mock, test } from "claude-code/testing";
import {
  MAX_CHECKS,
  WORDS_KEPT,
  labelText,
  lastOrder,
  shouldCheck,
  userWords,
} from "./unsaid.tsx";

const ORDER = [
  "**Ask:** Turn each piece of feedback into a GitHub Issue",
  "**Bar:** each Issue number is told to the user",
  "",
  "**Not:** open a PR",
  "**Assumed:** one Issue per message",
].join("\n");

describe("the work order", () => {
  test("is a reply's last run of labelled lines, outside quotes and code", () => {
    const reply = [
      "**Ask:** an old ask",
      "Restated:",
      ORDER,
      "> **Ask:** quoted",
      "```",
      "**Bar:** in code",
      "```",
      "Take it?",
    ].join("\n");
    expect(lastOrder(reply)).toEqual({
      text: ORDER.replace("\n\n", "\n"),
      lines: [
        { kind: "ask", text: "Turn each piece of feedback into a GitHub Issue" },
        { kind: "bar", text: "each Issue number is told to the user" },
        { kind: "not", text: "open a PR" },
        { kind: "assumed", text: "one Issue per message" },
      ],
    });
    expect(lastOrder("> **Ask:** quoted\n```\n**Ask:** in code\n```")).toBeUndefined();
  });
  test("is checked when new, not again, and none past the session's last check", () => {
    expect(shouldCheck([], "a")).toBe(true);
    expect(shouldCheck(["a"], "a")).toBe(false);
    const full = Array.from({ length: MAX_CHECKS }, (_, i) => `order ${i}`);
    expect(shouldCheck(full, "new")).toBe(false);
  });
});

test("the user's words are what they typed and their answers; never a notice, a peer's message or a reminder", () => {
  const rows = [
    {
      role: "user",
      text: "I'm going to use the app and give feedback<system-reminder>a rule</system-reminder>",
      toolUses: [],
    },
    {
      role: "user",
      text: "<command-message>hope:intent</command-message>\n<command-name>/hope:intent</command-name>\n<command-args>file it to the loop</command-args>",
      toolUses: [],
    },
    {
      role: "user",
      text: "<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>",
      toolUses: [],
    },
    {
      role: "user",
      text: "<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n</task-notification>",
      toolUses: [],
    },
    {
      role: "user",
      text: '<cross-session-message from="rupd">Build PR 1</cross-session-message>',
      toolUses: [],
    },
    {
      role: "user",
      text: "",
      toolUses: [],
      toolResults: [{ tool_use_id: "r", text: "file text", isError: false }],
    },
    {
      role: "assistant",
      text: "",
      toolUses: [
        {
          tool_use_id: "q",
          tool: "AskUserQuestion",
          input: {},
          text: 'User has answered your questions: "How should it reach the loop?"="File at once".',
        },
        { tool_use_id: "r", tool: "Read", input: {}, text: "file text" },
      ],
    },
  ] as const;
  expect(userWords(rows as any)).toEqual([
    "I'm going to use the app and give feedback",
    "/hope:intent file it to the loop",
    'User has answered your questions: "How should it reach the loop?"="File at once".',
  ]);
});

test("a check reads the newest of the user's words once they outgrow it", () => {
  const text = labelText(
    [`first ${"x".repeat(WORDS_KEPT)}`, "file it at once"],
    "open no PR",
  );
  expect(text).toContain("file it at once");
  expect(text).not.toContain("first ");
  expect(text).toContain("<line>open no PR</line>");
});

describe("after a turn that states a work order", () => {
  const setup = ($: any, on: any, surfaces = ["terminal"]) => {
    mock.store(on);
    const clock = mock.clock(on);
    const asked: string[] = [];
    const toasts: string[] = [];
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: surfaces }));
    on("session.messages", () => ({
      value: [
        {
          role: "user",
          text: "I'm going to use the app and give feedback",
          toolUses: [],
        },
      ],
    }));
    on("ui.invalidate", () => ({ value: undefined }));
    on(
      "ui.toast",
      (_: any, e: any) => (toasts.push(e.text), { value: undefined }),
    );
    on("model.classify", (_: any, e: any) => {
      asked.push(e.text);
      const said = (line: string) => e.text.includes(`<line>${line}</line>`);
      // The model names no label for the ask, and calls the bar assumed.
      return {
        value: said("each Issue number is told to the user")
          ? "assumed"
          : said("Turn each piece of feedback into a GitHub Issue")
            ? undefined
            : "said",
      };
    });
    on("turn.complete", (_: any, e: any) => ({ text: e.answer }));
    on("prompt.submit", (_: any, e: any) => ({
      text: e.text,
      context: e.context,
    }));
    const turn = (answer: string) =>
      $.turn.complete({
        answer,
        durationMs: 1,
        isAborted: false,
        turnId: "t",
        reason: "answer",
      });
    const submit = async (text: string) =>
      (await $.prompt.submit({ text, origin: { kind: "composer" } } as any))
        .context ?? [];
    return { clock, asked, toasts, turn, submit };
  };

  test("a line the user never said becomes a question, the only thing shown; Claude reads it with the user's answer, once", async ($, on) => {
    const { clock, asked, toasts, turn, submit } = setup($, on);
    const card =
      '\n```card\n{"questions":[{"q":"Which repo?","options":["moo"]}]}\n```';
    await turn(`${ORDER}${card}`);
    await clock.settle();
    await turn(`${ORDER}${card}`);
    await clock.settle();
    expect(asked.length).toBe(2);
    expect(toasts).toEqual([]);
    const unsaid = 'You never said "each Issue number is told to the user"';
    expect((await submit("q2: drop")).join("\n")).toContain(unsaid);
    expect((await submit("q2: drop")).join("\n")).not.toContain(unsaid);
  });

  test("a session nobody sees spends no check", async ($, on) => {
    const { clock, asked, turn } = setup($, on, []);
    await turn(ORDER);
    await clock.settle();
    expect(asked).toEqual([]);
  });
});
