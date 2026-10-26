import type { Register } from "claude-code";
import { APPROVE, parseApprovalQuestion, type Plan } from "../lib/formats.ts";
import {
  comments,
  edit,
  issueOf,
  latest,
  must,
  post,
  repoOf,
  type Comment,
  type Run,
} from "../lib/github.ts";
import { cutToFailures, isTestCommand } from "../lib/logs.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import { RULES_PATH, parseRules, type Rules } from "../lib/rules.ts";

// The hooks a factory run works under. A session is a factory run when its directory sits on a
// claimed `factory/<n>` branch; in every other session each hook passes its event straight on.
//   ask    AskUserQuestion waits for the human, posted on the issue, up to the daily cap; past
//          it the run takes its own pick and posts a call. Until the hook is calibrated on past
//          choices, no ask is judged by undo cost: under the cap, every ask waits.
//   seal   an edit to the approved plan revokes its approval.
//   logs   test output is cut to its failures before the agent reads it.
//   notes  after a tool call, at most once a minute, the issue's newest human comment reaches the agent.

const NOTE_EVERY_MS = 60_000;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

type FactoryRun = { repo: string; issue: number; cwd: string; rules: Rules };

const runner =
  ($: any): Run =>
  (argv, opts) =>
    $.process.run(argv, {
      cwd: opts?.cwd,
      stdin: opts?.stdin,
      timeoutMs: 60_000,
    });

/** The factory run this session is, or null when it is any other session. */
async function factoryRun($: any): Promise<FactoryRun | null> {
  const run = runner($);
  const cwd: string = await $.session.cwd();
  const branch = await run(["git", "branch", "--show-current"], { cwd });
  const issue = branch.exitCode === 0 ? issueOf(branch.stdout) : null;
  if (issue === null) return null;
  const key = `repo:${cwd}`;
  let repo = (await $.store.get(key)) as string | undefined;
  if (!repo) {
    repo = await repoOf(run, cwd);
    await $.store.set(key, repo);
  }
  const rules = parseRules(await must(run, ["cat", RULES_PATH], { cwd }));
  if ("errors" in rules) throw new Error(rules.errors.join("; "));
  return { repo, issue, cwd, rules };
}

/** Shows a failure once and lets the event go on: a hook never blocks what it wraps. */
function shown($: any, err: unknown): void {
  $.ui.toast(`factory: ${err instanceof Error ? err.message : String(err)}`);
}

/** The text the human answered `question` with, from AskUserQuestion's result. */
function answerTo(
  result: unknown,
  text: string | undefined,
  question: string,
): string {
  const answers = (result as { answers?: Record<string, string> } | undefined)
    ?.answers;
  return answers?.[question] ?? text ?? "(no answer read)";
}

/** Today in UTC, the day the wait cap counts in. */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The newest comment a person wrote after comment `afterId` and after `sinceMs`, or null. What came
 * before the session started reached it in its prompt.
 */
export function newestNote(
  cs: readonly Comment[],
  afterId: number,
  sinceMs: number,
): Comment | null {
  return (
    cs
      .filter(
        (c) =>
          c.id > afterId &&
          Date.parse(c.createdAt) > sinceMs &&
          !c.body.startsWith("<!-- factory:"),
      )
      .at(-1) ?? null
  );
}

export const register: Register = (on) => {
  on("tool.call", { tool: "AskUserQuestion" }, async ($, e, next) => {
    let fr: FactoryRun | null;
    try {
      fr = await factoryRun($);
    } catch (err) {
      shown($, err);
      return next(e);
    }
    if (!fr) return next(e);
    const run = runner($);
    const questions: { question: string }[] = (e as any).questions ?? [];
    const asked = questions.map((q) => q.question).join(" · ");
    const approval = questions
      .map((q) => parseApprovalQuestion(q.question))
      .find((a) => a !== null);
    // Approving a plan is the human's alone, so it always waits and never counts against the cap.
    if (!approval) {
      const key = `waits:${today()}`;
      const used = Number((await $.store.get(key)) ?? 0);
      if (used >= fr.rules.waitsPerDay)
        return {
          deny: `Today's ${fr.rules.waitsPerDay} waits for the human are used up. Take your recommended pick, post it as a call (factory call), and go on.`,
        };
      await $.store.set(key, used + 1);
    }
    let waitId: number | null = null;
    try {
      waitId = await post(run, fr.repo, fr.issue, {
        kind: "wait",
        issue: fr.issue,
        question: asked,
        answer: null,
      });
    } catch (err) {
      shown($, err);
    }
    const r = await next(e);
    if (r.deny !== undefined || r.isError) return r;
    try {
      const answers = questions.map((q) =>
        answerTo(r.result, r.text, q.question),
      );
      if (waitId !== null)
        await edit(run, fr.repo, waitId, {
          kind: "wait",
          issue: fr.issue,
          question: asked,
          answer: answers.join(" · "),
        });
      const i = questions.findIndex((q) => parseApprovalQuestion(q.question));
      if (approval && answers[i] === APPROVE) {
        const plan = latest(await comments(run, fr.repo, fr.issue), "plan");
        if (plan && plan.c.seal.startsWith(approval.seal8))
          await edit(run, fr.repo, plan.id, {
            ...plan.c,
            approved: plan.c.seal,
          });
      }
    } catch (err) {
      shown($, err);
    }
    return r;
  });

  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const r = await next(e);
    if (r.deny !== undefined || !isTestCommand(String((e as any).command ?? "")))
      return r;
    try {
      if (!(await factoryRun($))) return r;
      const out = r.result as { stdout?: string; stderr?: string };
      const stdout = cutToFailures(out.stdout ?? "");
      const stderr = cutToFailures(out.stderr ?? "");
      if (stdout === out.stdout && stderr === out.stderr) return r;
      return {
        result: { ...out, stdout, stderr } as typeof r.result,
        context: r.context,
      };
    } catch (err) {
      shown($, err);
      return r;
    }
  });

  on("tool.call", async ($, e, next) => {
    const r = await next(e);
    if (r.deny !== undefined) return r;
    try {
      const fr = await factoryRun($);
      if (!fr) return r;
      const run = runner($);
      const context: string[] = [];

      const path = String(
        (e as any).file_path ?? (e as any).notebook_path ?? "",
      );
      if (EDIT_TOOLS.has(e.tool) && !r.isError && path.endsWith(PLAN_PATH)) {
        const plan = latest(await comments(run, fr.repo, fr.issue), "plan");
        if (plan && plan.c.approved !== null) {
          await edit(run, fr.repo, plan.id, {
            ...plan.c,
            approved: null,
          } satisfies Plan);
          context.push(
            "You changed the approved plan, so its approval is revoked. Post it again with `factory plan` and ask for approval before building on it.",
          );
        }
      }

      const sid: string = await $.session.id();
      const atKey = `notes:at:${sid}`;
      const now = Date.now();
      if (now - Number((await $.store.get(atKey)) ?? 0) >= NOTE_EVERY_MS) {
        await $.store.set(atKey, now);
        // Keyed by issue, not session: a restarted run never takes the same note twice.
        const seenKey = `notes:seen:${fr.repo}#${fr.issue}`;
        const seen = Number((await $.store.get(seenKey)) ?? 0);
        const cs = await comments(run, fr.repo, fr.issue);
        const { startedAt } = await $.session.usage();
        const note = newestNote(cs, seen, startedAt);
        if (note) {
          await $.store.set(seenKey, note.id);
          context.push(
            `A note from @${note.author} on issue #${fr.issue}, posted ${note.createdAt}:\n\n${note.body}`,
          );
        }
      }

      return context.length > 0
        ? { ...r, context: [...(r.context ?? []), ...context] }
        : r;
    } catch (err) {
      shown($, err);
      return r;
    }
  });
};
