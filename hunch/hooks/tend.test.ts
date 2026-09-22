import { describe, expect, test } from "claude-code/testing";
import { fitsBox, hit, layout, move, navRows, wrap } from "./band.tsx";
import { agentRows, agentView, bandModel, chipRows, fromFile, isSourceFile, links, placeName, cardRows, chipLabel, firstLine, bareFact, cleanCard, clip, commandFor, hasRun, latestCard, stripCards } from "./tend.tsx";

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

test("a run skill is marked done, its label left bare", async () => {
  const [[run]] = cardRows({ skills: [{ name: "hope:judge", outcome: "v" }] } as any, "skills", new Set(), new Set(["hope:judge"]));
  expect(run).toEqual({ id: "skill:0", label: "hope:judge", kind: "line", state: "done" });
});
test("a chip previews its card with one number", async () => {
  const c = {
    intent: "i",
    facts: ["a", "b"],
    questions: [{ q: "x", options: [] }, { q: "y", options: [] }],
    skills: [{ name: "hope:intent" }, { name: "hope:draft" }],
  } as any;
  expect(chipLabel(c, "intent", new Set(), new Set())).toBe("intent");
  expect(chipLabel(c, "facts", new Set(), new Set())).toBe("facts 2");
  expect(chipLabel(c, "questions", new Set(["x"]), new Set())).toBe("questions 1");
  expect(chipLabel(c, "skills", new Set(), new Set(["hope:intent"]))).toBe("skills 1/2");
});
test("an agent's brief is its first non-empty line", async () => {
  expect(firstLine("\n  find the parser \nmore")).toBe("find the parser");
});
test("a fact is a list item; in the pane it wraps under its bullet", async () => {
  const [[f]] = cardRows({ facts: ["alpha beta gamma delta"] } as any, "facts", new Set(), new Set());
  expect(f.label).toBe("• alpha beta gamma delta");
  expect(wrap(f.label, 12)).toEqual(["• alpha beta", "  gamma", "  delta"]);
});
test("a card stays in the box while it wraps to at most 4 lines at the measure", async () => {
  const rows = (n: number, words: number) =>
    Array.from({ length: n }, (_, i) => [{ id: `l${i}`, label: "word ".repeat(words).trim(), kind: "line" as const }]);
  expect(fitsBox(rows(4, 2), 200, 4)).toBe(true);
  expect(fitsBox(rows(5, 2), 200, 4)).toBe(false);
  expect(fitsBox(rows(1, 80), 200, 4)).toBe(true); // 400 chars: 4 lines at 116
  expect(fitsBox(rows(1, 100), 200, 4)).toBe(false); // 500 chars: 5 lines
});
test("a card line wraps at the measure; chips never wrap", async () => {
  const body = [[{ id: "probe:intent", label: "word ".repeat(40).trim(), kind: "line" as const }]];
  const lines = layout({ chips: [], body, doc: "" }, 300);
  expect(lines.length).toBe(2);
  expect(lines.every((l) => l.cells[0].text.length <= 120)).toBe(true);
});
test("a teammate's pane reads its summary and its SendMessage, never the wrapper", async () => {
  const v = agentView([
    { role: "user", text: '<teammate-message teammate_id="team-lead" summary="Read notes.md">\nRead the file and list syntax.\n</teammate-message>' },
    { role: "assistant", text: "", toolUses: [{ tool: "SendMessage", input: { to: "team-lead", summary: "syntax listed", message: "1. headers" } }] },
    { role: "assistant", text: "" },
  ]);
  expect(v).toMatchObject({ asked: "Read notes.md", returned: "syntax listed", body: "1. headers" });
});
test("a subagent's pane reads its first line and its last reply", async () => {
  const v = agentView([
    { role: "user", text: "\nFind the parser.\nMore." },
    { role: "assistant", text: "It is in tend.tsx." },
  ]);
  expect(v).toMatchObject({ asked: "Find the parser.", returned: "", body: "It is in tend.tsx." });
});
test("an agent's pane reads like the session's card: intent, outcome, watch, facts", async () => {
  const v = agentView([
    { role: "user", text: "Count words." },
    { role: "assistant", text: "", toolUses: [{ tool: "Write", input: { file_path: "/tmp/wc.py" } }, { tool: "Read", input: { file_path: "/tmp/a.md" } }] },
    { role: "assistant", text: 'Done.\n\n```card\n{"intent":"count md words","facts":["wc counts markup"]}\n```\n' },
  ]);
  expect(v.body).toBe("Done.");
  expect(v.footprint).toEqual(["/tmp/wc.py"]);
  const rows = agentRows(v, "counter", "a1");
  expect(rows.map((r) => r.map((i) => i.label.trim()))).toEqual([
    ["intent", "count md words"],
    ["outcome", "Done."],
    ["watch", "wc.py"],
    ["facts", "• wc counts markup"],
    ["report", "read it all"],
  ]);
  expect(rows.map((r) => r[1].id)).toEqual(["probe:counter intent", "probe:counter outcome", "open:/tmp/wc.py", "probe:counter fact 1", "report:a1"]);
});
test("in the pane a row's last item runs on below itself, aligned", async () => {
  const body = [[{ id: "n", label: "facts    ", kind: "note" as const }, { id: "f", label: "• " + "word ".repeat(12).trim(), kind: "line" as const }]];
  const lines = layout({ chips: [], body, doc: "" }, 40);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.slice(1).every((l) => l.cells[0].x === lines[0].cells[1].x && l.cells[0].text.startsWith("  "))).toBe(true);
});
test("source files go to the editor; pages, pictures and urls do not", async () => {
  expect(isSourceFile("/tmp/wc.py")).toBe(true);
  expect(isSourceFile("/tmp/tend-lab/wordcount")).toBe(true);
  expect(isSourceFile("/tmp/shot.png")).toBe(false);
  expect(isSourceFile("https://x.dev/a.ts")).toBe(false);
});
test("an agent's pane shows its fullest report, not a closing line", async () => {
  const v = agentView([
    { role: "user", text: "Survey." },
    { role: "assistant", text: "", toolUses: [{ tool: "SendMessage", input: { summary: "survey done", message: "a long report ".repeat(5) } }] },
    { role: "assistant", text: "", toolUses: [{ tool: "SendMessage", input: { summary: "bye", message: "Task complete" } }] },
  ]);
  expect(v.returned).toBe("survey done");
});
test("a pane lists a doc's links to click, beside the file when relative", async () => {
  expect(links("see [a](x.md), [b](https://y.dev) and [c](#top) and [a](x.md) and [link](url)")).toEqual(["x.md", "https://y.dev"]);
  expect(fromFile("/r/docs/a.md", "x.md")).toBe("/r/docs/x.md");
  expect(fromFile("/r/docs/a.md", "https://y.dev")).toBe("https://y.dev");
});
test("an agent's outcome is its own one line, else its summary, else its first line of prose", async () => {
  const body = (text: string) => agentView([{ role: "user", text: "x" }, { role: "assistant", text }]);
  const own = body('# Findings\n\nwc overcounts.\n\n```card\n{"outcome":"use markdown-it"}\n```\n');
  expect(agentRows(own, "a", "1").find((r) => r[0].label.trim() === "outcome")?.[1].label).toBe("use markdown-it");
  const prose = body("# Findings\n\nwc overcounts.");
  expect(agentRows(prose, "a", "1").find((r) => r[0].label.trim() === "outcome")?.[1].label).toBe("wc overcounts.");
});
test("a place reads by its name, not its full path", async () => {
  expect(placeName("/tmp/tend-lab/expert/wordcount.py")).toBe("wordcount.py");
  expect(placeName("https://www.example.com/blog/post/")).toBe("example.com/blog/post");
  expect(placeName("https://example.com")).toBe("example.com");
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
    expect(model({})).toEqual({ doc: "", chips: [], body: [] });
  });
  test("card: only chips with content", async () => {
    const b = model({ intent: "x", questions: [{ q: "a?", options: ["y"] }] });
    expect(b.chips.map((c) => c.id)).toEqual(["chip:intent", "chip:questions"]);
  });
  test("an open card marks its chip and fills the body", async () => {
    const b = model({ facts: ["a", "b"] }, "facts");
    expect(b.chips[0].open).toBe(true);
    expect(b.body.map((r) => r[0].id)).toEqual(["probe:fact 1", "probe:fact 2"]);
  });
  test("no undefined anywhere: Client props refuse it", async () => {
    const b = model({ intent: "x", facts: ["a"] }, "facts", [{ id: "a", label: "l", done: true }]);
    const holes = (v: unknown): boolean =>
      v === undefined || (typeof v === "object" && v !== null && Object.values(v).some(holes));
    expect(holes(b)).toBe(false);
  });
  test("agents are a chip, never a standing row; it marks one still working", async () => {
    const b = model({}, null, [
      { id: "a1", label: "count files", type: "Explore", done: false },
      { id: "a2", label: "scan", type: "Explore", done: true, read: true },
    ]);
    expect(b.chips).toEqual([{ id: "chip:agents", label: "agents 2", kind: "chip", state: "running" }]);
    expect(b.body).toEqual([]);
  });
  test("the agents list: each agent, dim once read, the one shown marked open", async () => {
    const rows = chipRows("agents", {
      card: {}, answered: new Set(), ran: new Set(), paneItem: "agent:a1",
      rows: [{ id: "a1", label: "l", type: "Explore", done: true, read: true }],
    });
    expect(rows).toEqual([[{ id: "agent:a1", label: "l", kind: "line", state: "done", read: true, open: true }]]);
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
  test("rows: chips, then each card line", async () => {
    expect(rows.map((r) => r.map((i) => i.id))).toEqual([
      ["chip:intent", "chip:facts", "chip:agents"],
      ["probe:fact 1"],
      ["probe:fact 2"],
    ]);
  });
  test("left/right stay in the row; up/down change rows", async () => {
    expect(move({ row: 0, col: 0 }, rows, "right")).toEqual({ row: 0, col: 1 });
    expect(move({ row: 0, col: 2 }, rows, "right")).toEqual({ row: 0, col: 2 });
    expect(move({ row: 0, col: 1 }, rows, "down")).toEqual({ row: 1, col: 0 });
    expect(move({ row: 2, col: 0 }, rows, "down")).toEqual({ row: 2, col: 0 });
    expect(move({ row: 1, col: 0 }, rows, "up")).toEqual({ row: 0, col: 1 }); // back on the open chip
  });
  test("a click lands on the item drawn there", async () => {
    const cells = layout(b, 80);
    expect(cells.map((l) => l.y)).toEqual([0, 2, 3]); // the box's top border takes row 1
    // chips row: "[ intent ] [ ▾ facts ]"; box top border at y=1; first fact at y=2, x=2
    expect(hit(cells, 3, 0)?.id).toBe("chip:intent");
    expect(hit(cells, 12, 0)?.id).toBe("chip:facts");
    expect(hit(cells, 2, 2)?.id).toBe("probe:fact 1");
    expect(hit(cells, 2, 3)?.id).toBe("probe:fact 2");
    expect(hit(cells, 40, 2)).toBeUndefined();
  });
  test("a word wider than the box is the one thing clipped", async () => {
    const wide = model({ facts: ["x".repeat(100)] }, "facts");
    const cell = layout(wide, 40).flatMap((l) => l.cells).find((c) => c.item.id === "probe:fact 1")!;
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
