import type { EngineInterface, ToolCallResult } from "claude-code";
import { usage } from "../lib/commands.ts";
import { WHY_MAX } from "../lib/formats.ts";
import { latest, must, post, type Run } from "../lib/github.ts";
import { actorsOf, readRules } from "../lib/rules.ts";
import { comments } from "../lib/snapshot.ts";
import { isApproval } from "../lib/wait.ts";
import { cliPath, inRun, runner, type PassOn, type ToolCall } from "./session.ts";
import type { FactoryRun } from "./state.d.ts";

type Ask = ToolCall<"AskUserQuestion">;

/**
 * The newest text the agent wrote since the last prompt it was given: one API message comes back as
 * several, and the one holding the AskUserQuestion call carries no text of its own.
 */
export function whyAsked(
  ms: readonly {
    role: string;
    text?: string;
    toolResults?: readonly object[];
  }[],
): string {
  const prompt = ms.findLastIndex(
    (m) => m.role === "user" && (m.toolResults ?? []).length === 0,
  );

  const said = ms
    .slice(prompt + 1)
    .findLast((m) => m.role === "assistant" && (m.text ?? "").trim() !== "");

  return said?.text?.trim() ?? "";
}

export function localDay(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * Takes one of the day's waits for the repo, or answers false when they are used up. Every run of a
 * repo on this machine shares its git directory, and `mkdir` of a slot succeeds for one of them only.
 */
async function takeWait(
  run: Run,
  fr: FactoryRun,
  perDay: number,
  day: string,
): Promise<boolean> {
  const common = (
    await must(
      run,
      ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: fr.cwd },
    )
  ).trim();

  const slots = `${common}/factory/waits/${day}`;
  await must(run, ["mkdir", "-p", slots]);

  for (let slot = 1; slot <= perDay; slot++)
    if ((await run(["mkdir", `${slots}/${slot}`])).exitCode === 0) return true;

  return false;
}

/**
 * In a factory run, an ask goes to the issue as a wait and the run ends its turn until the answer
 * comes. An approval names the seal of the plan the bot posted last, so the answer approves that
 * plan and no later one. When it can't, the ask goes on to the run's own question box, where agent
 * view shows the run waiting.
 */
export async function askOnIssue(
  $: EngineInterface,
  e: Ask,
  next: PassOn<Ask>,
): Promise<ToolCallResult> {
  const posted = await inRun($, null, async (fr): Promise<ToolCallResult> => {
    const run = runner($);
    const rules = await readRules(run, fr.cwd);
    const said = whyAsked(await $.session.messages());

    const questions = e.questions.map((q) => ({
      question: q.question,
      why: (said === "" ? q.header : said).slice(0, WHY_MAX),
      options: q.options.map((o) => o.label),
    }));

    /** Approving a plan is the human's alone, so it always waits and never counts against the cap. */
    const approval = questions.some(isApproval);

    if (
      !approval &&
      !(await takeWait(run, fr, rules.waitsPerDay, localDay(new Date(await $.clock.now()))))
    )
      return {
        deny: `Today's ${rules.waitsPerDay} waits for the human are used up. Take your recommended pick, post it as a call with \`${usage(`bun ${cliPath($)}`).call}\`, and go on.`,
      };

    const plan = approval
      ? latest(await comments(run, fr.repo, fr.issue), actorsOf(rules, fr.repo), "plan")
      : null;

    await post(run, fr.repo, fr.issue, {
      kind: "wait",
      issue: fr.issue,
      questions,
      approves: plan?.c.seal ?? null,
      answers: null,
    });

    return {
      deny: `Your question is posted on issue #${fr.issue}; the human answers it there. End your turn now: write nothing more and run no tool. The answer arrives as your next message.`,
    };
  });

  return posted ?? next(e);
}
