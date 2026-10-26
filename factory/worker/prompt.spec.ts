import { describe, expect, test } from "bun:test";
import { parseApprovalQuestion } from "../lib/formats.ts";
import { planGaps } from "../lib/plan.ts";
import { seal } from "./cli.ts";
import { runPrompt, type RunInput } from "./prompt.ts";

const base: RunInput = {
  repo: "o/r",
  issue: 7,
  title: "Add due dates",
  body: "Tasks need a due date.",
  notes: [{ author: "you", body: "keep it in one file" }],
  plan: null,
  handoff: null,
  rules: {
    atOnce: 1,
    waitsPerDay: 3,
    contextCap: 1000,
    taste: ["CLAUDE.md"],
    layers: {
      check: [],
      plan: ["no classes"],
      judge: ["names read well"],
      none: [],
    },
  },
  cli: "bun /f/worker/cli.ts",
};

describe("run prompt", () => {
  test("a first run gets the issue, the notes, the plan-layer rules and every factory command", () => {
    const p = runPrompt(base);
    for (const s of [
      "# Add due dates",
      "@you: keep it in one file",
      "no classes",
      "names read well",
      "hope:compose",
    ])
      expect(p).toContain(s);
    for (const cmd of ["plan", "call", "handoff", "pr", "stuck"])
      expect(p).toContain(`bun /f/worker/cli.ts ${cmd}`);
    expect(p).not.toContain("You are continuing");
  });
  test("the approval question it dictates is the one the ask hook recognises", () => {
    const q = /question "([^"]+)"/
      .exec(runPrompt(base))![1]!
      .replace("<seal>", "01234567");
    expect(parseApprovalQuestion(q)).toEqual({ issue: 7, seal8: "01234567" });
  });
  test("a restarted run goes on from the plan and the handoff", () => {
    const p = runPrompt({
      ...base,
      plan: {
        kind: "plan",
        issue: 7,
        seal: "s",
        approved: "s",
        text: "## Types\nDue",
      },
      handoff: { kind: "handoff", issue: 7, text: "Left: the formatter" },
    });
    expect(p).toContain("You are continuing");
    expect(p).toContain("The plan (approved)");
    expect(p).toContain("Left: the formatter");
  });
});

describe("seal", () => {
  test("is the sha256 of the plan text, so any edit changes it", () => {
    expect(seal("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(seal("## Types\na")).not.toBe(seal("## Types\nb"));
    expect(planGaps("## Types\na")).toEqual(["Signatures", "Files"]);
  });
});
