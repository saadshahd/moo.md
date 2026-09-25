import { describe, expect, test } from "claude-code/testing";
import {
  FIX_STEM,
  afterTurn,
  decide,
  findingKey,
  freshFindings,
  handoff,
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

describe("decide", () => {
  const a = F();
  const b = F({ file: "b.ts" });
  const s: Slop = { findings: [a, b], cursor: 0, marks: [], reviewing: true, chosen: [], seen: [], offset: 0 };
  test("a decision before the last moves the cursor and keeps the mark", () => {
    expect(decide(s, "fix")).toEqual({ ...s, cursor: 1, marks: ["fix"] });
  });
  test("the last decision ends the review with the fixes chosen", () => {
    expect(decide(decide(s, "skip"), "fix")).toEqual({ ...s, findings: [], cursor: 0, marks: [], reviewing: false, chosen: [b] });
  });
  test("a fixed finding's key is forgotten, a skipped one's kept", () => {
    const seen = [findingKey(a)!, findingKey(b)!];
    expect(decide(decide({ ...s, seen }, "skip"), "fix").seen).toEqual([findingKey(a)]);
  });
  test("with nothing under the cursor nothing changes", () => {
    const empty = { ...s, findings: [] };
    expect(decide(empty, "fix")).toEqual(empty);
  });
});

describe("handoff", () => {
  test("each finding located, with its suggested change", () => {
    expect(handoff([F({ line: 3, before: ["x"], after: ["y"] }), { rule: "", claim: "odd", before: [], after: [] }])).toBe(
      "Slop findings to fix:\na.ts:3 — c (rule)\n- x\n+ y\nodd",
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
    await h.$.state.set({ plugin: "hope", key: "slop" }, decide({ ...s, reviewing: true }, "fix"));
    expect((await h.submit("unrelated prompt")).context).toBeUndefined();

    const sent = await h.submit(`${FIX_STEM}but keep the null check`);
    expect(sent.context).toEqual([
      "Slop findings to fix:\n/r/a.ts:3 — wrong here. (rule)\n- old\n+ new",
    ]);
    expect((await h.slop())?.chosen).toEqual([]);
  });
});
