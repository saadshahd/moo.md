import { describe, expect, mock, test } from "claude-code/testing";
import { hit, layout, move, navRows, wrap, type Item } from "./band.tsx";
import { CARD_FORMAT, prose, textKey, wantsShort, SHORT_CAP, IDEAS_FORMAT, ideaSegments, bandModel, cardRows, chipLabel, factParts, bareFact, cleanCard, commandFor, slashName, latestCard, proseQuestions, replayCard, stripCards, swapAnswer, turnQuestions, withOpen } from "./tend.tsx";

const block = (json: string) => `reply\n\`\`\`card\n${json}\n\`\`\`\n`;
const said = (text: string) => ({ role: "assistant", text, toolUses: [] });

describe("card parse", () => {
  test("good block", async () => {
    expect(latestCard([said(block('{"facts":["a"],"questions":[{"q":"x?","options":[]}]}'))])).toEqual({
      facts: ["a"],
      questions: [{ q: "x?", options: [] }],
    });
  });
  test("bad JSON is skipped for an older good one", async () => {
    expect(
      latestCard([said(block('{"facts":["old"]}')), said(block("{not json"))]),
    ).toEqual({ facts: ["old"] });
  });
  test("absent keys stay absent; no block is empty", async () => {
    expect(latestCard([said(block('{"facts":["s"]}'))])).toEqual({ facts: ["s"] });
    expect(latestCard([said("no card")])).toEqual({});
  });
  test("each key from the newest block that has it", async () => {
    expect(
      latestCard([
        said(block('{"ideas":[{"by":"Tufte","idea":"v"}],"facts":["a"]}')),
        said(block('{"facts":["b"]}')),
      ]),
    ).toEqual({ facts: ["b"], ideas: [{ by: "Tufte", idea: "v" }] });
  });
  test("[] clears an older list", async () => {
    expect(
      latestCard([said(block('{"facts":["a"]}')), said(block('{"facts":[]}'))]),
    ).toEqual({ facts: [] });
  });
  test("suggestions add up across blocks, oldest first", async () => {
    expect(
      latestCard([
        said(block('{"suggestions":["a"]}')),
        said(block('{"facts":["x"]}')),
        said(block('{"suggestions":["b","c"]}')),
      ]),
    ).toEqual({ facts: ["x"], suggestions: ["a", "b", "c"] });
  });
  test("a repeated suggestion shows once", async () => {
    expect(
      latestCard([
        said(block('{"suggestions":["a","b"]}')),
        said(block('{"suggestions":["a","b","c"]}')),
      ]),
    ).toEqual({ suggestions: ["a", "b", "c"] });
  });
  test("latest block wins", async () => {
    expect(
      latestCard([
        said(block('{"facts":["a"]}')),
        said(block('{"facts":["b"]}')),
      ]),
    ).toEqual({ facts: ["b"] });
  });
});

test("a card quoted in a reply is shown, and so is everything after it", async () => {
  const reply = 'It said:\n> ```card\n> {"facts":["x"]}\n> ```\n\nPart of this is stale.';
  expect(stripCards(reply)).toBe(reply);
  expect(latestCard([said(reply)])).toEqual({});
});

test("card block hidden, closed or still streaming", async () => {
  expect(stripCards(block('{"facts":["x"]}'))).toBe("reply");
  expect(stripCards('reply\n```card\n{"facts":["x"],"qu')).toBe("reply");
});

test("malformed fields dropped, good ones kept", async () => {
  expect(
    cleanCard({
      intent: "x",
      facts: ["a", 2, ""],
      questions: [{ q: "a?", options: "y" }, { q: "b?", options: ["y"] }],
      suggestions: [3],
    }),
  ).toEqual({
    facts: ["a"],
    questions: [{ q: "b?", options: ["y"] }],
    suggestions: [],
  });
});

test("a chip previews its card with one number", async () => {
  const c = { questions: [{ q: "x", options: [] }, { q: "y", options: [] }], suggestions: ["a"] };
  expect(chipLabel("questions", c)).toBe("questions 2");
  expect(chipLabel("suggestions", c)).toBe("suggestions 1");
});
test("a fact is a list item; in the pane it wraps under its bullet", async () => {
  const [[f]] = cardRows({ facts: ["alpha beta gamma delta"] } as any, "facts");
  expect(f.label).toBe("• alpha beta gamma delta");
  expect(wrap(f.label, 12)).toEqual(["• alpha beta", "  gamma", "  delta"]);
});
test("a card line wraps at the measure; chips never wrap", async () => {
  const body = [[{ id: "probe:fact 1", label: "word ".repeat(40).trim(), kind: "line" as const }]];
  const lines = layout({ chips: [], body }, 300);
  expect(lines.length).toBe(3);
  expect(lines.every((l) => l.cells[0].text.length <= 76)).toBe(true);
});
test("a fact reads as its claim, then the rest dim under it, a blank line between facts", async () => {
  expect(factParts("Suno sings. ACE Studio lost because it has no Arabic.")).toEqual(["Suno sings.", "ACE Studio lost because it has no Arabic."]);
  const rows = cardRows({ facts: ["Suno sings. ACE lost.", "One claim"] } as any, "facts");
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
  const lines = layout({ chips: [], body: cardRows(card, "questions") }, 40);
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
test("an item that won't fit the rest of its line starts the next one", async () => {
  const body: Item[][] = [[{ id: "a", label: "x".repeat(30), kind: "line" }, { id: "b", label: "y".repeat(20), kind: "line" }, { id: "c", label: "z", kind: "line" }]];
  const lines = layout({ chips: [], body }, 40);
  expect(lines.map((l) => l.cells.map((c) => c.text))).toEqual([["x".repeat(30)], ["y".repeat(20), "z"]]);
});
test("in the pane a row's last item runs on below itself, aligned", async () => {
  const body = [[{ id: "n", label: "facts    ", kind: "note" as const }, { id: "f", label: "• " + "word ".repeat(12).trim(), kind: "line" as const }]];
  const lines = layout({ chips: [], body }, 40);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.slice(1).every((l) => l.cells[0].x === lines[0].cells[1].x && l.cells[0].text.startsWith("  "))).toBe(true);
});
test("a skill name resolves to a real command, or none", async () => {
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

test("fact source prefix stripped", async () => {
  expect(bareFact("User confirmed: dark mode exists")).toBe("dark mode exists");
  expect(bareFact("Found: no settings page")).toBe("no settings page");
  expect(bareFact("Toggle only")).toBe("Toggle only");
});

const model = (card: object, open: string | null = null) => bandModel(card as any, open && `card:${open}`);

describe("band", () => {
  test("no card: nothing", async () => {
    expect(model({})).toEqual({ chips: [], body: [] });
  });
  test("only questions and suggestions are chips, and only with content", async () => {
    const b = model({ facts: ["a"], ideas: [{ by: "x", idea: "y" }], suggestions: [], questions: [{ q: "a?", options: ["y"] }] });
    expect(b.chips.map((c) => c.id)).toEqual(["chip:questions"]);
  });
  test("a card in the pane marks its chip; the band never opens it above the chips", async () => {
    const b = model({ suggestions: ["a", "b"] }, "suggestions");
    expect(b.chips[0].open).toBe(true);
    expect(b.body).toEqual([]);
  });
  test("no undefined anywhere: Client props refuse it", async () => {
    const b = model({ facts: ["a"], suggestions: ["a"] }, "suggestions");
    const holes = (v: unknown): boolean =>
      v === undefined || (typeof v === "object" && v !== null && Object.values(v).some(holes));
    expect(holes(b)).toBe(false);
  });
test("a question's rows: the question, which takes no click, then each answer", async () => {
    const rows = cardRows(
      { questions: [{ q: "a?", options: ["x", "y"] }] },
      "questions",
    );
    expect(rows.map((r) => r.map((i) => i.id))).toEqual([["question:0"], ["answer:0:0"], ["answer:0:1"]]);
    // A click reaches only what the arrows can stop on.
    expect(navRows({ chips: [], body: rows }).map((r) => r.map((i) => i.id))).toEqual([["answer:0:0"], ["answer:0:1"]]);
  });
});

describe("arrows", () => {
  // The facts pane over a row of chips: the arrows and clicks read any band the same way.
  const b = {
    ...model({ questions: [{ q: "q?", options: [] }], suggestions: ["s"] }, "suggestions"),
    body: cardRows({ facts: ["a", "b"] }, "facts"),
  };
  const rows = navRows(b);
  test("rows as drawn: each card line, then the chips; a blank line is no stop", async () => {
    expect(rows.map((r) => r.map((i) => i.id))).toEqual([
      ["probe:fact 1"],
      ["probe:fact 2"],
      ["chip:questions", "chip:suggestions"],
    ]);
  });
  test("left/right stay in the row; up/down change rows", async () => {
    expect(move({ row: 2, col: 0 }, rows, "right")).toEqual({ row: 2, col: 1 });
    expect(move({ row: 2, col: 1 }, rows, "right")).toEqual({ row: 2, col: 1 });
    expect(move({ row: 2, col: 1 }, rows, "up")).toEqual({ row: 1, col: 0 });
    expect(move({ row: 0, col: 0 }, rows, "up")).toEqual({ row: 0, col: 0 });
    expect(move({ row: 1, col: 0 }, rows, "down")).toEqual({ row: 2, col: 1 }); // back on the open chip
  });
  test("a click lands on the item drawn there", async () => {
    const cells = layout(b, 80);
    expect(cells.map((l) => l.y)).toEqual([0, 1, 2, 3]);
    // facts at y=0 and 2 around the blank line; chips "[ questions 1 ] [ ▴ suggestions 1 ]" at y=3
    expect(hit(cells, 0, 0)?.id).toBe("probe:fact 1");
    expect(hit(cells, 0, 1)).toBeUndefined();
    expect(hit(cells, 0, 2)?.id).toBe("probe:fact 2");
    expect(hit(cells, 1, 3)?.id).toBe("chip:questions");
    expect(hit(cells, 18, 3)?.id).toBe("chip:suggestions");
    expect(hit(cells, 40, 0)).toBeUndefined();
  });
  test("a word wider than the line is the one thing clipped", async () => {
    const wide = { chips: [], body: cardRows({ facts: ["x".repeat(100)] }, "facts") };
    const cell = layout(wide, 40).flatMap((l) => l.cells).find((c) => c.item.id === "probe:fact 1")!;
    expect(cell.x + cell.text.length).toBeLessThanOrEqual(40);
    expect(cell.text.endsWith("…")).toBe(true);
  });
  test("notes are read, never focused", async () => {
    const body = cardRows({ facts: ["Claim. What lost."] }, "facts");
    expect(navRows({ chips: [], body }).map((r) => r.map((i) => i.id))).toEqual([["probe:fact 1"]]);
  });
});

describe("open questions", () => {
  test("a line ending in ? is a question; code, the card and list markers are not", async () => {
    const reply = "Done.\n- Ship it now?\n```ts\nconst a = b?\n```\nIs that right?\n" + block('{"intent":"x?"}');
    expect(proseQuestions(reply, [])).toEqual(["Ship it now?", "Is that right?"]);
  });
  test("a quoted card hides nothing after it", async () => {
    const reply = "It said:\n> ```card\n> {\"facts\":[\"x\"]}\n> ```\n\nShould the demo keep going?";
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
    const card = { facts: ["i"], questions: [{ q: "Stale?", options: [] }] };
    expect(withOpen(card, [])).toEqual({ facts: ["i"] });
    expect(withOpen(card, [{ q: "Now?", options: [] }])).toEqual({ facts: ["i"], questions: [{ q: "Now?", options: [] }] });
    expect(withOpen(card, undefined)).toEqual(card);
  });
  test("a prose question joins the card, a repeat does not, and the next prompt closes them all", async ($, on) => {
    mock.store(on);
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: ["terminal"] }));
    const msgs = [said(block('{"facts":["i"],"questions":[{"q":"Which one?","options":["a"]}]}'))];
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
    expect(await replayed()).toEqual({ facts: ["i"] });
  });
});

test("a compaction ends on the whole card, word for word, open questions only", async ($, on) => {
  const card = {
    facts: ["The summary keeps what it chooses; the card keeps the rest."],
    suggestions: ["Replay the card → never trust the summary."],
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
  for (const s of [card.facts[0], card.suggestions[0], ...open.map((q) => q.q)])
    expect(messages![1].text.includes(JSON.stringify(s))).toBe(true);
});

test("an empty card adds nothing to a compaction", async () => {
  expect(replayCard({})).toBeUndefined();
});

/** A store that refuses a write taking its JSON past `cap` characters, as the engine's does past 4 MiB. */
function cappedStore(on: any, cap: number, entries: [string, unknown][] = []): Map<string, unknown> {
  const store = new Map<string, unknown>(entries);
  const size = () => JSON.stringify(Object.fromEntries(store)).length;
  on("store.get", (_: any, e: any) => ({ value: store.get(e.key) }));
  on("store.set", (_: any, e: any) => {
    const was = store.get(e.key);
    store.set(e.key, e.value);
    if (size() > cap) {
      was === undefined ? store.delete(e.key) : store.set(e.key, was);
      throw new Error("$.store.set: over the limit");
    }
    return { value: undefined };
  });
  on("store.delete", (_: any, e: any) => (store.delete(e.key), { value: undefined }));
  on("store.keys", () => ({ value: [...store.keys()] }));
  return store;
}

const MiB = 2 ** 20;
// A session's shortened replies, about `mib` MiB of them.
const savedOf = (s: string, mib: number): [string, unknown] => [`tend:${s}:short`, "x".repeat(mib * MiB - 100)];

test("a new session keeps the newest sessions that fit in 3 MiB, however many", async ($, on) => {
  const old = Array.from({ length: 5 }, (_, i) => `old${i}`);
  const store = cappedStore(on, 8 * MiB, [...old.map((s) => savedOf(s, 1)), ["tend:recent", old]]);
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.start", (_, e) => e);
  await $.session.start({ source: "startup", cwd: "/p" } as any);
  expect([...store.keys()].filter((k) => k !== "tend:recent")).toEqual(old.slice(0, 3).map((s) => savedOf(s, 1)[0]));
  expect(store.get("tend:recent")).toEqual(["s1", ...old.slice(0, 3)]);
});

test("the live session keeps its keys past the budget; the older ones go", async ($, on) => {
  const store = cappedStore(on, 8 * MiB, [savedOf("s1", 4), savedOf("old0", 0.5), ["tend:recent", ["old0", "s1"]]]);
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.start", (_, e) => e);
  await $.session.start({ source: "resume", cwd: "/p" } as any);
  expect([...store.keys()]).toEqual([savedOf("s1", 4)[0], "tend:recent"]);
  expect(store.get("tend:recent")).toEqual(["s1"]);
});

test("a store over its cap with no session list shrinks to the current session", async ($, on) => {
  const store = cappedStore(
    on,
    100,
    Array.from({ length: 10 }, (_, i): [string, unknown] => [`tend:old${i}:short`, "x".repeat(20)]),
  );
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.start", (_, e) => e);
  await $.session.start({ source: "startup", cwd: "/p" } as any);
  expect([...store.keys()]).toEqual(["tend:recent"]);
  expect(store.get("tend:recent")).toEqual(["s1"]);
});

// The work machine's store, full: the band lost its card, since every write tend awaited threw first.
test("a full store leaves the band its card and a card skill its ask; the refusal shows once", async ($, on) => {
  cappedStore(on, 0);
  mock.clock(on);
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.messages", () => ({ value: [said(block('{"suggestions":["s"],"questions":[{"q":"q?","options":[]}]}'))] }));
  on("command.list", () => ({ value: [{ name: "hope:intent" }] as any }));
  on("command.register", () => ({ value: undefined }));
  const toasts: unknown[] = [];
  on("ui.toast", (_, e) => (toasts.push(e), { value: undefined }));
  on("tool.call", () => ({ result: "ok" }) as any);
  on("prompt.submit", (_, e) => ({ text: e.text, context: e.context }));
  const band = await $.ui.mount({ plugin: "hunch", surface: "terminal", component: "AbovePrompt", props: { bodyColumns: 80 } as any });
  const chips = (((await band.find({ type: "Client" }))?.props.props as any)?.chips ?? []).map((c: any) => c.id);
  expect(chips).toEqual(["chip:questions", "chip:suggestions"]);
  expect(((await $.tool.call({ tool: "Skill", skill: "hope:intent" } as any)) as any).context).toContain(CARD_FORMAT);
  const prompt = await $.prompt.submit({ text: "/hope:intent tidy it", origin: { kind: "composer" } } as any);
  expect((prompt as any).context).toContain(CARD_FORMAT);
  expect(toasts).toHaveLength(1);
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
  on("session.messages", () => ({ value: [said(block(JSON.stringify({ questions: qs })))] }));
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
    const body = cardRows({ ideas }, "ideas");
    expect(navRows({ chips: [], body }).map((r) => r.map((i) => i.id))).toEqual([["probe:idea 1"], ["probe:idea 2"]]);
    const lines = layout({ chips: [], body }, 72);
    const x = (id: string) => lines.flatMap((l) => l.cells).find((c) => c.item.id === id)!.x;
    expect(x("probe:idea 1")).toBe(x("probe:idea 2"));
    expect(x("idea-note:0:0")).toBe(x("probe:idea 1"));
    expect(x("idea-note:0:1")).toBe(x("probe:idea 1"));
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
  test("ideas and facts are no chip; /ideas and /facts open them in the pane, or say there are none", async ($, on) => {
    mock.store(on);
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: ["terminal"] }));
    on("session.messages", () => ({ value: [said(block(JSON.stringify({ ideas })))] }));
    on("ui.invalidate", () => ({ value: undefined }));
    on("turn.complete", (_, e) => ({ text: e.answer }));
    const opened: unknown[] = [];
    on("ui.open", (_, e) => (opened.push(e), { value: { isPlaced: true } }) as any);
    const toasts: unknown[] = [];
    on("ui.toast", (_, e) => (toasts.push(e), { value: undefined }));
    await $.turn.complete({ answer: "ok", durationMs: 1, isAborted: false, turnId: "t", reason: "answer" });
    expect(model({ ideas }).chips).toEqual([]);
    await $.command.run({ command: "ideas", args: "" } as any);
    expect(opened).toHaveLength(1);
    await $.command.run({ command: "facts", args: "" } as any);
    expect(opened).toHaveLength(1);
    expect(toasts).toHaveLength(1);
  });
  test("clicking an idea puts its stem in the prompt", async ($, on) => {
    mock.store(on);
    on("session.id", () => ({ value: "s1" }));
    on("session.surfaces", () => ({ value: ["terminal"] }));
    // A question keeps the band drawn, so a click has a Client to come from.
    on("session.messages", () => ({ value: [said(block(JSON.stringify({ ideas, questions: [{ q: "q?", options: [] }] })))] }));
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
  const clock = mock.clock(on);
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
  // The short form is asked for unawaited: the turn ends before it comes back.
  await clock.settle();
  expect(asks).toHaveLength(1);
  expect(asks[0]).toContain(WALL);
  const reply = await $.ui.mount({ plugin: "hunch", surface: "terminal", component: "AssistantMessage", props: { text: WALL } as any });
  await reply.drawn();
  expect(shown).toContain("Which chain do I build?");
  await $.command.run({ command: "long", args: "" } as any);
  await $.ui.mount({ plugin: "hunch", surface: "terminal", component: "AssistantMessage", props: { text: WALL } as any });
  expect(shown).toContain("Three chains are worth building");
});

// Two real 7,000-character replies (a songs session, 2026-09-28) came back cut mid-table, their ask gone.
test("a short form that fills its token cap is dropped, and the reply stays long", async ($, on) => {
  mock.store(on);
  const clock = mock.clock(on);
  on("session.id", () => ({ value: "s1" }));
  on("session.surfaces", () => ({ value: ["terminal"] }));
  on("session.messages", () => ({ value: [{ role: "user", text: "we need to research avalable tools", toolUses: [] }, said(WALL)] }));
  on("ui.invalidate", () => ({ value: undefined }));
  const toasts: unknown[] = [];
  on("ui.toast", (_, e) => {
    toasts.push(e);
    return { value: undefined };
  });
  on("model.complete", () => ({ value: { isAnswered: true, text: "No tool checks sung words yet. | 40", usage: { output_tokens: SHORT_CAP } } }) as any);
  let shown = "";
  on("ui.render", (_, e) => {
    shown = (e.props as any).text;
    return { type: "Box", props: {} } as any;
  });
  on("turn.complete", (_, e) => ({ text: e.answer }));
  await $.turn.complete({ answer: WALL, durationMs: 1, isAborted: false, turnId: "t", reason: "answer" });
  await clock.settle();
  expect(toasts).toHaveLength(1);
  const reply = await $.ui.mount({ plugin: "hunch", surface: "terminal", component: "AssistantMessage", props: { text: WALL } as any });
  await reply.drawn();
  expect(shown).toContain("Three chains are worth building");
});
