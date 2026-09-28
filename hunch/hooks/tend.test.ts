import { describe, expect, mock, test } from "claude-code/testing";
import { DOC_MAX, drawable, hit, layout, move, navRows, wrap, type Item } from "./band.tsx";
import { prose, textKey, wantsShort, AGENT_RETURN, IDEAS_FORMAT, ideaSegments, agentRows, agentView, bandModel, chipRows, fromFile, isSourceFile, links, placeName, cardRows, chipLabel, factParts, firstLine, bareFact, cleanCard, clip, commandFor, hasRun, slashName, latestCard, proseQuestions, replayCard, stripCards, swapAnswer, turnQuestions, unreadable, withOpen } from "./tend.tsx";

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

test("a card quoted in a reply is shown, and so is everything after it", async () => {
  const reply = 'It said:\n> ```card\n> {"intent":"x"}\n> ```\n\nPart of this is stale.';
  expect(stripCards(reply)).toBe(reply);
  expect(latestCard([said(reply)])).toEqual({});
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
  const [[run]] = cardRows({ skills: [{ name: "hope:judge", outcome: "v" }] } as any, "skills", new Set(["hope:judge"]));
  expect(run).toEqual({ id: "skill:0", label: "hope:judge", kind: "line", state: "done", column: true });
});
test("a chip previews its card with one number", async () => {
  const c = {
    intent: "i",
    facts: ["a", "b"],
    questions: [{ q: "x", options: [] }, { q: "y", options: [] }],
    skills: [{ name: "hope:intent" }, { name: "hope:draft" }],
  } as any;
  const s = (ran: string[] = []) => ({ card: c, ran: new Set(ran), rows: [], paneItem: null, memory: [] });
  expect(chipLabel("intent", s())).toBe("intent");
  expect(chipLabel("facts", s())).toBe("facts 2");
  expect(chipLabel("questions", s())).toBe("questions 2");
  expect(chipLabel("skills", s(["hope:intent"]))).toBe("skills 1/2");
});
test("first line: the first non-empty one, trimmed", async () => {
  expect(firstLine("\n  find the parser \nmore")).toBe("find the parser");
});
test("a fact is a list item; in the pane it wraps under its bullet", async () => {
  const [[f]] = cardRows({ facts: ["alpha beta gamma delta"] } as any, "facts", new Set());
  expect(f.label).toBe("• alpha beta gamma delta");
  expect(wrap(f.label, 12)).toEqual(["• alpha beta", "  gamma", "  delta"]);
});
test("a card line wraps at the measure; chips never wrap", async () => {
  const body = [[{ id: "probe:intent", label: "word ".repeat(40).trim(), kind: "line" as const }]];
  const lines = layout({ chips: [], body, doc: "" }, 300);
  expect(lines.length).toBe(3);
  expect(lines.every((l) => l.cells[0].text.length <= 76)).toBe(true);
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
test("a fact reads as its claim, then the rest dim under it, a blank line between facts", async () => {
  expect(factParts("Suno sings. ACE Studio lost because it has no Arabic.")).toEqual(["Suno sings.", "ACE Studio lost because it has no Arabic."]);
  const rows = cardRows({ facts: ["Suno sings. ACE lost.", "One claim"] } as any, "facts", new Set());
  expect(rows.map((r) => r.map((i) => [i.label, i.kind, i.indent ?? 0]))).toEqual([
    [["• Suno sings.", "line", 0]],
    [["ACE lost.", "note", 2]],
    [],
    [["• One claim", "line", 0]],
  ]);
});
test("questions are a list, each with its answers as a clickable list under it; long ones wrap, none cut", async () => {
  const card = { questions: [
    { q: "In your Suno account, is 8345526f a Voice or a Style Persona?", options: ["Voice", "Style Persona"] },
    { q: "May each song folder commit its band code?", options: ["Yes, add it to CLAUDE.md", "No, keep it untracked"] },
  ] };
  const lines = layout({ chips: [], body: cardRows(card, "questions", new Set()), doc: "" }, 40);
  const text = lines.map((l) => " ".repeat(l.cells[0]?.x ?? 0) + l.cells.map((c) => c.text).join(""));
  expect(text).toEqual([
    "• In your Suno account, is 8345526f a",
    "  Voice or a Style Persona?",
    "  ◦ Voice",
    "  ◦ Style Persona",
    "",
    "• May each song folder commit its band",
    "  code?",
    "  ◦ Yes, add it to CLAUDE.md",
    "  ◦ No, keep it untracked",
  ]);
});
test("a table's first column takes its widest cell; the next column wraps inside itself", async () => {
  const card = { skills: [
    { name: "hope:clarify", outcome: "reading A confirmed" },
    { name: "mattpocock-skills:research", outcome: "three cited research files" },
    { name: "hope:intent", outcome: "the audit of memory, CLAUDE.md and skills against the settled route" },
  ] };
  const lines = layout({ chips: [], body: cardRows(card, "skills", new Set()), doc: "" }, 80);
  const outcomeX = lines.map((l) => l.cells.at(-1)!.x);
  expect(new Set(outcomeX).size).toBe(1);
  expect(outcomeX[0]).toBe("mattpocock-skills:research".length + 2);
  expect(lines.length).toBe(4);
});
test("an item that won't fit the rest of its line starts the next one", async () => {
  const body: Item[][] = [[{ id: "a", label: "x".repeat(30), kind: "line" }, { id: "b", label: "y".repeat(20), kind: "quiet" }, { id: "c", label: "z", kind: "quiet" }]];
  const lines = layout({ chips: [], body, doc: "" }, 40);
  expect(lines.map((l) => l.cells.map((c) => c.text))).toEqual([["x".repeat(30)], ["y".repeat(20), "z"]]);
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

test("a prompt runs a command only when it starts with one", async () => {
  expect(slashName("/hope:intent add retries")).toBe("hope:intent");
  expect(slashName("/intent")).toBe("intent");
  expect(slashName("/hope:intent.md is here")).toBeUndefined();
  expect(slashName("/Users/me/notes.md")).toBeUndefined();
  expect(slashName("run /hope:intent")).toBeUndefined();
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
    paneItem: open && `card:${open}`,
    ran: new Set(),
    rows: rows as any,
    memory: [],
  });

describe("band", () => {
  test("no card, no agents: nothing", async () => {
    expect(model({})).toEqual({ doc: "", chips: [], body: [] });
  });
  test("card: only chips with content", async () => {
    const b = model({ intent: "x", questions: [{ q: "a?", options: ["y"] }] });
    expect(b.chips.map((c) => c.id)).toEqual(["chip:intent", "chip:questions"]);
  });
  test("a card in the pane marks its chip; the band never opens it above the chips", async () => {
    const b = model({ facts: ["a", "b"] }, "facts");
    expect(b.chips[0].open).toBe(true);
    expect(b.body).toEqual([]);
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
      card: {}, ran: new Set(), paneItem: "agent:a1", memory: [],
      rows: [{ id: "a1", label: "l", type: "Explore", done: true, read: true }],
    });
    expect(rows).toEqual([[{ id: "agent:a1", label: "l", kind: "line", state: "done", read: true, open: true }]]);
  });
  test("intent and shape read as padded paragraphs, one per sentence, a blank line apart", async () => {
  const intent = "Fix the pane. Each card reads in it; nothing opens above the chips.";
  const lines = layout({ chips: [], body: cardRows({ intent }, "intent", new Set()), doc: "" }, 72);
  expect(lines.map((l) => [l.cells[0].x, l.cells[0].text])).toEqual([
    [2, "Fix the pane."],
    [2, ""],
    [2, "Each card reads in it;"],
    [2, ""],
    [2, "nothing opens above the chips."],
  ]);
  expect(new Set(lines.map((l) => l.cells[0].item.id))).toEqual(new Set(["probe:intent"]));
});
test("a question's rows: the question, which takes no click, then each answer", async () => {
    const rows = cardRows(
      { questions: [{ q: "a?", options: ["x", "y"] }] },
      "questions",
      new Set(),
      new Set(),
    );
    expect(rows.map((r) => r.map((i) => i.id))).toEqual([["question:0"], ["answer:0:0"], ["answer:0:1"]]);
    // A click reaches only what the arrows can stop on.
    expect(navRows({ chips: [], body: rows, doc: "" }).map((r) => r.map((i) => i.id))).toEqual([["answer:0:0"], ["answer:0:1"]]);
  });
});

describe("arrows", () => {
  // The facts pane over a row of chips: the arrows and clicks read any band the same way.
  const b = {
    ...model({ facts: ["a", "b"], intent: "x" }, "facts", [{ id: "a1", label: "count", done: true }]),
    body: cardRows({ facts: ["a", "b"] }, "facts", new Set()),
  };
  const rows = navRows(b);
  test("rows as drawn: each card line, then the chips; a blank line is no stop", async () => {
    expect(rows.map((r) => r.map((i) => i.id))).toEqual([
      ["probe:fact 1"],
      ["probe:fact 2"],
      ["chip:intent", "chip:facts", "chip:agents"],
    ]);
  });
  test("left/right stay in the row; up/down change rows", async () => {
    expect(move({ row: 2, col: 0 }, rows, "right")).toEqual({ row: 2, col: 1 });
    expect(move({ row: 2, col: 2 }, rows, "right")).toEqual({ row: 2, col: 2 });
    expect(move({ row: 2, col: 1 }, rows, "up")).toEqual({ row: 1, col: 0 });
    expect(move({ row: 0, col: 0 }, rows, "up")).toEqual({ row: 0, col: 0 });
    expect(move({ row: 1, col: 0 }, rows, "down")).toEqual({ row: 2, col: 1 }); // back on the open chip
  });
  test("a click lands on the item drawn there", async () => {
    const cells = layout(b, 80);
    expect(cells.map((l) => l.y)).toEqual([0, 1, 2, 3]);
    // facts at y=0 and 2 around the blank line; chips "[ intent ] [ ▴ facts ]" at y=3
    expect(hit(cells, 0, 0)?.id).toBe("probe:fact 1");
    expect(hit(cells, 0, 1)).toBeUndefined();
    expect(hit(cells, 0, 2)?.id).toBe("probe:fact 2");
    expect(hit(cells, 1, 3)?.id).toBe("chip:intent");
    expect(hit(cells, 12, 3)?.id).toBe("chip:facts");
    expect(hit(cells, 40, 0)).toBeUndefined();
  });
  test("a word wider than the line is the one thing clipped", async () => {
    const wide = { chips: [], body: cardRows({ facts: ["x".repeat(100)] }, "facts", new Set()), doc: "" };
    const cell = layout(wide, 40).flatMap((l) => l.cells).find((c) => c.item.id === "probe:fact 1")!;
    expect(cell.x + cell.text.length).toBeLessThanOrEqual(40);
    expect(cell.text.endsWith("…")).toBe(true);
  });
  test("notes are read, never focused", async () => {
    const body = cardRows({ skills: [{ name: "hope:judge", outcome: "verdict" }] }, "skills", new Set());
    expect(navRows({ chips: [], body, doc: "" })[0].map((i) => i.id)).toEqual(["skill:0"]);
  });
});

describe("unreadable", () => {
  test("a missing file reads as not written yet", async () => {
    const err = "HooksError: hunch: $.fs.read(/a/b.md) failed: ENOENT";
    expect(unreadable("/a/b.md", err)).toBe("_not written yet: /a/b.md_");
  });
  test("any other failure shows as it came", async () => {
    const err = "HooksError: hunch: $.fs.read(/a/b.md) failed: EACCES";
    expect(unreadable("/a/b.md", err)).toBe(`_${err}_`);
  });
});

describe("open questions", () => {
  test("a line ending in ? is a question; code, the card and list markers are not", async () => {
    const reply = "Done.\n- Ship it now?\n```ts\nconst a = b?\n```\nIs that right?\n" + block('{"intent":"x?"}');
    expect(proseQuestions(reply, [])).toEqual(["Ship it now?", "Is that right?"]);
  });
  test("a quoted card hides nothing after it", async () => {
    const reply = "It said:\n> ```card\n> {\"intent\":\"x\"}\n> ```\n\nShould the demo keep going?";
    expect(proseQuestions(reply, [])).toEqual(["Should the demo keep going?"]);
  });
  test("one already a card question, or asked twice, is skipped", async () => {
    expect(proseQuestions("Ship it?\nShip it?\nWhich one?", ["Which one?"])).toEqual(["Ship it?"]);
  });
  test("a turn leaves open its card's questions when it lists any; else those open before, then its prose ones", async () => {
    const before = [{ q: "Old?", options: ["y"] }];
    // A card that lists questions lists them all: its prose, even a reworded copy, adds none.
    expect(turnQuestions(block('{"questions":[{"q":"New?","options":["a"]}]}') + "**4. New, reworded.** What now?", before)).toEqual([
      { q: "New?", options: ["a"] },
    ]);
    expect(turnQuestions(block('{"questions":[]}') + "Ship?", before)).toEqual([{ q: "Ship?", options: [] }]);
    expect(turnQuestions("Old?\nShip?", before)).toEqual([...before, { q: "Ship?", options: [] }]);
  });
  test("the card shows the open questions, not its blocks' own; none kept yet leaves the blocks'", async () => {
    const card = { intent: "i", questions: [{ q: "Stale?", options: [] }] };
    expect(withOpen(card, [])).toEqual({ intent: "i" });
    expect(withOpen(card, [{ q: "Now?", options: [] }])).toEqual({ intent: "i", questions: [{ q: "Now?", options: [] }] });
    expect(withOpen(card, undefined)).toEqual(card);
  });
  test("a prose question joins the card, a repeat does not, and the next prompt closes them all", async ($, on) => {
    mock.store(on);
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: ["terminal"] }));
    const msgs = [said(block('{"intent":"i","questions":[{"q":"Which one?","options":["a"]}]}'))];
    on("session.messages", () => ({ value: msgs }));
    on("ui.invalidate", () => ({ value: undefined }));
    on("turn.complete", (_, e) => ({ text: e.answer }));
    on("prompt.submit", (_, e) => ({ text: e.text }));
    on("session.compact", () => ({ messages: [{ role: "user" as const, text: "Summary.", toolUses: [] }] }));
    const turn = (answer: string) =>
      $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: "t", reason: "answer" });
    const replayed = async () =>
      latestCard((await $.session.compact({ trigger: "manual", messages: msgs })).messages as any);
    await turn("Which one?\nShip it now?");
    await turn("Ship it now?");
    expect((await replayed()).questions).toEqual([
      { q: "Which one?", options: ["a"] },
      { q: "Ship it now?", options: [] },
    ]);
    await $.prompt.submit({ text: "check it against main", origin: { kind: "composer" } } as any);
    expect(await replayed()).toEqual({ intent: "i" });
  });
});

test("an agent's return, report or notification, asks for one line or an empty card; a shell's return and the user's prompt do not", async ($, on) => {
  mock.store(on);
  on("session.id", () => ({ value: "s1" }));
  on("session.messages", () => ({ value: [] }));
  on("agent.list", () => ({ value: [{ id: "a1", name: "scan", type: "Explore", status: "completed" }] }));
  on("prompt.submit", (_, e) => ({ text: e.text, context: e.context }));
  const note = (id: string) =>
    $.prompt.submit({ text: `<task-notification>\n<task-id>${id}</task-id>\n<status>completed</status>\n</task-notification>`, origin: { kind: "task-notification" } } as any);
  expect(((await note("a1")) as any).context).toContain(AGENT_RETURN);
  expect(((await note("b9")) as any).context ?? []).not.toContain(AGENT_RETURN);
  const handback = await $.prompt.submit({ text: `Another Claude session sent a message: <agent-message from="a1"> [Subagent hand-back] 20 files.`, origin: { kind: "peer" } } as any);
  expect((handback as any).context).toContain(AGENT_RETURN);
  const own = await $.prompt.submit({ text: "go on", origin: { kind: "composer" } } as any);
  expect((own as any).context ?? []).not.toContain(AGENT_RETURN);
  // The reply it asks for draws nothing in the thread.
  expect(stripCards("```card\n{}\n```")).toBe("");
});

test("a compaction ends on the whole card, word for word, open questions only", async ($, on) => {
  const card = {
    intent: "Land W7: the card survives compaction.",
    shape: "Replay the card; never trust the summary.",
    facts: ["The summary keeps what it chooses; the card keeps the rest."],
    questions: [{ q: "Closed?", options: ["y"] }],
  };
  const open = [{ q: "Ship now?", options: ["yes", "no"] }, { q: "Which branch?", options: [] }];
  mock.store(on, { "tend:s1:open": open });
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  const summary = { role: "user" as const, text: "Summary: we talked about tend.", toolUses: [] };
  on("session.compact", () => ({ messages: [summary] }));
  const { messages } = await $.session.compact({ trigger: "manual", messages: [said(block(JSON.stringify(card)))] });
  expect(messages?.[0]).toEqual(summary);
  expect(latestCard([messages![1] as any])).toEqual({ ...card, questions: open });
  for (const s of [card.intent, card.shape, card.facts[0], ...open.map((q) => q.q)])
    expect(messages![1].text.includes(JSON.stringify(s))).toBe(true);
});

test("an empty card adds nothing to a compaction", async () => {
  expect(replayCard({})).toBeUndefined();
});

describe("pane doc", () => {
  test("a doc past the Markdown limit is cut at a whole line and says so", async () => {
    const doc = "line of forty characters, give or take.\n".repeat(600);
    const out = drawable(doc);
    expect(out.length).toBeLessThanOrEqual(DOC_MAX);
    expect(out.endsWith("_…the rest is past what the pane can draw_")).toBe(true);
    expect(out.split("\n\n_…")[0].endsWith("take.")).toBe(true);
  });
  test("a doc within the limit is drawn whole", async () => {
    expect(drawable("short")).toBe("short");
  });
});

test("the store keeps only the latest sessions' keys", async ($, on) => {
  const old = Array.from({ length: 25 }, (_, i) => `old${i}`);
  const store = new Map<string, unknown>([
    ...old.map((s): [string, unknown] => [`tend:${s}:memory-base`, {}]),
    ["tend:recent", old],
  ]);
  on("store.get", (_, e) => ({ value: store.get(e.key) }));
  on("store.set", (_, e) => (store.set(e.key, e.value), { value: undefined }));
  on("store.delete", (_, e) => (store.delete(e.key), { value: undefined }));
  on("store.keys", () => ({ value: [...store.keys()] }));
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.start", (_, e) => e);
  await $.session.start({ source: "startup", cwd: "/p" } as any);
  expect([...store.keys()].filter((k) => k !== "tend:recent")).toEqual(
    old.slice(0, 19).map((s) => `tend:${s}:memory-base`),
  );
  expect(store.get("tend:recent")).toEqual(["s1", ...old.slice(0, 19)]);
});

test("a store over its cap with no session list shrinks to the current session", async ($, on) => {
  const cap = 100;
  const store = new Map<string, unknown>(
    Array.from({ length: 10 }, (_, i): [string, unknown] => [`tend:old${i}:memory-base`, "x".repeat(20)]),
  );
  const size = () => JSON.stringify(Object.fromEntries(store)).length;
  on("store.get", (_, e) => ({ value: store.get(e.key) }));
  on("store.set", (_, e) => {
    const was = store.get(e.key);
    store.set(e.key, e.value);
    if (size() > cap) {
      was === undefined ? store.delete(e.key) : store.set(e.key, was);
      throw new Error("$.store.set: over the limit");
    }
    return { value: undefined };
  });
  on("store.delete", (_, e) => (store.delete(e.key), { value: undefined }));
  on("store.keys", () => ({ value: [...store.keys()] }));
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.start", (_, e) => e);
  await $.session.start({ source: "startup", cwd: "/p" } as any);
  expect([...store.keys()]).toEqual(["tend:recent"]);
  expect(store.get("tend:recent")).toEqual(["s1"]);
});

test("a headless session keeps nothing, so it pushes no live session out", async ($, on) => {
  const live = Array.from({ length: 20 }, (_, i) => `live${i}`);
  const store = new Map<string, unknown>([["tend:recent", live]]);
  on("store.get", (_, e) => ({ value: store.get(e.key) }));
  on("store.set", (_, e) => (store.set(e.key, e.value), { value: undefined }));
  on("store.delete", (_, e) => (store.delete(e.key), { value: undefined }));
  on("store.keys", () => ({ value: [...store.keys()] }));
  on("session.id", () => ({ value: "headless" }));
  on("session.surfaces", () => ({ value: [] }));
  on("session.start", (_, e) => e);
  await $.session.start({ source: "startup", cwd: "/p" } as any);
  expect(store.get("tend:recent")).toEqual(live);
});

test("a second answer to a question swaps the first in place; the rest of the prompt stays", async () => {
  const opts = ["yes", "yes, later", "no"];
  expect(swapAnswer("", 1, opts, "no")).toBeUndefined();
  expect(swapAnswer("q2: yes ", 1, opts, "no")).toBeUndefined();
  expect(swapAnswer("q1: yes because x\nq2: no ", 1, opts, "no")).toBe("q1: no because x\nq2: no ");
  expect(swapAnswer("q1: yes, later q2: yes ", 1, opts, "no")).toBe("q1: no q2: yes ");
  expect(swapAnswer("q1: no ", 1, opts, "no")).toBe("q1: no ");
});

test("clicking answers to two questions: each fills its own line once, a changed one swaps in place", async ($, on) => {
  mock.store(on);
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  const qs = [{ q: "Ship?", options: ["yes", "no"] }, { q: "Where?", options: ["main", "branch"] }];
  on("session.messages", () => ({ value: [said(block(JSON.stringify({ intent: "i", questions: qs })))] }));
  on("ui.invalidate", () => ({ value: undefined }));
  on("turn.complete", (_, e) => ({ text: e.answer }));
  let box = "";
  on("prompt.read", () => ({ value: { text: box, cursor: box.length } }));
  on("prompt.fill", (_, e) => {
    box = e.mode === "replace" ? e.text : box + e.text;
    return { isFilled: true };
  });
  await $.turn.complete({ answer: "ok", durationMs: 1, isAborted: false, turnId: "t", reason: "answer" });
  for (const surface of ["terminal", "desktop"] as const) {
    box = "";
    const band = await $.ui.mount({ plugin: "hunch", surface, component: "AbovePrompt", props: { bodyColumns: 80 } as any });
    const click = (act: string) => band.post({ act });
    await click("answer:0:0");
    expect(box).toBe("q1: yes ");
    await click("answer:1:0");
    expect(box).toBe("q1: yes \nq2: main ");
    await click("answer:0:1");
    expect(box).toBe("q1: no \nq2: main ");
    await click("answer:1:1");
    expect(box).toBe("q1: no \nq2: branch ");
    await click("answer:1:1");
    expect(box).toBe("q1: no \nq2: branch ");
  }
});

describe("ideas", () => {
  const ideas = [
    { by: "Tufte", idea: "one aligned row per file", why: "the eye compares what lines up", test: "now vs rows: wins if read once" },
    { by: "Orwell", idea: "at most five lines" },
  ];
  test("an idea needs who and what; a bad why or test drops it", async () => {
    expect(cleanCard({ ideas: [...ideas, { by: "X" }, { by: "Y", idea: "z", why: 3 }] }).ideas).toEqual(ideas);
  });
  test("the names are one column; only the ideas take a click; the why and test sit under the idea", async () => {
    const body = cardRows({ ideas }, "ideas", new Set());
    expect(navRows({ chips: [], body, doc: "" }).map((r) => r.map((i) => i.id))).toEqual([["probe:idea 1"], ["probe:idea 2"]]);
    const lines = layout({ chips: [], body, doc: "" }, 72);
    const x = (id: string) => lines.flatMap((l) => l.cells).find((c) => c.item.id === id)!.x;
    expect(x("probe:idea 1")).toBe(x("probe:idea 2"));
    expect(x("idea-note:0:0")).toBe(x("probe:idea 1"));
    expect(x("idea-note:0:1")).toBe(x("probe:idea 1"));
    expect(chipLabel("ideas", { card: { ideas }, ran: new Set(), rows: [], paneItem: null, memory: [] })).toBe("ideas 2");
  });
  test("consult is asked for its ideas as a card; another card skill for the session's", async ($, on) => {
    mock.store(on);
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: ["terminal"] }));
    on("command.list", () => ({ value: [{ name: "hope:consult" }, { name: "hope:intent" }] as any }));
    on("tool.call", () => ({ result: "ok" }) as any);
    const asked = async (skill: string) => ((await $.tool.call({ tool: "Skill", skill } as any)) as any).context;
    expect(await asked("hope:consult")).toEqual([IDEAS_FORMAT]);
    expect(await asked("hope:intent")).not.toContain(IDEAS_FORMAT);
  });
  test("clicking an idea puts its stem in the prompt", async ($, on) => {
    mock.store(on);
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: ["terminal"] }));
    on("session.messages", () => ({ value: [said(block(JSON.stringify({ ideas })))] }));
    on("ui.invalidate", () => ({ value: undefined }));
    on("turn.complete", (_, e) => ({ text: e.answer }));
    let box = "";
    on("prompt.read", () => ({ value: { text: box, cursor: box.length } }));
    on("prompt.fill", (_, e) => {
      box = e.mode === "replace" ? e.text : box + e.text;
      return { isFilled: true };
    });
    await $.turn.complete({ answer: "ok", durationMs: 1, isAborted: false, turnId: "t", reason: "answer" });
    for (const surface of ["terminal", "desktop"] as const) {
      box = "";
      const band = await $.ui.mount({ plugin: "hunch", surface, component: "AbovePrompt", props: { bodyColumns: 80 } as any });
      await band.post({ act: "probe:idea 2" });
      expect(box).toBe("idea 2: ");
    }
  });
});

test("a consult reply splits where its colours change", async () => {
  const reply = "1. Mostafa — **open on the title**\n   *his hooks open on it*\n\n2. Wegz — **leave a line `open`**\n   *no side*\n   win: louder\n\nWin: you pick it blind.\nIdea 5 is measured instead.\nBuild all two?";
  expect(ideaSegments(reply)).toEqual([
    { head: { lead: "1. Mostafa — ", change: "open on the title", rest: "" } },
    { dim: "   his hooks open on it" },
    { dim: "" },
    { head: { lead: "2. Wegz — ", change: "leave a line open", rest: "" } },
    { dim: "   no side" },
    { dim: "   win: louder" },
    { dim: "" },
    { dim: "Win: you pick it blind." },
    { dim: "Idea 5 is measured instead." },
    { md: "Build all two?" },
  ]);
});

describe("short replies", () => {
  const long = "word ".repeat(40);
  test("prose leaves out tables and fenced code", async () => {
    expect(prose("lead\n| a | b |\n|---|---|\n| 1 | 2 |\n```\ncode\n```\ntail")).toBe("lead\n\ntail");
  });
  test("only prose past two 80-column lines is shortened", async () => {
    expect(wantsShort(long, "status?")).toBe(true);
    expect(wantsShort("short line", "status?")).toBe(false);
    expect(wantsShort(`| row |\n${"| x |\n".repeat(60)}`, "status?")).toBe(false);
  });
  test("a reply the user asked to be long stays long", async () => {
    expect(wantsShort(long, "explain how it works")).toBe(false);
    expect(wantsShort(long, "walk me through it")).toBe(false);
  });
  test("the key tells replies apart and repeats for the same one", async () => {
    expect(textKey(long)).toBe(textKey(long));
    expect(textKey(long)).not.toBe(textKey(long + "."));
  });
});

// A real reply the user called a wall of text (a songs session, 2026-09-25), cut short.
const WALL = "The last research agent is back. No tool can check sung Egyptian Arabic word by word yet, and no candidate has been tested on singing. The work order above still waits on your answer.\n\nThree chains are worth building:\n\n1. **Free chain.**\n   - It runs on this Mac.\n   - It pulls out the vocal and finds each word's timing.\n   - Then it compares the sounds a phonetic recogniser hears (ZIPA) against the sounds I write by hand from your Franco.\n   - It is the only one of the three that can hear g against j, or a glottal stop against q.\n2. **Azure pronunciation scorer.**\n   - It lists Egyptian Arabic and scores each word against the lyric.\n   - It needs the least building.\n   - It gives no sound-by-sound detail for Arabic, so it catches blurred or wrong words, not accent.\n   - It is paid per hour of audio.\n3. **Two speech-to-text tools agreeing.** This measures whether a word comes ac";

test("a long reply is redrawn short once its turn ends, and /long shows it whole again", async ($, on) => {
  mock.store(on);
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.messages", () => ({ value: [{ role: "user", text: "we need to research avalable tools", toolUses: [] }, said(WALL)] }));
  on("ui.invalidate", () => ({ value: undefined }));
  on("ui.toast", () => ({ value: undefined }));
  const asks: string[] = [];
  on("model.complete", (_, e) => {
    asks.push(e.prompt);
    return { value: { isAnswered: true, text: "No tool checks sung words yet. Which chain do I build?", usage: {} } } as any;
  });
  let shown = "";
  on("ui.render", (_, e) => {
    shown = (e.props as any).text;
    return { type: "Box", props: {} } as any;
  });
  on("turn.complete", (_, e) => ({ text: e.answer }));
  await $.turn.complete({ answer: WALL, durationMs: 1, isAborted: false, turnId: "t", reason: "answer" });
  expect(asks).toHaveLength(1);
  expect(asks[0]).toContain(WALL);
  const reply = await $.ui.mount({ plugin: "hunch", surface: "terminal", component: "AssistantMessage", props: { text: WALL } as any });
  await reply.drawn();
  expect(shown).toContain("Which chain do I build?");
  await $.command.run({ command: "long", args: "" } as any);
  await $.ui.mount({ plugin: "hunch", surface: "terminal", component: "AssistantMessage", props: { text: WALL } as any });
  expect(shown).toContain("Three chains are worth building");
});
