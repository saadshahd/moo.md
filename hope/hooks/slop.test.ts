import { describe, expect, test } from "claude-code/testing";
import type { On } from "claude-code";
import {
  ADDRESSED,
  FIX_STEM,
  MOVED,
  addFindings,
  addressed,
  afterTurn,
  appliedNote,
  applyChange,
  FIX_SLOPS,
  NONE,
  FORGET_REJECTS,
  KEPT_REJECTS,
  REJECTS,
  decide,
  fenced,
  findingKey,
  fixReport,
  handoff,
  hunk,
  isRepoBound,
  parseFindings,
  register,
  newestByKey,
  sortRepeats,
  touchedFiles,
  verdict,
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

describe("verdict", () => {
  const run = (exitCode: number, stdout: string, stderr = "") => ({
    exitCode,
    stdout,
    stderr,
  });
  test("CLEAN first is a run with no finding", () => {
    expect(verdict(run(0, "CLEAN\n"))).toEqual({ kind: "ran", found: [] });
  });
  test("printing nothing is not run, never CLEAN", () => {
    expect(verdict(run(0, "  \n"))).toEqual({
      kind: "not run",
      why: "judge.sh printed nothing",
    });
  });
  test("a nonzero exit is not run, whatever it printed", () => {
    expect(verdict(run(1, "CLEAN\n", "killed\nmore\n"))).toEqual({
      kind: "not run",
      why: "judge.sh exited 1: killed",
    });
  });
});

describe("parseFindings", () => {
  test("a bare - or + is a blank line of the change, not a finding", () => {
    const found = parseFindings("a.ts:3 | r | gone.\n- x\n-\n- y\n+ x\n+\n");
    expect(found.map((f) => [f.before, f.after])).toEqual([
      [
        ["x", "", "y"],
        ["x", ""],
      ],
    ]);
  });
  test("a header and its change lines make one finding", () => {
    expect(
      parseFindings(
        "hope/hooks/judge.sh:15 | fail loud | A missing claude reads as clean.\n- || exit 0\n+ || exit 127\n",
      ),
    ).toEqual([
      F({
        file: "hope/hooks/judge.sh",
        line: 15,
        rule: "fail loud",
        claim: "A missing claude reads as clean.",
        before: ["|| exit 0"],
        after: ["|| exit 127"],
      }),
    ]);
  });
  test("a deletion has no + lines; the next header starts the next finding", () => {
    const found = parseFindings(
      "a.ts:3 | r | gone.\n- old\nb.ts:9 | s | odd.\n",
    );
    expect(found.map((f) => [f.file, f.before, f.after])).toEqual([
      ["a.ts", ["old"], []],
      ["b.ts", [], []],
    ]);
  });
  test("a fence or stray line after a header stays in that finding", () => {
    const found = parseFindings(
      "a.ts:3 | r | gone.\n```diff\n- x\nnote\n  + y\n```\n",
    );
    expect(found.map((f) => [f.before, f.after])).toEqual([[["x"], ["y"]]]);
  });
  test("a line in another shape keeps its text", () => {
    expect(parseFindings("something odd")).toEqual([
      { rule: "", claim: "something odd", before: [], after: [] },
    ]);
  });
});

describe("findingKey", () => {
  test("case, parentheticals and a leading no key the same", () => {
    expect(findingKey(F({ rule: "No duplicated concept (DRY)" }))).toBe(
      findingKey(F({ rule: "duplicated concept" })),
    );
  });
  test("another file keys differently", () => {
    expect(findingKey(F())).not.toBe(findingKey(F({ file: "b.ts" })));
  });
  test("a finding with no file has no key", () => {
    expect(
      findingKey({ rule: "", claim: "x", before: [], after: [] }),
    ).toBeUndefined();
  });
});

describe("addFindings", () => {
  const none: Slop = {
    findings: [],
    cursor: 0,
    marks: [],
    reviewing: false,
    editing: false,
    chosen: [],
    applied: [],
    seen: [],
    offset: 0,
  };
  const odd: Finding = { rule: "", claim: "odd", before: [], after: [] };
  const b = F({ file: "b.ts" });
  test("drops findings already seen and decided, keeps keyless ones", () => {
    const decided = { ...addFindings(none, [F()]), findings: [] };
    expect(
      addFindings(decided, [F({ line: 9, claim: "y" }), odd, b]).findings,
    ).toEqual([odd, b]);
  });
  test("a waiting finding takes the newer change in its place", () => {
    const first = addFindings(none, [F({ before: ["x"] }), b]);
    const newer = F({ line: 4, before: ["x2"] });
    expect(
      addFindings(first, [newer, F({ line: 9, before: ["x3"] })]).findings,
    ).toEqual([newer, b]);
  });
  test("a finding decided this review keeps its change", () => {
    const first = {
      ...addFindings(none, [F({ before: ["x"] }), b]),
      cursor: 1,
    };
    expect(addFindings(first, [F({ before: ["x2"] })]).findings).toEqual(
      first.findings,
    );
  });
});

describe("sortRepeats", () => {
  const repo = { id: "/r/.git", root: "/r/sub", top: "/r" };
  const reject = F({ file: "sub/a.ts", rule: "no var" });
  const other = F({ file: "sub/b.ts", rule: "dry" });
  const empty: Slop = {
    findings: [],
    cursor: 0,
    marks: [],
    reviewing: false,
    editing: false,
    chosen: [],
    applied: [],
    seen: [],
    offset: 0,
    unjudged: [],
    hidden: [],
  };
  test("a reject's file and rule hide a finding whether its file is absolute or the session root's", () => {
    const found = [
      F({ file: "/r/sub/a.ts", rule: "var" }),
      F({ rule: "No var" }),
    ];
    expect(
      sortRepeats(found, [reject, other], empty, repo).map((x) => x.kind),
    ).toEqual(["hide", "hide"]);
  });
  test("another rule in a file with rejects asks about that file's rejects alone; a file with none shows", () => {
    const found = [F({ rule: "naming" }), F({ file: "c.ts" })];
    expect(sortRepeats(found, [reject, other], empty, repo)).toEqual([
      { kind: "ask", finding: found[0], rejects: [reject] },
      { kind: "show", finding: found[1] },
    ]);
  });
  test("a finding this session showed goes on as shown, never to the model or the hidden list", () => {
    const s = { ...empty, seen: [findingKey(F({ rule: "naming" }))!] };
    expect(
      sortRepeats([F({ rule: "naming", line: 9 })], [reject], s, repo)[0].kind,
    ).toBe("show");
  });
});

describe("newestByKey", () => {
  test("each key stays once, at its newest place, and only the newest cap are kept", () => {
    const many = Array.from({ length: KEPT_REJECTS }, (_, i) =>
      F({ rule: `r${i}` }),
    );
    const again = F({ rule: "r1", claim: "newer" });
    const kept = newestByKey([...many, again], findingKey, KEPT_REJECTS);
    expect(kept.length).toBe(KEPT_REJECTS);
    expect(kept.at(-1)).toEqual(again);
    expect(kept.filter((r) => r.rule === "r1")).toEqual([again]);
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
  test("none when the - lines are in no place or in several", () => {
    expect(applyChange("a\nc", f)).toBeUndefined();
    expect(
      applyChange("b\na\nb", F({ line: 2, before: ["b"] })),
    ).toBeUndefined();
  });
});

describe("addressed", () => {
  test("the addressed line goes last, once", () => {
    expect(addressed("")).toBe(ADDRESSED);
    expect(addressed("keep going\n")).toBe(`keep going\n${ADDRESSED}`);
    expect(addressed(`keep going\n${ADDRESSED}`)).toBe(
      `keep going\n${ADDRESSED}`,
    );
  });
});

describe("hunk", () => {
  test("one unified-diff hunk from the finding's line", () => {
    expect(hunk(F({ line: 3, before: ["x"], after: ["y", "z"] }))).toBe(
      "@@ -3,1 +3,2 @@\n-x\n+y\n+z",
    );
  });
});

describe("decide", () => {
  const a = F({ before: ["x"] });
  const b = F({ file: "b.ts" });
  const c = F({ file: "c.ts" });
  const s: Slop = {
    findings: [a, b, c],
    cursor: 0,
    marks: [],
    reviewing: true,
    editing: false,
    chosen: [],
    applied: [],
    seen: [],
    offset: 0,
  };
  test("a decision before the last moves the cursor, keeps the mark and ends an edit", () => {
    expect(decide({ ...s, editing: true }, { kind: "reject" })).toEqual({
      ...s,
      cursor: 1,
      marks: [{ kind: "reject" }],
    });
  });
  test("the last decision ends the review: edited findings and accepted ones that wrote nothing go to Claude to fix, written ones as fixed", () => {
    const end = [
      { kind: "accept", wrote: true },
      { kind: "edit", note: "n" },
      { kind: "accept", wrote: false },
    ] as const;
    expect(end.reduce(decide, s)).toEqual({
      ...s,
      findings: [],
      reviewing: false,
      chosen: [{ finding: b, note: "n" }, { finding: c }],
      applied: [a],
    });
    const moved = [
      { kind: "accept", wrote: false },
      { kind: "reject" },
      { kind: "reject" },
    ] as const;
    expect(moved.reduce(decide, s).chosen).toEqual([{ finding: a }]);
  });
  test("an accepted or edited finding's key is forgotten, a rejected one's kept", () => {
    const seen = [findingKey(a)!, findingKey(b)!, findingKey(c)!];
    const end = [
      { kind: "reject" },
      { kind: "edit", note: "n" },
      { kind: "accept", wrote: false },
    ] as const;
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
    expect(
      handoff([
        {
          finding: F({ line: 3, before: ["x"], after: ["y"] }),
          note: "keep x",
        },
        { finding: odd },
      ]),
    ).toBe(
      "Slop findings to fix:\na.ts:3 — c (rule)\n- x\n+ y\nThe person's edit, which wins over the change above: keep x\nodd",
    );
  });
});

describe("appliedNote", () => {
  test("each written finding located, then the ask to commit them", () => {
    expect(appliedNote([F({ line: 3, before: ["x"], after: ["y"] })])).toBe(
      "After your last turn the person wrote these slop fixes into the files; they are not committed:\na.ts:3 — c (rule)\n- x\n+ y\nCommit them the way you commit your own work here.",
    );
  });
});

describe("fenced", () => {
  test("the fence outgrows every backtick run in the text", () => {
    expect(fenced("diff", "+x")).toBe("```diff\n+x\n```");
    expect(fenced("diff", "+````md")).toBe("`````diff\n+````md\n`````");
  });
});

describe("fixReport", () => {
  test("a written finding shows its rule and claim over its diff", () => {
    expect(
      fixReport([
        { finding: F({ line: 3, before: ["x"], after: ["y"] }), wrote: true },
      ]),
    ).toBe("`a.ts:3` — rule — c\n\n```diff\n@@ -3,1 +3,1 @@\n-x\n+y\n```");
  });
  test("an unwritten finding says why and that it waits for Claude", () => {
    expect(
      fixReport([
        { finding: F({ before: ["x"] }), wrote: false },
        { finding: F(), wrote: false },
      ]),
    ).toBe(
      [
        "`a.ts:1` — rule — c",
        "Not written: the file changed since the judge read it. It waits in the prompt box for Claude.",
        "`a.ts:1` — rule — c",
        "Not written: the judge gave no change. It waits in the prompt box for Claude.",
      ].join("\n\n"),
    );
  });
});

// ---- effects: register()'s hooks driven through a fake host ----

function harness(judgeOut: string, stored: Record<string, unknown> = {}) {
  const handlers: Record<string, ((...a: any[]) => any)[]> = {};
  const on = (...args: any[]) =>
    (handlers[args[0]] ??= []).push(args[args.length - 1]);
  register(on as any);

  const state: Record<string, { value: unknown; version: number }> = {};
  const runs: { argv: string[]; stdin?: string }[] = [];
  const store = new Map(Object.entries(stored));
  const picks: string[] = [];
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
    store: {
      get: async (key: string) => store.get(key),
      set: async (key: string, value: unknown) => void store.set(key, value),
      delete: async (key: string) => void store.delete(key),
      keys: async () => [...store.keys()],
    },
    model: {
      classify: async (
        text: string,
        labels: readonly string[],
      ): Promise<string | undefined> => (picks.push(text), labels.at(-1)),
    },
    session: { messages: async () => messages, root: async () => "/r" },
    process: {
      run: async (argv: string[], init?: { stdin?: string }): Promise<any> => {
        runs.push({ argv, stdin: init?.stdin });
        if (argv.includes("rev-parse"))
          return { exitCode: 0, stdout: "/r/.git\n/r\n", stderr: "" };
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
  return { $, handlers, runs, store, picks, slop, editTurn, submit };
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
      {
        file: "/r/a.ts",
        line: 3,
        rule: "rule",
        claim: "wrong here.",
        before: ["old"],
        after: ["new"],
      },
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

/** A reject an earlier session stored for the repo at "/r", its file relative to the repo. */
const REJECTED: Finding = {
  file: "a.ts",
  line: 3,
  rule: "Rule",
  claim: "wrong there.",
  before: ["old"],
  after: ["new"],
};
const REJECTS_HERE = "slop:rejects:/r/.git";

describe("rejects from earlier sessions", () => {
  test("a finding with a stored reject's file and rule stays hidden, and counts as hidden", async () => {
    const h = harness(FOUND, { [REJECTS_HERE]: [REJECTED] });
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    const s = await h.slop();
    expect(s?.findings).toEqual([]);
    expect(s?.hidden.map((x) => [x.finding.file, x.repeats, x.by])).toEqual([
      ["/r/a.ts", REJECTED, "rule"],
    ]);
    expect(h.picks).toEqual([]);
  });

  const NEW_RULE = "/r/a.ts:5 | other wording | still wrong.\n- x\n+ y";
  test("another rule in that file is hidden when the model picks a reject, once a session", async () => {
    const h = harness(NEW_RULE, { [REJECTS_HERE]: [REJECTED] });
    h.$.model.classify = async (text: string) => (h.picks.push(text), "1");
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    const s = await h.slop();
    expect(s?.findings).toEqual([]);
    expect(s?.hidden.map((x) => [x.repeats, x.by])).toEqual([
      [REJECTED, "pick"],
    ]);
    expect(h.picks.length).toBe(1);
  });
  test("it shows when the model picks none", async () => {
    const h = harness(NEW_RULE, { [REJECTS_HERE]: [REJECTED] });
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    expect((await h.slop())?.findings.map((f) => f.rule)).toEqual([
      "other wording",
    ]);
  });
  test("every finding shows when the rejects cannot be read", async () => {
    const h = harness(FOUND, { [REJECTS_HERE]: [REJECTED] });
    h.$.store.get = async () => {
      throw new Error("store unreadable");
    };
    h.editTurn("/r/a.ts");
    await expect(afterTurn(h.$)).rejects.toThrow("store unreadable");
    expect((await h.slop())?.findings.map((f) => f.rule)).toEqual(["rule"]);
  });
  test("it shows when the model check fails, and the failure shows once", async () => {
    const h = harness(NEW_RULE, { [REJECTS_HERE]: [REJECTED] });
    h.$.model.classify = async () => {
      throw new Error("overloaded");
    };
    h.editTurn("/r/a.ts");
    await expect(afterTurn(h.$)).rejects.toThrow(
      "the repeat check failed, so its findings show: overloaded",
    );
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    expect((await h.slop())?.findings.map((f) => f.rule)).toEqual([
      "other wording",
    ]);
  });
});

describe("a judge that did not run", () => {
  test("shows not run once a session and adds no finding", async () => {
    const h = harness("");
    h.editTurn("/r/a.ts");
    await expect(afterTurn(h.$)).rejects.toThrow(
      "not run: judge.sh printed nothing",
    );
    h.editTurn("/r/b.ts");
    await afterTurn(h.$);
    expect((await h.slop())?.findings).toEqual([]);
  });
  test("its files join the next run's, once, and leave when a run happens", async () => {
    const h = harness("");
    const judged: string[] = [];
    h.$.process.run = async (argv: string[], init?: { stdin?: string }) => {
      if (argv[0] === "git") return { exitCode: 0, stdout: "", stderr: "" };
      judged.push(init?.stdin ?? "");
      return {
        exitCode: 0,
        stdout: judged.length === 1 ? "" : "CLEAN",
        stderr: "",
      };
    };
    h.editTurn("/r/a.ts", "/r/b.ts");
    await expect(afterTurn(h.$)).rejects.toThrow("not run");
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    h.editTurn("/r/c.ts");
    await afterTurn(h.$);
    expect(judged).toEqual([
      "/r/a.ts\n/r/b.ts\n",
      "/r/a.ts\n/r/b.ts\n",
      "/r/c.ts\n",
    ]);
    expect((await h.slop())?.unjudged).toEqual([]);
  });
  test("a judge that never finished is not run", async () => {
    const h = harness("");
    h.$.process.run = async (argv: string[]) => {
      if (argv[0] === "git") return { exitCode: 0, stdout: "", stderr: "" };
      throw new Error("timed out");
    };
    h.editTurn("/r/a.ts");
    await expect(afterTurn(h.$)).rejects.toThrow(
      "not run: judge.sh did not finish: timed out",
    );
  });
});

describe("handing chosen findings to Claude", () => {
  test("only a submit that keeps the stem carries them, then they clear", async () => {
    const h = harness(FOUND);
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    expect((await h.submit("something else")).context).toBeUndefined();

    const s = (await h.slop())!;
    await h.$.state.set(
      { plugin: "hope", key: "slop" },
      decide({ ...s, reviewing: true }, { kind: "edit", note: "n" }),
    );
    expect((await h.submit("unrelated prompt")).context).toBeUndefined();

    const sent = await h.submit(`${FIX_STEM}but keep the null check`);
    expect(sent.context).toEqual([
      "Slop findings to fix:\n/r/a.ts:3 — wrong here. (rule)\n- old\n+ new\nThe person's edit, which wins over the change above: n",
    ]);
    expect((await h.slop())?.chosen).toEqual([]);
  });

  test("only a submit that keeps the addressed line tells Claude what accept wrote, then it clears", async () => {
    const h = harness(FOUND);
    h.editTurn("/r/a.ts");
    await afterTurn(h.$);
    const s = (await h.slop())!;
    await h.$.state.set(
      { plugin: "hope", key: "slop" },
      decide({ ...s, reviewing: true }, { kind: "accept", wrote: true }),
    );
    expect((await h.submit("unrelated prompt")).context).toBeUndefined();

    const sent = await h.submit(`ship it\n${ADDRESSED}`);
    expect(sent.context).toEqual([appliedNote(s.findings)]);
    expect((await h.slop())?.applied).toEqual([]);
  });
});

// ---- the review, drawn by the engine ----

/** The engine's session state for hope's slop, held here: `now()` reads it. */
function slopState(on: On, start: Slop) {
  let cur = { value: start as unknown, version: 1 };
  on("state.get", () => ({ value: cur }) as any);
  on("state.set", (_: unknown, e: any) => {
    if (e.ifVersion !== undefined && e.ifVersion !== cur.version)
      return { value: { isSet: false, version: cur.version } } as any;
    cur = { value: e.value, version: cur.version + 1 };
    return { value: { isSet: true, version: cur.version } } as any;
  });
  on("ui.close", () => ({ value: undefined }) as any);
  on("ui.invalidate", () => ({ value: undefined }) as any);
  on("ui.render", () => ({ type: "Box", props: {} }) as any);
  return () => cur.value as Slop;
}

/** The engine's prompt box, held here: `box()` reads it. */
function promptBox(on: On, draft = "") {
  let box = draft;
  on(
    "prompt.read",
    () => ({ value: { text: box, cursor: box.length } }) as any,
  );
  on("prompt.fill", (_: unknown, e: any) => {
    box = e.text;
    return { isFilled: true } as any;
  });
  return () => box;
}

/** The engine's files under the session root "/r", held here and written in place. */
function fileSystem(on: On, files: Record<string, string>) {
  on("session.root", () => ({ value: "/r" }) as any);
  on("fs.exists", (_: unknown, e: any) => ({ value: e.path in files }) as any);
  on("fs.read", (_: unknown, e: any) => ({ value: files[e.path] }) as any);
  on("fs.write", (_: unknown, e: any) => {
    files[e.path] = e.text;
    return { value: undefined } as any;
  });
  return files;
}
const waiting = (findings: Finding[]): Slop => ({
  findings,
  cursor: 0,
  marks: [],
  reviewing: true,
  editing: false,
  chosen: [],
  applied: [],
  seen: [],
  offset: 0,
  unjudged: [],
  hidden: [],
});
const settle = () => new Promise((r) => setTimeout(r, 10));
// The engine redraws on a state set; the state here is the test's, so the test redraws.

test("the review: the pane draws the finding under the cursor as one whole diff", async ($, on) => {
  slopState(
    on,
    waiting([F({ line: 3, before: ["x"], after: ["y"] }), F({ file: "b.ts" })]),
  );
  fileSystem(on, { "/r/a.ts": "a\nb\nx" });
  const pane = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "Pane",
    props: {} as any,
    requestId: "slop",
  });
  expect(await pane.findAll({ type: "Code" })).toHaveLength(1);
  expect(await pane.find({ type: "Text", text: "b.ts:1" })).toBeUndefined();
  expect(await pane.find({ type: "Text", text: MOVED })).toBeUndefined();
});

test("the review: the pane says when the file moved under the diff", async ($, on) => {
  slopState(on, waiting([F({ line: 3, before: ["x"], after: ["y"] })]));
  fileSystem(on, { "/r/a.ts": "a\nb\nx changed" });
  const pane = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "Pane",
    props: {} as any,
    requestId: "slop",
  });
  expect(await pane.findAll({ type: "Code" })).toHaveLength(1);
  expect(await pane.find({ type: "Text", text: MOVED })).toBeDefined();
});

test("the review: edit keeps the person's words for Claude; reject drops the last one", async ($, on) => {
  const now = slopState(on, waiting([F(), F({ file: "b.ts" })]));
  const box = promptBox(on);
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
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
  expect(box()).toBe(FIX_STEM);
});

test("the review: accept writes the change into the file and moves on", async ($, on) => {
  const now = slopState(
    on,
    waiting([F({ line: 2, before: ["b"], after: ["B"] }), F({ file: "b.ts" })]),
  );
  const files = fileSystem(on, { "/r/a.ts": "a\nb\nc" });
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  await row.press({ key: "slop-accept" });
  await settle();
  expect(files["/r/a.ts"]).toBe("a\nB\nc");
  expect(now().cursor).toBe(1);
});

test("the review: a review that wrote a change ends with the addressed line under the draft", async ($, on) => {
  const fixed = F({ line: 2, before: ["b"], after: ["B"] });
  const now = slopState(on, waiting([fixed]));
  const files = fileSystem(on, { "/r/a.ts": "a\nb\nc" });
  const box = promptBox(on, "keep going");
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  await row.press({ key: "slop-accept" });
  await settle();
  expect(files["/r/a.ts"]).toBe("a\nB\nc");
  expect(now().chosen).toEqual([]);
  expect(now().applied).toEqual([fixed]);
  expect(box()).toBe(`keep going\n${ADDRESSED}`);
});

test("the review: accept on lines the file no longer holds sends the finding to Claude", async ($, on) => {
  const moved = F({ line: 2, before: ["b"], after: ["B"] });
  const now = slopState(on, waiting([moved]));
  const files = fileSystem(on, { "/r/a.ts": "a\nb changed\nc" });
  const box = promptBox(on, "keep going");
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  await row.press({ key: "slop-accept" });
  await settle();
  expect(files["/r/a.ts"]).toBe("a\nb changed\nc");
  expect(now().findings).toEqual([]);
  expect(now().chosen).toEqual([{ finding: moved }]);
  expect(box()).toBe(FIX_STEM);
});

test("the review: accept on a file that is gone sends the finding to Claude", async ($, on) => {
  const gone = F({ line: 2, before: ["b"], after: ["B"] });
  const now = slopState(on, waiting([gone]));
  const files = fileSystem(on, {});
  promptBox(on);
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  await row.press({ key: "slop-accept" });
  await settle();
  expect(files).toEqual({});
  expect(now().chosen).toEqual([{ finding: gone }]);
});

/** hope's store, held here, refusing every write when given a refusal, and git saying the session root "/r" is the repo "/r/.git". */
function repoStore(
  on: On,
  entries: Record<string, unknown> = {},
  refusal?: string,
) {
  const store = new Map(Object.entries(entries));
  on("store.get", (_: unknown, e: any) => ({ value: store.get(e.key) }) as any);
  on("store.set", (_: unknown, e: any) => {
    if (refusal) throw new Error(refusal);
    store.set(e.key, e.value);
    return { value: undefined } as any;
  });
  on("store.delete", (_: unknown, e: any) => {
    store.delete(e.key);
    return { value: undefined } as any;
  });
  on("store.keys", () => ({ value: [...store.keys()] }) as any);
  on(
    "process.run",
    () =>
      ({
        value: { exitCode: 0, stdout: "/r/.git\n/r\n", stderr: "" },
      }) as any,
  );
  return store;
}

test("the review: reject stores the finding for the repo, its file relative to the repo", async ($, on) => {
  const rejected = F({ file: "/r/a.ts", line: 2 });
  slopState(on, waiting([rejected]));
  fileSystem(on, {});
  const store = repoStore(on);
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  await row.press({ key: "slop-reject" });
  await settle();
  expect(store.get(`${REJECTS}/r/.git`)).toEqual([
    { ...rejected, file: "a.ts" },
  ]);
});

test("the review: a reject the store refuses shows once and keeps the review going", async ($, on) => {
  const now = slopState(on, waiting([F(), F({ file: "b.ts" })]));
  fileSystem(on, {});
  promptBox(on);
  repoStore(on, {}, "over the limit");
  const toasts: string[] = [];
  on("ui.toast", (_: unknown, e: any) => {
    toasts.push(e.text);
    return { value: undefined } as any;
  });
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  await row.press({ key: "slop-reject" });
  await settle();
  await row.redraw();
  await row.press({ key: "slop-reject" });
  await settle();
  expect(now().findings).toEqual([]);
  expect(toasts.length).toBe(1);
  expect(toasts[0]).toStartWith(
    "hope slop: a reject could not be stored, so it lasts this session only:",
  );
});

test("the row: hidden repeats wait behind a count, and its pane lists each with the reject it repeats", async ($, on) => {
  const repeats = F({ rule: "no var", claim: "var again." });
  slopState(on, {
    ...waiting([]),
    reviewing: false,
    hidden: [{ finding: F({ claim: "uses var." }), repeats, by: "pick" }],
  } as Slop);
  const row = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false } as any,
  });
  expect(await row.find({ type: "Button", key: "slop-open" })).toBeUndefined();
  expect(
    (await row.find({ type: "Button", key: "slop-hidden" }))?.props.label,
  ).toBe("1 hidden");
  const pane = await $.ui.mount({
    plugin: "hope",
    surface: "terminal",
    component: "Pane",
    props: {} as any,
    requestId: "slop-hidden",
  });
  expect(
    await pane.find({
      type: "Text",
      text: "the model matched it to your reject: no var — var again.",
    }),
  ).toBeDefined();
});

test("/forget-slop-rejects forgets the repo's rejects and this session's, keeping what still waits", async ($, on) => {
  const waits = F({ file: "w.ts" });
  const now = slopState(on, {
    ...waiting([F(), waits]),
    cursor: 1,
    marks: [{ kind: "reject" }],
    hidden: [{ finding: F(), repeats: F(), by: "rule" }],
    seen: [findingKey(F())!, findingKey(waits)!, "error|x"],
  } as Slop);
  fileSystem(on, {});
  const store = repoStore(on, { [`${REJECTS}/r/.git`]: [F()] });
  const { text } = await $.command.run({
    ...fixSlops,
    command: FORGET_REJECTS,
  });
  expect(text).toBe("Forgot 1 rejected slop findings in /r.");
  expect(store.size).toBe(0);
  expect(now().hidden).toEqual([]);
  expect(now().seen).toEqual([findingKey(waits)!, "error|x"]);
});

/** /fix-slops as the person types it at the terminal. */
const fixSlops = {
  command: FIX_SLOPS,
  args: "",
  origin: { kind: "composer" },
  presentation: { isFullscreen: false, columns: 80 },
} as const;

test("/fix-slops writes every waiting finding it can, hands the rest to Claude and clears the row", async ($, on) => {
  const first = F({ line: 1, before: ["a"], after: ["A"] });
  const second = F({ line: 3, before: ["c"], after: ["C"] });
  const moved = F({ file: "b.ts", before: ["z"], after: ["Z"] });
  const now = slopState(on, {
    ...waiting([F({ file: "r.ts" }), first, second, moved]),
    cursor: 1,
    marks: [{ kind: "reject" }],
  });
  const files = fileSystem(on, { "/r/a.ts": "a\nb\nc", "/r/b.ts": "q" });
  const box = promptBox(on);
  const { text } = await $.command.run(fixSlops);
  expect(text).toBe(
    fixReport([
      { finding: first, wrote: true },
      { finding: second, wrote: true },
      { finding: moved, wrote: false },
    ]),
  );
  expect(files).toEqual({ "/r/a.ts": "A\nb\nC", "/r/b.ts": "q" });
  expect(now().findings).toEqual([]);
  expect(now().applied).toEqual([first, second]);
  expect(now().chosen).toEqual([{ finding: moved }]);
  expect(box()).toBe(addressed(FIX_STEM));
});

test("/fix-slops with nothing waiting says so", async ($, on) => {
  slopState(on, waiting([]));
  expect((await $.command.run(fixSlops)).text).toBe(NONE);
});
