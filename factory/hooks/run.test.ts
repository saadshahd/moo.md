import { describe, expect, test } from "claude-code/testing";
import { parse, render, type FactoryComment } from "../lib/formats.ts";
import { newestNote, register } from "./run.ts";

const RULES = JSON.stringify({
  atOnce: 1,
  waitsPerDay: 1,
  contextCap: 1000,
  taste: [],
  layers: { check: [], plan: [], judge: [], none: [] },
});

const SEAL = "0123456789abcdef".repeat(4);

/** A fake host: one session in `branch`, the issue's comments held here as GitHub would. */
function harness(branch: string, startedAt = 0, rules = RULES) {
  const handlers: { match?: { tool: string }; fn: (...a: any[]) => any }[] = [];

  const on = (...args: any[]) =>
    handlers.push({
      match: args.length === 3 ? args[1] : undefined,
      fn: args.at(-1),
    });

  // SAFETY: the fake `on` takes every registration the module makes; options are unused.
  register(on as any, {} as any);

  const store = new Map<string, string | number>();

  const github: {
    id: number;
    body: string;
    author: string;
    createdAt: string;
  }[] = [];

  let nextId = 100;
  const toasts: string[] = [];

  const $ = {
    session: {
      cwd: async () => "/w",
      id: async () => "s1",
      usage: async () => ({ startedAt }),
    },
    store: {
      get: async (k: string) => store.get(k),
      set: async (k: string, v: string | number) => void store.set(k, v),
    },
    ui: { toast: (t: string) => toasts.push(t) },
    process: {
      run: async (argv: string[], init?: { stdin?: string }) => {
        const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: "" });

        if (argv[0] === "git") return ok(`${branch}\n`);

        if (argv[0] === "cat") return ok(rules);

        if (argv[1] === "repo") return ok("o/r\n");

        if (argv.includes("--paginate"))
          return ok(github.map((c) => JSON.stringify(c)).join("\n"));

        if (argv.includes("PATCH")) {
          const id = Number(
            argv
              .find((a) => a.includes("/comments/"))!
              .split("/")
              .at(-1),
          );

          github.find((c) => c.id === id)!.body = JSON.parse(init!.stdin!).body;

          return ok("");
        }

        const id = nextId++;
        github.push({
          id,
          body: JSON.parse(init!.stdin!).body,
          author: "me",
          createdAt: new Date().toISOString(),
        });

        return ok(`${id}\n`);
      },
    },
  };

  const fire = (e: any, core: () => any) => {
    const chain = handlers.filter((h) => !h.match || h.match.tool === e.tool);

    const call = (i: number, ev: any): any =>
      i === chain.length
        ? Promise.resolve(core())
        : chain[i]!.fn($, ev, (x: any) => call(i + 1, x));

    return call(0, e);
  };

  const said = () =>
    github.flatMap((c) => {
      const p = parse(c.body);

      return p ? [p] : [];
    });

  const say = (c: FactoryComment) =>
    github.push({ id: nextId++, body: render(c), author: "me", createdAt: "" });

  const note = (body: string, createdAt: string) =>
    github.push({ id: nextId++, body, author: "you", createdAt });

  return { fire, said, say, note, store, toasts };
}

const ask = (question: string) => ({
  tool: "AskUserQuestion",
  questions: [{ question, header: "Q", options: [], multiSelect: false }],
});

const answered = (question: string, answer: string) => () => ({
  result: { questions: [], answers: { [question]: answer } },
  text: `answered`,
});

describe("outside a factory run", () => {
  test("every hook passes its event straight on and writes nothing", async () => {
    const h = harness("main");
    const r = await h.fire(ask("Which?"), answered("Which?", "A"));
    expect(r.result.answers).toEqual({ "Which?": "A" });
    expect(h.said()).toEqual([]);
  });
});

describe("ask", () => {
  test("under the cap an ask waits, posted on the issue, then shows the answer", async () => {
    const h = harness("factory/7");
    await h.fire(ask("Which?"), answered("Which?", "A"));
    expect(h.said()).toEqual([
      { kind: "wait", issue: 7, question: "Which?", answer: "A" },
    ]);
  });
  test("past the cap the run takes its own pick, and nothing waits", async () => {
    const h = harness("factory/7");
    await h.fire(ask("One?"), answered("One?", "A"));

    const r = await h.fire(ask("Two?"), () => {
      throw new Error("the ask must not reach the human");
    });

    expect(r.deny).toContain("post it as a call");
    expect(h.said().length).toBe(1);
  });
  test("approving the plan always waits and seals the approval on the plan comment", async () => {
    const h = harness("factory/7");
    h.say({ kind: "plan", issue: 7, seal: SEAL, approved: null, text: "p" });
    await h.fire(ask("One?"), answered("One?", "A"));
    const q = "Approve plan 01234567 for #7?";
    await h.fire(ask(q), answered(q, "Approve"));
    expect(h.said().find((c) => c.kind === "plan")).toEqual({
      kind: "plan",
      issue: 7,
      seal: SEAL,
      approved: SEAL,
      text: "p",
    });
  });
  test("an approval for another seal approves nothing", async () => {
    const h = harness("factory/7");
    h.say({ kind: "plan", issue: 7, seal: SEAL, approved: null, text: "p" });
    const q = "Approve plan ffffffff for #7?";
    await h.fire(ask(q), answered(q, "Approve"));
    expect(h.said().find((c) => c.kind === "plan")).toMatchObject({
      approved: null,
    });
  });
});

describe("seal", () => {
  test("an edit to the approved plan revokes it and tells the agent", async () => {
    const h = harness("factory/7");
    h.say({ kind: "plan", issue: 7, seal: SEAL, approved: SEAL, text: "p" });

    const r = await h.fire(
      { tool: "Edit", file_path: "/w/.factory/plan.md" },
      () => ({ result: {} }),
    );

    expect(h.said().find((c) => c.kind === "plan")).toMatchObject({
      approved: null,
    });
    expect(r.context.join("\n")).toContain("approval is revoked");
  });
  test("an edit elsewhere leaves the approval alone", async () => {
    const h = harness("factory/7");
    h.say({ kind: "plan", issue: 7, seal: SEAL, approved: SEAL, text: "p" });
    await h.fire({ tool: "Edit", file_path: "/w/src/a.ts" }, () => ({
      result: {},
    }));
    expect(h.said().find((c) => c.kind === "plan")).toMatchObject({
      approved: SEAL,
    });
  });
});

describe("notes", () => {
  test("the newest comment a person left reaches the agent once, at most once a minute", async () => {
    const h = harness("factory/7", Date.parse("2026-10-26T10:00:00Z"));
    h.note("before the run", "2026-10-26T09:00:00Z");
    h.note("use the old API", "2026-10-26T10:05:00Z");

    const r1 = await h.fire({ tool: "Read", file_path: "/w/a" }, () => ({
      result: {},
    }));

    expect(r1.context[0]).toContain("use the old API");
    h.note("and keep it small", "2026-10-26T10:06:00Z");

    const r2 = await h.fire({ tool: "Read", file_path: "/w/a" }, () => ({
      result: {},
    }));

    expect(r2.context).toBe(undefined);
    h.store.set("notes:at:s1", 0);

    const r3 = await h.fire({ tool: "Read", file_path: "/w/a" }, () => ({
      result: {},
    }));

    expect(r3.context[0]).toContain("and keep it small");
    h.store.set("notes:at:s1", 0);

    const r4 = await h.fire({ tool: "Read", file_path: "/w/a" }, () => ({
      result: {},
    }));

    expect(r4.context).toBe(undefined);
  });
  test("the factory's own comments are never notes", () => {
    const cs = [
      {
        id: 1,
        body: render({ kind: "stuck", issue: 1, reason: "x" }),
        author: "me",
        createdAt: "2026-10-26T10:00:00Z",
      },
    ];

    expect(newestNote(cs, 0, 0)).toBe(null);
  });
});

describe("logs", () => {
  test("a long failing test run reaches the agent cut to its failures", async () => {
    const h = harness("factory/7");
    const lines = Array.from({ length: 200 }, (_, i) => `(pass) ${i}`);
    lines[50] = "(fail) 50: expected 1";

    const r = await h.fire({ tool: "Bash", command: "bun test" }, () => ({
      result: "Exit code 1",
      text: lines.join("\n"),
      isError: true,
    }));

    expect(r.deny).toContain("(fail) 50: expected 1");
    expect(r.deny.split("\n").length).toBeLessThan(40);
  });
  test("a command that runs no tests is left whole", async () => {
    const h = harness("factory/7");
    const out = Array.from({ length: 200 }, () => "error").join("\n");

    const r = await h.fire({ tool: "Bash", command: "cat big.log" }, () => ({
      result: { stdout: out, stderr: "" },
      text: out,
    }));

    expect(r.text).toBe(out);
    expect(r.deny).toBe(undefined);
  });
});

describe("failures", () => {
  test("a broken rules file shows once and the ask goes on", async () => {
    const h = harness("factory/7", 0, "{");
    const r = await h.fire(ask("Which?"), answered("Which?", "A"));
    expect(r.result.answers["Which?"]).toBe("A");
    expect(h.toasts.length).toBeGreaterThan(0);
    expect(h.toasts[0]).toContain("not JSON");
    expect(h.said()).toEqual([]);
  });
});
