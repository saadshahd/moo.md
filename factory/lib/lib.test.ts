import { describe, expect, test } from "claude-code/testing";
import { botEnv, needsRenew, RENEW_BEFORE_MS, type Bot } from "./bot.ts";
import {
  parse,
  render,
  total,
  WHY_MAX,
  BODY_MAX,
  type Call,
  type FactoryComment,
  type Wait,
} from "./formats.ts";
import { BG_RUN_DENIED_ASK, LIMIT_REJECTED } from "./fixtures/transcripts.ts";
import {
  factoryComments,
  issueOf,
  latest,
  wroteIt,
  type Actors,
  type Comment,
} from "./github.ts";
import { cutToFailures, isTestCommand } from "./logs.ts";
import { overlap, planFiles, planGaps, planText } from "./plan.ts";
import { actorsOf, parseRules } from "./rules.ts";
import { undone, type Snapshot } from "./snapshot.ts";
import { contextSize, pendingAsk, rejectedUntil, usage } from "./transcript.ts";
import {
  APPROVAL_QUESTION,
  answerFor,
  answerMessage,
  answerTo,
  approved,
  notes,
  openWait,
} from "./wait.ts";

const SEAL = "a".repeat(64);
const BOT = "moo-factory[bot]";
const ME = "owner";
const A: Actors = { bot: BOT, trusted: [ME] };

const Q = {
  question: "Which store?",
  why: "Both fit --> pick one",
  options: ["Map", "Array"],
};

const APPROVAL = {
  question: APPROVAL_QUESTION,
  why: "the plan",
  options: ["Approve", "Change"],
};

const comment = (
  id: number,
  body: string,
  author: string | null = ME,
  editor: string | null = null,
): Comment => ({ id, body, author, editor, createdAt: "", url: `u${id}` });

const bot = (id: number, c: FactoryComment) => comment(id, render(c), BOT);

const wait = (questions = [Q], approves: string | null = null): Wait => ({
  kind: "wait",
  issue: 7,
  questions,
  approves,
  answers: null,
});

const CALL: Call = {
  kind: "call",
  issue: 7,
  choice: "where `--` lives",
  picked: "in a.ts -->",
  others: ["in b.ts"],
  why: "a.ts already parses\n\nand b.ts does not",
  undo: "move it",
};

describe("formats", () => {
  const every: FactoryComment[] = [
    {
      kind: "plan",
      issue: 7,
      seal: SEAL,
      text: "## Types\nT --> U\n\n## Files\n- a.ts",
    },
    CALL,
    wait(),
    { ...wait([Q, APPROVAL], SEAL), answers: ["Map", "Approve"] },
    { kind: "answer", issue: 7, wait: 101, answers: ["Map"], approves: null },
    { kind: "handoff", issue: 7, text: "Done: a.\n\nLeft: b." },
    {
      kind: "cost",
      issue: 7,
      pr: 9,
      sessions: ["s1"],
      input: 1,
      cacheRead: 2,
      cacheWrite: 3,
      output: 4,
    },
    { kind: "restart", issue: 7, reason: "crash", session: "s1" },
    { kind: "stuck", issue: 7, reason: "two fixes failed" },
    { kind: "undo", call: 55, text: "Picked: x\n\nTo undo: y" },
  ];

  test("every kind parses back to itself, `-->` and blank lines in a field included", () => {
    for (const c of every) expect(parse(render(c))).toEqual(c);
  });
  test("a heading is one paragraph, so long text starts after the first blank line", () => {
    const c = {
      ...CALL,
      choice: "a\n\nb",
    };

    expect(render(c)).not.toContain("a\n\nb");
    expect(parse(render(c))).toEqual(c);
  });
  test("a browser edit's CRLF line endings read as LF", () => {
    expect(parse(render(every[0]!).replace(/\n/g, "\r\n"))).toEqual(every[0]!);
  });
  test("a marker whose fields break its kind's schema is no factory comment", () => {
    expect(parse("looks good to me")).toBe(null);
    expect(parse("<!-- factory:nope {} -->\nx")).toBe(null);
    expect(parse("<!-- factory:call {not json} -->\nx")).toBe(null);
    expect(parse('<!-- factory:call {"issue":5} -->\nx')).toBe(null);
    expect(
      parse(`<!-- factory:plan {"issue":5,"seal":"short"} -->\nx\n\ny`),
    ).toBe(null);
  });
  test("a why past the cap is never posted", () => {
    expect(() =>
      render({
        ...CALL,
        why: "x".repeat(WHY_MAX + 1),
      }),
    ).toThrow();
  });
  test("a comment past GitHub's body limit is never posted", () => {
    expect(() =>
      render({ kind: "handoff", issue: 7, text: "x".repeat(BODY_MAX) }),
    ).toThrow("over GitHub's 65536");
  });
  test("a call shows what it passed over; its why rides once, below", () => {
    const body = render(CALL);
    expect(body).toContain("Picked: in a.ts --> (not in b.ts)");
    expect(body.split("a.ts already parses").length).toBe(2);
  });
  test("cost totals every kind of token", () => {
    expect(
      total({
        kind: "cost",
        issue: 7,
        pr: 9,
        sessions: [],
        input: 1,
        cacheRead: 2,
        cacheWrite: 3,
        output: 4,
      }),
    ).toBe(10);
  });
});

describe("authors", () => {
  const plan: FactoryComment = {
    kind: "plan",
    issue: 7,
    seal: SEAL,
    text: "x",
  };

  const answer: FactoryComment = {
    kind: "answer",
    issue: 7,
    wait: 1,
    answers: ["a"],
    approves: null,
  };

  test("a comment counts only when written, and last edited, by the logins named", () => {
    expect(wroteIt(comment(1, ""), [ME])).toBe(true);
    expect(wroteIt(comment(1, "", ME, ME), [ME])).toBe(true);
    expect(wroteIt(comment(1, "", ME, BOT), [ME])).toBe(false);
    expect(wroteIt(comment(1, "", null), [ME])).toBe(false);
  });
  test("bot kinds count only from the bot, a person's kinds only from the trusted", () => {
    const cs = [
      comment(1, render(plan), ME),
      comment(2, render(plan), "stranger"),
      bot(3, plan),
      bot(4, answer),
      comment(5, render(answer), "stranger"),
      comment(6, render(answer), ME),
    ];

    expect(factoryComments(cs, A).map((x) => x.id)).toEqual([3, 6]);
    expect(latest(cs, A, "plan")?.id).toBe(3);
  });
});

describe("branches", () => {
  test("only factory/<n> names an issue", () => {
    expect(issueOf("factory/12\n")).toBe(12);
    expect(issueOf("factory/x")).toBe(null);
    expect(issueOf("main")).toBe(null);
  });
});

describe("wait", () => {
  const answerComment = (
    id: number,
    waitId: number,
    answers: string[],
    approves: string | null = null,
    author = ME,
  ) =>
    comment(
      id,
      render({ kind: "answer", issue: 7, wait: waitId, answers, approves }),
      author,
    );

  test("only the bot's newest unanswered wait is open", () => {
    expect(openWait([bot(1, wait())], A)?.id).toBe(1);
    expect(
      openWait([bot(1, wait()), bot(2, { ...wait(), answers: ["Map"] })], A),
    ).toBe(null);
    expect(openWait([comment(1, render(wait()))], A)).toBe(null);
  });
  test("an answer comment naming the wait answers it, question by question", () => {
    const cs = [bot(1, wait()), answerComment(2, 1, ["Array"])];
    expect(answerTo(cs, A, { id: 1, c: wait() })).toEqual({
      id: 2,
      answers: ["Array"],
      approves: null,
    });
  });
  test("a plain comment answers a one-question wait; one before the wait never does", () => {
    const cs = [comment(1, "earlier"), bot(2, wait()), comment(3, " Map \n")];
    expect(answerTo(cs, A, { id: 2, c: wait() })).toEqual({
      id: 3,
      answers: ["Map"],
      approves: null,
    });
  });
  test("a plain comment answers no wait of several questions, and no approval", () => {
    const two = wait([Q, Q]);
    expect(
      answerTo([bot(1, two), comment(2, "Map")], A, { id: 1, c: two }),
    ).toBe(null);
    const asks = wait([APPROVAL], SEAL);
    expect(
      answerTo([bot(1, asks), comment(2, "Approve")], A, { id: 1, c: asks }),
    ).toBe(null);
  });
  test("an answer from a stranger, or one the bot edited, is passed over", () => {
    const cs = [
      bot(1, wait()),
      comment(2, "Array", "stranger"),
      comment(3, "Array", ME, BOT),
      comment(4, "Map"),
    ];

    expect(answerTo(cs, A, { id: 1, c: wait() })?.answers).toEqual(["Map"]);
  });
  test("Approve on the approval question approves the wait's seal; anything else approves nothing", () => {
    const w = wait([Q, APPROVAL], SEAL);
    expect(answerFor(9, w, ["Map", " approve "]).approves).toBe(SEAL);
    expect(answerFor(9, w, ["Map", "Change"]).approves).toBe(null);
    expect(answerFor(9, wait(), ["Approve"]).approves).toBe(null);
  });
  test("a seal stands approved only by a trusted answer naming it", () => {
    expect(approved([answerComment(2, 1, ["Approve"], SEAL)], A, SEAL)).toBe(
      true,
    );
    expect(
      approved([answerComment(2, 1, ["Approve"], SEAL, "stranger")], A, SEAL),
    ).toBe(false);
    expect(
      approved([answerComment(2, 1, ["Approve"], SEAL)], A, "b".repeat(64)),
    ).toBe(false);
    expect(
      approved(
        [bot(2, { ...wait([APPROVAL], SEAL), answers: ["Approve"] })],
        A,
        SEAL,
      ),
    ).toBe(false);
  });
  test("the run reads each question with its answer", () => {
    expect(answerMessage(wait(), ["Map"])).toContain(
      "- Which store?\n  Answer: Map",
    );
  });
  test("notes are trusted people's words that answer no wait", () => {
    const cs = [
      comment(1, "first"),
      bot(2, wait()),
      comment(3, "Map"),
      comment(4, "later"),
      comment(5, "hi", "stranger"),
    ];

    expect(notes(cs, A).map((c) => c.id)).toEqual([1, 4]);
  });
});

describe("plan", () => {
  const full =
    "## Types\ntype A = 1\n\n## Signatures\nf(a: A): void\n\n## Files\n- `src/a.ts` — new\n- src/b.ts\n";

  test("a plan with every section filled passes", () => {
    expect(planGaps(full)).toEqual([]);
    expect(planFiles(full)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(planGaps(full.replace(/\n/g, "\r\n"))).toEqual([]);
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
  test("plan text drops CRLF and outer blank lines", () => {
    expect(planText("\r\n## Types\r\nx\r\n\r\n")).toBe("## Types\nx");
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
  test("a limit refusal gives its reset time only while it is the session's last reply", () => {
    expect(rejectedUntil(LIMIT_REJECTED)).toBe(1791388800);
    expect(rejectedUntil(BG_RUN_DENIED_ASK)).toBe(null);

    const allowed = JSON.stringify({
      type: "assistant",
      quotaLimits: { status: "allowed", resetsAt: 1 },
    });

    expect(rejectedUntil(`${LIMIT_REJECTED}\n${allowed}`)).toBe(null);
    expect(rejectedUntil(`${LIMIT_REJECTED}\n${BG_RUN_DENIED_ASK}`)).toBe(null);
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
    expect(out[8]).toBe("… 83 passing lines cut by the factory …");
  });
  test("a failure inside the tail is kept once", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `(pass) ${i}`);
    lines[98] = "(fail) 98";
    const out = cutToFailures(lines.join("\n")).split("\n");
    expect(out.filter((l) => l === "(fail) 98").length).toBe(1);
    expect(out.at(-1)).toBe("(pass) 99");
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
    bot: BOT,
    taste: ["CLAUDE.md"],
    layers: {
      check: ["tsc strict"],
      plan: ["no classes"],
      judge: ["names read well"],
      none: [],
    },
  };

  test("a full rules file reads; trust defaults to the repo's owner", () => {
    const r = parseRules(JSON.stringify(good));
    expect(r).toEqual(good);
    expect("errors" in r ? null : actorsOf(r, "owner/app")).toEqual(A);
    expect(
      "errors" in r
        ? null
        : actorsOf({ ...r, trusted: ["x"] }, "owner/app").trusted,
    ).toEqual(["x"]);
  });
  test("every wrong field is named", () => {
    const bad = parseRules(
      JSON.stringify({ ...good, atOnce: 0, layers: { check: [] } }),
    );

    expect(
      "errors" in bad ? bad.errors.map((e) => e.split(":")[0]) : bad,
    ).toEqual([
      ".claude/factory.json atOnce",
      ".claude/factory.json layers.plan",
      ".claude/factory.json layers.judge",
      ".claude/factory.json layers.none",
    ]);
    expect("errors" in parseRules("{")).toBe(true);
  });
  test("the bot is a [bot] login, and never trusted", () => {
    expect("errors" in parseRules(JSON.stringify({ ...good, bot: "me" }))).toBe(
      true,
    );
    expect(
      "errors" in parseRules(JSON.stringify({ ...good, trusted: [ME, BOT] })),
    ).toBe(true);
    expect(
      "errors" in parseRules(JSON.stringify({ ...good, trusted: [ME] })),
    ).toBe(false);
  });
});

describe("bot", () => {
  const b: Bot = {
    token: "t",
    expiresAt: "2026-10-26T12:00:00Z",
    name: BOT,
    email: "1+x@users.noreply.github.com",
  };

  const at = Date.parse(b.expiresAt);

  test("a token renews once it is within the renew window, or when none is held", () => {
    expect(needsRenew(null, at)).toBe(true);
    expect(needsRenew(b, at - RENEW_BEFORE_MS - 1)).toBe(false);
    expect(needsRenew(b, at - RENEW_BEFORE_MS + 1)).toBe(true);
  });
  test("its environment points gh, git push and git commit at the bot", () => {
    expect(botEnv(b)).toMatchObject({
      GH_TOKEN: "t",
      GIT_AUTHOR_NAME: BOT,
      GIT_CONFIG_VALUE_1: "!gh auth git-credential",
    });
  });
});

describe("snapshot", () => {
  test("a call is undone only by a trusted person's undo issue", () => {
    const undo = (call: number) => render({ kind: "undo", call, text: "x" });

    const s: Snapshot = {
      issues: [],
      open: [],
      prs: new Map(),
      claimed: new Set(),
      merged: [],
      truncated: [],
      undos: [
        { body: undo(1), author: ME, editor: null },
        { body: undo(2), author: "stranger", editor: null },
        { body: undo(3), author: ME, editor: BOT },
        { body: "Undoes factory call 4.", author: ME, editor: null },
      ],
    };

    expect([...undone(s, A)]).toEqual([1]);
  });
});
