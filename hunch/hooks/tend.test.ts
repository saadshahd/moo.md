import { describe, expect, test } from "claude-code/testing";
import { hit, layout, move, navRows } from "./band.tsx";
import { bandModel, cardRows, bareFact, cleanCard, clip, commandFor, hasRun, latestCard, stripCards } from "./tend.tsx";

const block = (json: string) => `reply\n\`\`\`card\n${json}\n\`\`\`\n`;
const said = (text: string) => ({ role: "assistant", text, toolUses: [] });

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

const model = (card: object, open: string | null = null, rows: object[] = []) =>
  bandModel({
    card: card as any,
    open,
    paneItem: null,
    answered: new Set(),
    ran: new Set(),
    rows: rows as any,
  });

describe("band", () => {
  test("no card, no agents: nothing", async () => {
    expect(model({})).toEqual({ chips: [], body: [], agents: [] });
  });
  test("card: only chips with content", async () => {
    const b = model({ intent: "x", questions: [{ q: "a?", options: ["y"] }] });
    expect(b.chips.map((c) => c.id)).toEqual(["chip:intent", "chip:questions"]);
  });
  test("an open card marks its chip and fills the body", async () => {
    const b = model({ facts: ["a", "b"] }, "facts");
    expect(b.chips[0].mark).toBe("open");
    expect(b.body.map((r) => r[0].id)).toEqual(["probe:fact 1", "probe:fact 2"]);
  });
  test("no undefined anywhere: Client props refuse it", async () => {
    const b = model({ intent: "x", facts: ["a"] }, "facts", [{ id: "a", label: "l", done: true }]);
    const holes = (v: unknown): boolean =>
      v === undefined || (typeof v === "object" && v !== null && Object.values(v).some(holes));
    expect(holes(b)).toBe(false);
  });
  test("agents line only with agents", async () => {
    const b = model({}, null, [{ id: "a1", label: "count files", done: false }]);
    expect(b.agents).toEqual([
      { id: "agent:a1", label: "count files", kind: "agent", mark: "running" },
    ]);
  });
  test("a question row: the question, then its answers", async () => {
    const rows = cardRows(
      { questions: [{ q: "a?", options: ["x", "y"] }] },
      "questions",
      new Set(),
      new Set(),
    );
    expect(rows[0].map((i) => i.id)).toEqual(["probe:q1", "answer:0:0", "answer:0:1"]);
  });
});

describe("arrows", () => {
  const b = model({ facts: ["a", "b"], intent: "x" }, "facts", [
    { id: "a1", label: "count", done: true },
  ]);
  const rows = navRows(b);
  test("rows: chips, each card line, agents", async () => {
    expect(rows.map((r) => r.map((i) => i.id))).toEqual([
      ["chip:intent", "chip:facts"],
      ["probe:fact 1"],
      ["probe:fact 2"],
      ["agent:a1"],
    ]);
  });
  test("left/right stay in the row; up/down change rows", async () => {
    expect(move({ row: 0, col: 0 }, rows, "right")).toEqual({ row: 0, col: 1 });
    expect(move({ row: 0, col: 1 }, rows, "right")).toEqual({ row: 0, col: 1 });
    expect(move({ row: 0, col: 1 }, rows, "down")).toEqual({ row: 1, col: 0 });
    expect(move({ row: 3, col: 0 }, rows, "down")).toEqual({ row: 3, col: 0 });
    expect(move({ row: 1, col: 0 }, rows, "up")).toEqual({ row: 0, col: 1 }); // back on the open chip
  });
  test("a click lands on the item drawn there", async () => {
    const cells = layout(b, 80);
    // chips row: "[ intent ] [ ▾ facts ]"; box top border at y=1; first fact at y=2, x=2
    expect(hit(cells, 3, 0)?.id).toBe("chip:intent");
    expect(hit(cells, 12, 0)?.id).toBe("chip:facts");
    expect(hit(cells, 2, 2)?.id).toBe("probe:fact 1");
    expect(hit(cells, 2, 3)?.id).toBe("probe:fact 2");
    expect(hit(cells, 0, 5)?.id).toBe("agent:a1");
    expect(hit(cells, 40, 2)).toBeUndefined();
  });
  test("a row wider than the band is clipped, never wrapped", async () => {
    const wide = model({ facts: ["x".repeat(100)] }, "facts");
    const cell = layout(wide, 40).find((c) => c.item.id === "probe:fact 1")!;
    expect(cell.x + cell.text.length).toBeLessThanOrEqual(38);
    expect(cell.text.endsWith("…")).toBe(true);
  });
  test("notes are read, never focused", async () => {
    const skills = model(
      { skills: [{ name: "hope:judge", outcome: "verdict" }] },
      "skills",
    );
    expect(navRows(skills)[1].map((i) => i.id)).toEqual(["skill:0"]);
  });
});
