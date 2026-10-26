import { describe, expect, test } from "claude-code/testing";
import {
  approvalQuestion,
  parse,
  parseApprovalQuestion,
  render,
  total,
  type FactoryComment,
} from "./formats.ts";
import { BG_RUN_DENIED_ASK, LIMIT_REJECTED } from "./fixtures/transcripts.ts";
import { issueOf, latest, type Comment } from "./github.ts";
import { cutToFailures, isTestCommand } from "./logs.ts";
import { overlap, planFiles, planGaps } from "./plan.ts";
import { answerIds, answerMessage, answerTo, approvedSeal, openWait } from "./wait.ts";
import { parseRules } from "./rules.ts";
import { contextSize, pendingAsk, rejectedUntil, usage } from "./transcript.ts";

const Q = { question: "Which store?", why: "Both fit --> pick one", options: ["Map", "Array"] };

describe("formats", () => {
  const every: FactoryComment[] = [
    {
      kind: "plan",
      issue: 7,
      seal: "a".repeat(64),
      approved: null,
      text: "## Types\nT --> U\n\n## Files\n- a.ts",
    },
    {
      kind: "call",
      issue: 7,
      choice: "where `--` lives",
      picked: "in a.ts -->",
      undo: "move it",
    },
    { kind: "wait", issue: 7, questions: [Q], answers: null },
    { kind: "wait", issue: 7, questions: [Q], answers: ["Map"] },
    { kind: "handoff", issue: 7, text: "Done: a.\nLeft: b." },
    {
      kind: "cost",
      issue: 7,
      pr: 9,
      sessions: ["s1", "s2"],
      input: 1,
      cacheRead: 2,
      cacheWrite: 3,
      output: 4,
    },
    { kind: "restart", issue: 7, reason: "crash", session: "s1" },
    { kind: "stuck", issue: 7, reason: "two fixes failed" },
    { kind: "answer", issue: 7, wait: 101, answers: ["Map"] },
  ];

  test("every kind parses back to itself, `-->` in a field included", () => {
    for (const c of every) expect(parse(render(c))).toEqual(c);
  });
  test("anyone else's comment is not a factory comment", () => {
    expect(parse("looks good to me")).toBe(null);
    expect(parse("<!-- factory:nope {} -->\nx")).toBe(null);
    expect(parse("<!-- factory:call {not json} -->\nx")).toBe(null);
  });
  test("a person reads the plan's state without the marker", () => {
    const body = render(every[0]!);
    expect(body.split("\n")[1]).toBe(
      "**Plan** · seal `aaaaaaaa` · waiting for approval",
    );
  });
  test("cost totals every kind of token", () => {
    expect(
      total({ kind: "cost", issue: 7, pr: 9, sessions: [], input: 1, cacheRead: 2, cacheWrite: 3, output: 4 }),
    ).toBe(10);
  });
  test("the approval question names its seal and issue, and nothing else parses as one", () => {
    const q = approvalQuestion(42, "0123456789abcdef");
    expect(q).toBe("Approve plan 01234567 for #42?");
    expect(parseApprovalQuestion(q)).toEqual({ issue: 42, seal8: "01234567" });
    expect(parseApprovalQuestion("Approve the plan?")).toBe(null);
  });
  test("latest finds the newest comment of a kind among people's comments", () => {
    const cs: Comment[] = [
      { id: 1, body: render(every[2]!), author: "u", createdAt: "" },
      { id: 2, body: "a note", author: "u", createdAt: "" },
      { id: 3, body: render(every[3]!), author: "u", createdAt: "" },
    ];

    expect(latest(cs, "wait")).toEqual({ id: 3, c: every[3]! });
    expect(latest(cs, "plan")).toBe(null);
  });
});

describe("branches", () => {
  test("only factory/<n> names an issue", () => {
    expect(issueOf("factory/12\n")).toBe(12);
    expect(issueOf("factory/x")).toBe(null);
    expect(issueOf("main")).toBe(null);
  });
});

describe("plan", () => {
  const full =
    "## Types\ntype A = 1\n\n## Signatures\nf(a: A): void\n\n## Files\n- `src/a.ts` — new\n- src/b.ts\n";

  test("a plan with every section filled passes", () => {
    expect(planGaps(full)).toEqual([]);
    expect(planFiles(full)).toEqual(["src/a.ts", "src/b.ts"]);
  });
  test("a missing or empty section is named", () => {
    expect(planGaps("## Types\nx\n\n## Signatures\n\n")).toEqual([
      "Signatures",
      "Files",
    ]);
    expect(
      planGaps("## Types\nx\n## Signatures\ny\n## Files\nsome files"),
    ).toEqual(["Files (no `- path` lines)"]);
  });
  test("overlap is the paths both name", () => {
    expect(overlap(["a", "b", "b"], ["b", "c"])).toEqual(["b"]);
  });
});

describe("transcript", () => {
  test("tokens count once per message, though a message spans several lines", () => {
    expect(usage(BG_RUN_DENIED_ASK)).toEqual({
      input: 6,
      cacheRead: 112118,
      cacheWrite: 33211,
      output: 1126,
    });
  });
  test("context is what the newest message read", () => {
    expect(contextSize(BG_RUN_DENIED_ASK)).toBeGreaterThan(48000);
    expect(contextSize("")).toBe(0);
  });
  test("an answered or refused ask is not pending; one with no result is", () => {
    expect(pendingAsk(BG_RUN_DENIED_ASK)).toBe(false);

    const unanswered = BG_RUN_DENIED_ASK.split("\n")
      .filter(
        (l) => !l.includes('"tool_result"') || !l.includes("FACTORYPROBE"),
      )
      .join("\n");

    expect(pendingAsk(unanswered)).toBe(true);
  });
  test("a limit refusal gives its reset time; a later report that isn't a refusal clears it", () => {
    expect(rejectedUntil(LIMIT_REJECTED)).toBe(1791388800);
    expect(rejectedUntil(BG_RUN_DENIED_ASK)).toBe(null);

    const allowed = JSON.stringify({
      type: "assistant",
      quotaLimits: { status: "allowed", resetsAt: 1 },
    });

    expect(rejectedUntil(`${LIMIT_REJECTED}\n${allowed}`)).toBe(null);
  });
  test("a line cut off mid-write is skipped", () => {
    expect(usage(`${BG_RUN_DENIED_ASK}\n{"type":"assis`)).toEqual(
      usage(BG_RUN_DENIED_ASK),
    );
  });
});

describe("logs", () => {
  test("test commands are told apart", () => {
    expect(isTestCommand("cd x && bun test src")).toBe(true);
    expect(isTestCommand("npm run test -- --watch=false")).toBe(true);
    expect(isTestCommand("git log --grep test")).toBe(false);
  });
  test("long output keeps failures, their neighbours and the summary", () => {
    const pass = Array.from({ length: 200 }, (_, i) => `(pass) case ${i}`);
    pass[100] = "(fail) case 100: expected 1, received 2";

    const out = cutToFailures([...pass, "199 pass", "1 fail"].join("\n")).split(
      "\n",
    );

    expect(out).toContain("(fail) case 100: expected 1, received 2");
    expect(out).toContain("1 fail");
    expect(out.length).toBeLessThan(40);
    expect(out[0]).toBe("… 97 passing lines cut by the factory …");
  });
  test("short output, or long output with no failure, stays whole", () => {
    expect(cutToFailures("a\nb")).toBe("a\nb");
    const ok = Array.from({ length: 200 }, (_, i) => `(pass) ${i}`).join("\n");
    expect(cutToFailures(ok)).toBe(ok);
  });
});

describe("rules", () => {
  const good = {
    atOnce: 2,
    waitsPerDay: 5,
    contextCap: 400000,
    taste: ["CLAUDE.md"],
    layers: {
      check: ["tsc strict"],
      plan: ["no classes"],
      judge: ["names read well"],
      none: [],
    },
  };

  test("a full rules file reads", () => {
    expect(parseRules(JSON.stringify(good))).toEqual(good);
  });
  test("every wrong field is named", () => {
    const bad = parseRules(
      JSON.stringify({ ...good, atOnce: 0, layers: { check: [] } }),
    );

    expect(bad).toEqual({
      errors: [
        "atOnce must be a whole number of 1 or more",
        "layers.plan must be a list of strings",
        "layers.judge must be a list of strings",
        "layers.none must be a list of strings",
      ],
    });
    expect("errors" in parseRules("{")).toBe(true);
  });
});

describe("wait", () => {
  const wait = (id: number, answers: string[] | null): Comment => ({
    id,
    body: render({ kind: "wait", issue: 7, questions: [Q], answers }),
    author: "bot",
    createdAt: "",
  });

  const note = (id: number, body: string, author = "you"): Comment => ({ id, body, author, createdAt: "" });
  const all = () => true;

  test("only the newest unanswered wait is open", () => {
    expect(openWait([wait(1, null)])?.id).toBe(1);
    expect(openWait([wait(1, null), wait(2, ["Map"])])).toBe(null);
    expect(openWait([note(1, "hi")])).toBe(null);
  });
  test("an answer comment naming the wait answers it, question by question", () => {
    const cs = [wait(1, null), note(2, render({ kind: "answer", issue: 7, wait: 1, answers: ["Array"] }))];
    expect(answerTo(cs, 1, 1, all)).toEqual({ id: 2, author: "you", answers: ["Array"] });
  });
  test("a plain comment answers every question with its text; one before the wait never does", () => {
    const cs = [note(1, "earlier"), wait(2, null), note(3, " Map \n")];
    expect(answerTo(cs, 2, 2, all)).toEqual({ id: 3, author: "you", answers: ["Map", "Map"] });
  });
  test("an answer from someone who can't push is passed over", () => {
    const cs = [wait(1, null), note(2, "Array", "stranger"), note(3, "Map", "owner")];
    expect(answerTo(cs, 1, 1, (l) => l === "owner")?.answers).toEqual(["Map"]);
    expect(answerTo([wait(1, null), note(2, "x", "stranger")], 1, 1, (l) => l === "owner")).toBe(null);
  });
  test("Approve to the approval question approves its seal; anything else approves nothing", () => {
    const w = { kind: "wait" as const, issue: 7, questions: [Q, { question: "Approve plan 01234567 for #7?", why: "", options: ["Approve", "Change"] }], answers: null };
    expect(approvedSeal(w, ["Map", " approve "])).toBe("01234567");
    expect(approvedSeal(w, ["Map", "Change"])).toBe(null);
    expect(approvedSeal({ ...w, questions: [Q] }, ["Approve"])).toBe(null);
  });
  test("the run reads each question with its answer", () => {
    expect(answerMessage({ kind: "wait", issue: 7, questions: [Q], answers: null }, ["Map"])).toContain("- Which store?\n  Answer: Map");
  });
  test("comments that answered a wait are known, so they never come back as notes", () => {
    expect([...answerIds([wait(1, ["Map"]), note(2, "Map"), note(3, "later")])]).toEqual([2]);
  });
});
