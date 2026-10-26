import type { EngineInterface, Register } from "claude-code";
import { parseApprovalQuestion, type Plan } from "../lib/formats.ts";
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
import { answerIds } from "../lib/wait.ts";

// The hooks a factory run works under. A session is a factory run when its directory sits on a
// claimed `factory/<n>` branch; in every other session each hook passes its event straight on.
//   ask    AskUserQuestion never opens the run's question box: the questions, choices and why go
//          to the issue, and the run ends its turn; the worker brings the answer back. Up to the
//          daily cap every ask waits; past it the run takes its own pick and posts a call. A plan
//          approval always waits. Until the hook passes 18 of 20 past choices, nothing judges undo cost.
//   seal   an edit to the approved plan revokes its approval.
//   logs   test output is cut to its failures before the agent reads it.
//   notes  after a tool call, at most once a minute, the issue's newest human comment reaches the agent.

const NOTE_EVERY_MS = 60_000;

type FactoryRun = { repo: string; issue: number; cwd: string; rules: Rules };

const runner =
  ($: EngineInterface): Run =>
  (argv, opts) =>
    $.process.run(argv, {
      cwd: opts?.cwd,
      stdin: opts?.stdin,
      timeoutMs: 60_000,
    });

/** The factory run this session is, or null when it is any other session. */
async function factoryRun($: EngineInterface): Promise<FactoryRun | null> {
  const run = runner($);
  const cwd = await $.session.cwd();
  const branch = await run(["git", "branch", "--show-current"], { cwd });
  const issue = branch.exitCode === 0 ? issueOf(branch.stdout) : null;

  if (issue === null) return null;
  const key = `repo:${cwd}`;
  const cached = await $.store.get(key);
  let repo = cached === undefined ? "" : String(cached);

  if (repo === "") {
    repo = await repoOf(run, cwd);
    await $.store.set(key, repo);
  }

  const rules = parseRules(await must(run, ["cat", RULES_PATH], { cwd }));

  if ("errors" in rules) throw new Error(rules.errors.join("; "));

  return { repo, issue, cwd, rules };
}

/** Shows a failure once and lets the event go on: a hook never blocks what it wraps. */
function shown($: EngineInterface, err: Error | string): void {
  $.ui.toast(`factory: ${err instanceof Error ? err.message : err}`);
}

/**
 * The newest text the agent wrote since the last prompt it was given: one API message comes back as
 * several, and the one holding the AskUserQuestion call carries no text of its own.
 */
export function whyAsked(
  ms: readonly { role: string; text?: string; toolResults?: readonly object[] }[],
): string {
  for (const m of [...ms].reverse()) {
    if (m.role === "assistant" && (m.text ?? "").trim() !== "") return (m.text ?? "").trim();

    if (m.role === "user" && (m.toolResults ?? []).length === 0) return "";
  }

  return "";
}

/** Today in UTC, the day the wait cap counts in. */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The newest comment a person wrote after comment `afterId` and after `sinceMs`, or null. What came
 * before the session started reached it in its prompt, and an answer to a wait reached it as its
 * next message.
 */
export function newestNote(
  cs: readonly Comment[],
  afterId: number,
  sinceMs: number,
  answers: ReadonlySet<number> = answerIds(cs),
): Comment | null {
  return (
    cs
      .filter(
        (c) =>
          c.id > afterId &&
          !answers.has(c.id) &&
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
      shown($, err instanceof Error ? err : String(err));

      return next(e);
    }

    if (!fr) return next(e);

    // Why it asks: what the run wrote this turn before asking, else the question's short label.
    const said = await $.session
      .messages()
      .then((ms) => whyAsked(ms))
      .catch(() => "");

    const questions = e.questions.map((q) => ({
      question: q.question,
      why: said === "" ? q.header : said,
      options: q.options.map((o) => o.label),
    }));

    // Approving a plan is the human's alone, so it always waits and never counts against the cap.
    const approval = questions.some((q) => parseApprovalQuestion(q.question));
    const key = `waits:${today()}`;
    const used = Number((await $.store.get(key)) ?? 0);

    if (!approval && used >= fr.rules.waitsPerDay)
      return {
        deny: `Today's ${fr.rules.waitsPerDay} waits for the human are used up. Take your recommended pick, post it as a call (factory call), and go on.`,
      };

    try {
      await post(runner($), fr.repo, fr.issue, {
        kind: "wait",
        issue: fr.issue,
        questions,
        answers: null,
      });
    } catch (err) {
      // The question can't reach the issue, so it waits in the run's own question box instead.
      shown($, err instanceof Error ? err : String(err));

      return next(e);
    }

    if (!approval) await $.store.set(key, used + 1);

    return {
      deny: `Your question is posted on issue #${fr.issue}; the human answers it there. End your turn now: write nothing more and run no tool. The answer arrives as your next message.`,
    };
  });

  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const r = await next(e);

    if (r.deny !== undefined || !isTestCommand(e.command))
      return r;

    try {
      if (!(await factoryRun($))) return r;
      const cut = cutToFailures(r.text ?? "");

      // Output with a failure in it comes back cut; the model reads a deny returned after the
      // tool ran as that tool's error result, and nothing the command did is undone.
      return cut === (r.text ?? "") ? r : { deny: cut };
    } catch (err) {
      shown($, err instanceof Error ? err : String(err));

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

      const path =
        e.tool === "Edit" || e.tool === "Write"
          ? e.file_path
          : e.tool === "NotebookEdit"
            ? e.notebook_path
            : "";

      if (!r.isError && path.endsWith(PLAN_PATH)) {
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
      shown($, err instanceof Error ? err : String(err));

      return r;
    }
  });
};
