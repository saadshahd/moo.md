import { describe, expect, test } from "claude-code/testing";
import type { On } from "claude-code";
import {
  FIX_STEM,
  afterTurn,
  applyChange,
  decide,
  findingKey,
  freshFindings,
  handoff,
  hunk,
  isRepoBound,
  parseFindings,
  register,
  touchedFiles,
} from "./slop.tsx";
import type { Finding, Slop } from "../slop.d.ts";

// ---- pure ----

describe("touchedFiles", () => {
  const edit = (tool: string, file_path: string) => ({
    tool,
    input: { file_path },
  });
  test("edits from the offset on, each file once, assistant rows only", () => {
    const messages = [
      { role: "assistant", toolUses: [edit("Edit", "/r/old.ts")] },
      { role: "user", toolUses: [edit("Edit", "/r/user.ts")] },
      {
        role: "assistant",
        toolUses: [edit("Write", "/r/a.ts"), edit("Read", "/r/b.ts")],
      },
      { role: "assistant", toolUses: [edit("Edit", "/r/a.ts")] },
    ];
    expect(touchedFiles(messages, 1)).toEqual(["/r/a.ts"]);
  });
  test("a notebook edit names its notebook", () => {
    expect(
      touchedFiles(
        [
          {
            role: "assistant",
            toolUses: [
              { tool: "NotebookEdit", input: { notebook_path: "/r/n.ipynb" } },
            ],
          },
        ],
        0,
      ),
    ).toEqual(["/r/n.ipynb"]);
  });
  test("a refused edit names no file", () => {
    expect(
      touchedFiles(
        [
          {
            role: "assistant",
            toolUses: [
              { tool: "Edit", input: { file_path: "/r/a.ts" }, isError: true },
            ],
          },
        ],
        0,
      ),
    ).toEqual([]);
  });
});

const F = (over: Partial<Finding> = {}): Finding => ({
  file: "a.ts",
  line: 1,
  rule: "rule",
  claim: "c",
  before: [],
  after: [],
  ...over,
});

describe("parseFindings", () => {
  test("CLEAN or nothing is no finding", () => {
    expect(parseFindings("CLEAN\n")).toEqual([]);
    expect(parseFindings("  \n")).toEqual([]);
  });
  test("a bare - or + is a blank line of the change, not a finding", () => {
    const found = parseFindings("a.ts:3 | r | gone.\n- x\n-\n- y\n+ x\n+\n");
    expect(found.map((f) => [f.before, f.after])).toEqual([[["x", "", "y"], ["x", ""]]]);
  });
  test("a header and its change lines make one finding", () => {
    expect(
      parseFindings("hope/hooks/judge.sh:15 | fail loud | A missing claude reads as clean.\n- || exit 0\n+ || exit 127\n"),
    ).toEqual([
      F({ file: "hope/hooks/judge.sh", line: 15, rule: "fail loud", claim: "A missing claude reads as clean.", before: ["|| exit 0"], after: ["|| exit 127"] }),
    ]);
  });
  test("a deletion has no + lines; the next header starts the next finding", () => {
    const found = parseFindings("a.ts:3 | r | gone.\n- old\nb.ts:9 | s | odd.\n");
    expect(found.map((f) => [f.file, f.before, f.after])).toEqual([
      ["a.ts", ["old"], []],
      ["b.ts", [], []],
    ]);
  });
  test("a fence or stray line after a header stays in that finding", () => {
    const found = parseFindings("a.ts:3 | r | gone.\n```diff\n- x\nnote\n  + y\n```\n");
    expect(found.map((f) => [f.before, f.after])).toEqual([[["x"], ["y"]]]);
  });
  test("a line in another shape keeps its text", () => {
    expect(parseFindings("something odd")).toEqual([{ rule: "", claim: "something odd", before: [], after: [] }]);
  });
});

describe("findingKey", () => {
  test("case, parentheticals and a leading no key the same", () => {
    expect(findingKey(F({ rule: "No duplicated concept (DRY)" }))).toBe(findingKey(F({ rule: "duplicated concept" })));
  });
  test("another file keys differently", () => {
    expect(findingKey(F())).not.toBe(findingKey(F({ file: "b.ts" })));
  });
  test("a finding with no file has no key", () => {
    expect(findingKey({ rule: "", claim: "x", before: [], after: [] })).toBeUndefined();
  });
});

describe("freshFindings", () => {
  test("drops findings already seen, keeps keyless ones", () => {
    const first = freshFindings([F()], []);
    const odd: Finding = { rule: "", claim: "odd", before: [], after: [] };
    const b = F({ file: "b.ts" });
    expect(freshFindings([F({ line: 9, claim: "y" }), odd, b], first.seen).fresh).toEqual([odd, b]);
  });
});

describe("isRepoBound", () => {
  test("tracked files stay, untracked and ignored go", () => {
    expect(isRepoBound("")).toBe(true);
    expect(isRepoBound(" M a.ts\n")).toBe(true);
    expect(isRepoBound("?? a.ts\n")).toBe(false);
    expect(isRepoBound("!! a.ts\n")).toBe(false);
  });
});

describe("applyChange", () => {
  const f = F({ line: 2, before: ["b"], after: ["B", "B2"] });
  test("swaps the - lines at the finding's line for the + lines", () => {
    expect(applyChange("a\nb\nc", f)).toBe("a\nB\nB2\nc");
  });
  test("finds the - lines in one other place when the line is off", () => {
    expect(applyChange("b\na\nc", f)).toBe("B\nB2\na\nc");
  });
  test("throws when the - lines are in no place or in several", () => {
    expect(() => applyChange("a\nc", f)).toThrow("not in the file");
    expect(() => applyChange("b\na\nb", F({ line: 2, before: ["b"] }))).toThrow("in 2 places");
  });
});

describe("hunk", () => {
  test("one unified-diff hunk from the finding's line", () => {
    expect(hunk(F({ line: 3, before: ["x"], after: ["y", "z"] }))).toBe("@@ -3,1 +3,2 @@\n-x\n+y\n+z");
  });
});

describe("decide", () => {
  const a = F({ before: ["x"] });
  const b = F({ file: "b.ts" });
  const c = F({ file: "c.ts" });
  const s: Slop = { findings: [a, b, c], cursor: 0, marks: [], reviewing: true, editing: false, chosen: [], seen: [], offset: 0 };
  test("a decision before the last moves the cursor, keeps the mark and ends an edit", () => {
    expect(decide({ ...s, editing: true }, { kind: "reject" })).toEqual({ ...s, cursor: 1, marks: [{ kind: "reject" }] });
  });
  test("the last decision ends the review: edited and change-less accepted findings go to Claude", () => {
    const end = [{ kind: "accept" }, { kind: "edit", note: "n" }, { kind: "accept" }] as const;
    expect(end.reduce(decide, s)).toEqual({ ...s, findings: [], reviewing: false, chosen: [{ finding: b, note: "n" }, { finding: c }] });
  });
  test("an accepted or edited finding's key is forgotten, a rejected one's kept", () => {
    const seen = [findingKey(a)!, findingKey(b)!, findingKey(c)!];
    const end = [{ kind: "reject" }, { kind: "edit", note: "n" }, { kind: "accept" }] as const;
    expect(end.reduce(decide, { ...s, seen }).seen).toEqual([findingKey(a)]);
  });
  test("with nothing under the cursor nothing changes", () => {
    const empty = { ...s, findings: [] };
    expect(decide(empty, { kind: "reject" })).toEqual(empty);
  });
});

describe("handoff", () => {
  test("each finding located, with its suggested change and the person's edit", () => {
    const odd = { rule: "", claim: "odd", before: [], after: [] };
    expect(handoff([{ finding: F({ line: 3, before: ["x"], after: ["y"] }), note: "keep x" }, { finding: odd }])).toBe(
      "Slop findings to fix:\na.ts:3 — c (rule)\n- x\n+ y\nThe person's edit, which wins over the change above: keep x\nodd",
    );
  });
});

// ---- effects: register()'s hooks driven through a fake host ----

function harness(judgeOut: string) {
  const handlers: Record<string, ((...a: any[]) => any)[]> = {};
  const on = (...args: any[]) =>
    (handlers[args[0]] ??= []).push(args[args.length - 1]);
  register(on as any);

  const state: Record<string, { value: unknown; version: number }> = {};
  const runs: { argv: string[]; stdin?: string }[] = [];
  let messages: any[] = [];

  const $ = {
    plugin: { name: "hope", root: "/plugin" },
    state: {
      get: async (ref: { plugin: string; key: string }) =>
        state[`${ref.plugin}.${ref.key}`] ?? { value: undefined, version: 0 },
      set: async (
        ref: { plugin: string; key: string },
        value: unknown,
        opts?: { ifVersion?: number },
      ) => {
        const k = `${ref.plugin}.${ref.key}`;
        const cur = state[k]?.version ?? 0;
        if (opts?.ifVersion !== undefined && opts.ifVersion !== cur)
          return { isSet: false };
        state[k] = { value, version: cur + 1 };
        return { isSet: true };
      },
    },
    session: { messages: async () => messages, root: async () => "/r" },
    process: {
      run: async (argv: string[], init?: { stdin?: string }): Promise<any> => {
        runs.push({ argv, stdin: init?.stdin });
        if (argv[0] === "git")
          return {
            exitCode: 0,
            stdout: argv.at(-1) === "/r/scratch.md" ? "?? scratch.md" : "",
            stderr: "",
          };
        return { exitCode: 0, stdout: judgeOut, stderr: "" };
      },
    },
    ui: { toast: () => {} },
  };

  const slop = async () =>
    (await $.state.get({ plugin: "hope", key: "slop" })).value as
      Slop | undefined;
  const editTurn = (...files: string[]) => {
    messages = [
      ...messages,
      {
        role: "assistant",
        toolUses: files.map((f) => ({ tool: "Edit", input: { file_path: f } })),
      },
    ];
  };
  const submit = (text: string) =>
    handlers["prompt.submit"][0]($, { text }, async (e: unknown) => e);
  return { $, handlers, runs, slop, editTurn, submit };
}

const FOUND = "/r/a.ts:3 | rule | wrong here.\n- old\n+ new";

describe("after a turn", () => {
  test("judges only repo-bound files touched since the last turn", async () => {
    const h = harness("CLEAN");
    h.editTurn("/r/a.ts", "/r/scratch.md");
    await afterTurn(h.$);
    const judged = () =>
      h.runs.filter((r) => r.argv[0] === "/plugin/hooks/judge.sh");
    expect(judged().map((r) => r.stdin)).toEqual(["/r/a.ts\n"]);
    await afterTurn(h.$);
    expect(judged().length).toBe(1);
  });

  test("a finding shows once across turns", async () => {
    const h = harness(FOUND);
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    expect((await h.slop())?.findings).toEqual([
      { file: "/r/a.ts", line: 3, rule: "rule", claim: "wrong here.", before: ["old"], after: ["new"] },
    ]);
  });

  test("a subagent's turn end starts no judge", async () => {
    const h = harness(FOUND);
    h.editTurn("/r/a.ts");
    await h.handlers["turn.complete"][0](h.$, { agentId: "a1" }, async () => ({
      text: "",
    }));
    expect(h.runs).toEqual([]);
  });
});

describe("a failing judge", () => {
  test("shows the same failure once a session", async () => {
    const h = harness("");
    h.$.process.run = async (argv: string[]) =>
      argv[0] === "git"
        ? { exitCode: 0, stdout: "", stderr: "" }
        : { exitCode: 127, stdout: "", stderr: "claude not on PATH\n" };
    h.editTurn("/r/a.ts");
    await expect(afterTurn(h.$)).rejects.toThrow(
      "judge.sh exited 127: claude not on PATH",
    );
    h.editTurn("/r/b.ts");
    await afterTurn(h.$);
  });
});

describe("handing chosen findings to Claude", () => {
  test("only a submit that keeps the stem carries them, then they clear", async () => {
    const h = harness(FOUND);
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    expect((await h.submit("something else")).context).toBeUndefined();

    const s = (await h.slop())!;
    await h.$.state.set({ plugin: "hope", key: "slop" }, decide({ ...s, reviewing: true }, { kind: "edit", note: "n" }));
    expect((await h.submit("unrelated prompt")).context).toBeUndefined();

    const sent = await h.submit(`${FIX_STEM}but keep the null check`);
    expect(sent.context).toEqual([
      "Slop findings to fix:\n/r/a.ts:3 — wrong here. (rule)\n- old\n+ new\nThe person's edit, which wins over the change above: n",
    ]);
    expect((await h.slop())?.chosen).toEqual([]);
  });
});

// ---- the review, drawn by the engine ----

/** The engine's session state for hope's slop, held here: `now()` reads it. */
function slopState(on: On, start: Slop) {
  let cur = { value: start as unknown, version: 1 };
  on("state.get", () => ({ value: cur }) as any);
  on("state.set", (_: unknown, e: any) => {
    if (e.ifVersion !== undefined && e.ifVersion !== cur.version) return { value: { isSet: false, version: cur.version } } as any;
    cur = { value: e.value, version: cur.version + 1 };
    return { value: { isSet: true, version: cur.version } } as any;
  });
  on("ui.close", () => ({ value: undefined }) as any);
  on("ui.invalidate", () => ({ value: undefined }) as any);
  on("prompt.fill", () => ({ value: { isFilled: true } }) as any);
  on("ui.render", () => ({ type: "Box", props: {} }) as any);
  return () => cur.value as Slop;
}
const waiting = (findings: Finding[]): Slop => ({ findings, cursor: 0, marks: [], reviewing: true, editing: false, chosen: [], seen: [], offset: 0 });
const settle = () => new Promise((r) => setTimeout(r, 10));
// The engine redraws on a state set; the state here is the test's, so the test redraws.

test("the review: the pane draws the finding under the cursor as one whole diff", async ($, on) => {
  slopState(on, waiting([F({ line: 3, before: ["x"], after: ["y"] }), F({ file: "b.ts" })]));
  const pane = await $.ui.mount({ plugin: "hope", surface: "terminal", component: "Pane", props: {} as any, requestId: "slop" });
  expect(await pane.findAll({ type: "Code" })).toHaveLength(1);
  expect(await pane.find({ type: "Text", text: "b.ts:1" })).toBeUndefined();
});

test("the review: edit keeps the person's words for Claude; reject drops the last one", async ($, on) => {
  const now = slopState(on, waiting([F(), F({ file: "b.ts" })]));
  const row = await $.ui.mount({ plugin: "hope", surface: "terminal", component: "AbovePrompt", props: { hasSurvey: false } as any });
  await row.press({ key: "slop-edit" });
  await settle();
  await row.redraw();
  await row.input({ key: "slop-note", text: "keep it" });
  await settle();
  await row.redraw();
  await row.press({ key: "slop-reject" });
  await settle();
  const s = now();
  expect(s.chosen).toEqual([{ finding: F(), note: "keep it" }]);
  expect(s.findings).toEqual([]);
});

test("the review: accept writes the change into the file and moves on", async ($, on) => {
  const now = slopState(on, waiting([F({ line: 2, before: ["b"], after: ["B"] }), F({ file: "b.ts" })]));
  const files: Record<string, string> = { "/r/a.ts": "a\nb\nc" };
  on("session.root", () => ({ value: "/r" }) as any);
  on("fs.read", (_: unknown, e: any) => ({ value: files[e.path] }) as any);
  on("fs.write", (_: unknown, e: any) => {
    files[e.path] = e.text;
    return { value: undefined } as any;
  });
  const row = await $.ui.mount({ plugin: "hope", surface: "terminal", component: "AbovePrompt", props: { hasSurvey: false } as any });
  await row.press({ key: "slop-accept" });
  await settle();
  expect(files["/r/a.ts"]).toBe("a\nB\nc");
  expect(now().cursor).toBe(1);
});
