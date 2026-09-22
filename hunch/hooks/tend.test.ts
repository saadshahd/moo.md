import { describe, expect, mock, test } from "claude-code/testing";
import { bareFact, cleanCard, clip, commandFor, hasRun, latestCard, stripCards } from "./tend.tsx";

const block = (json: string) => `reply\n\`\`\`card\n${json}\n\`\`\`\n`;
const said = (text: string) => ({ role: "assistant", text, toolUses: [] });

const BAND = {
  plugin: "hunch",
  surface: "terminal",
  component: "AbovePrompt",
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const;

// The band reads the session through $; answer each read beneath the plugin.
const session = (on: any, msgs: unknown[], agents: unknown[]) => {
  on("session.id", () => ({ value: "s1" }));
  on("command.register", () => ({ value: undefined }));
  mock.store(on);
  on("session.messages", () => ({ value: msgs }));
  on("agent.list", () => ({ value: agents }));
};

describe("card parse", () => {
  test("good block", async () => {
    expect(latestCard([said(block('{"intent":"x","facts":["a"]}'))])).toEqual({
      intent: "x",
      facts: ["a"],
    });
  });
  test("bad JSON is skipped for an older good one", async () => {
    expect(
      latestCard([said(block('{"intent":"old"}')), said(block("{not json"))]),
    ).toEqual({ intent: "old" });
  });
  test("absent keys stay absent; no block is empty", async () => {
    expect(latestCard([said(block('{"shape":"s"}'))])).toEqual({ shape: "s" });
    expect(latestCard([said("no card")])).toEqual({});
  });
  test("each key from the newest block that has it", async () => {
    expect(
      latestCard([
        said(block('{"skills":[{"name":"hope:judge","outcome":"v"}],"intent":"a"}')),
        said(block('{"intent":"b"}')),
      ]),
    ).toEqual({ intent: "b", skills: [{ name: "hope:judge", outcome: "v" }] });
  });
  test("[] clears an older list", async () => {
    expect(
      latestCard([said(block('{"facts":["a"]}')), said(block('{"facts":[]}'))]),
    ).toEqual({ facts: [] });
  });
  test("latest block wins", async () => {
    expect(
      latestCard([
        said(block('{"intent":"a"}')),
        said(block('{"intent":"b"}')),
      ]),
    ).toEqual({ intent: "b" });
  });
});

test("card block hidden, closed or still streaming", async () => {
  expect(stripCards(block('{"intent":"x"}'))).toBe("reply");
  expect(stripCards('reply\n```card\n{"intent":"x","fa')).toBe("reply");
});

test("malformed fields dropped, good ones kept", async () => {
  expect(
    cleanCard({
      intent: "x",
      shape: 3,
      facts: ["a", 2, ""],
      questions: [{ q: "a?", options: "y" }, { q: "b?", options: ["y"] }],
      skills: [{ name: "hope:clarify" }, { name: "hope:judge", outcome: "verdict" }],
      watch: [{ label: "docs" }],
    }),
  ).toEqual({
    intent: "x",
    facts: ["a"],
    questions: [{ q: "b?", options: ["y"] }],
    skills: [{ name: "hope:judge", outcome: "verdict" }],
    watch: [],
  });
});

test("a skill counts as run with or without its plugin prefix", async () => {
  const ran = new Set(["hope:clarify"]);
  expect(hasRun(ran, "hope:clarify")).toBe(true);
  expect(hasRun(ran, "clarify")).toBe(true);
  expect(hasRun(ran, "hope:judge")).toBe(false);
});

test("a planned skill resolves to a real command, or none", async () => {
  const names = ["hope:clarify", "hope:judge", "clear"];
  expect(commandFor(names, "clarify")).toBe("hope:clarify");
  expect(commandFor(names, "hope:judge")).toBe("hope:judge");
  expect(commandFor(names, "nope")).toBeUndefined();
});

test("long agent labels clipped", async () => {
  expect(clip("x".repeat(50))).toHaveLength(40);
  expect(clip("short")).toBe("short");
});

test("fact source prefix stripped", async () => {
  expect(bareFact("User confirmed: dark mode exists")).toBe("dark mode exists");
  expect(bareFact("Found: no settings page")).toBe("no settings page");
  expect(bareFact("Toggle only")).toBe("Toggle only");
});

describe("band", () => {
  test("no card, no agents: no line", async ($, on) => {
    session(on, [], []);
    const ui = await $.ui.mount(BAND);
    expect(await ui.findAll({ type: "Button" })).toEqual([]);
    await ui.unmount();
  });
  test("card: only chips with content", async ($, on) => {
    session(
      on,
      [said(block('{"intent":"x","questions":[{"q":"a?","options":["y"]}]}'))],
      [],
    );
    const ui = await $.ui.mount(BAND);
    expect(await ui.find({ key: "intent" })).toBeDefined();
    expect(await ui.find({ key: "questions" })).toBeDefined();
    expect(await ui.find({ key: "shape" })).toBeUndefined();
    expect(await ui.find({ key: "facts" })).toBeUndefined();
    expect(await ui.find({ key: "skills" })).toBeUndefined();
    await ui.unmount();
  });
  test("agents line only with agents", async ($, on) => {
    session(
      on,
      [],
      [
        {
          id: "a1",
          description: "count files",
          type: "general-purpose",
          status: "running",
        },
      ],
    );
    const ui = await $.ui.mount(BAND);
    expect((await ui.find({ key: "agent-a1" }))?.text).toContain("count files");
    await ui.unmount();
  });
});
