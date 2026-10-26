import type { EngineInterface, Register } from "claude-code";
import { isFactory, parseApprovalQuestion, type Plan } from "../lib/formats.ts";
import {
  comments,
  edit,
  issueOf,
  latest,
  botEnv,
  type Bot,
  must,
  post,
  trusted,
  repoOf,
  type Comment,
  type Run,
} from "../lib/github.ts";
import { cutToFailures, isTestCommand } from "../lib/logs.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import { RULES_PATH, parseRules, type Rules } from "../lib/rules.ts";
import { answerIds } from "../lib/wait.ts";

/**
 * A session is a factory run when its directory sits on a claimed `factory/<n>` branch;
 * in any other session every hook passes its event straight on.
 */

const NOTE_EVERY_MS = 60_000;

type FactoryRun = { repo: string; issue: number; cwd: string; rules: Rules };

export const runner =
  ($: EngineInterface): Run =>
  (argv, opts) =>
    $.process.run(argv, {
      cwd: opts?.cwd,
      stdin: opts?.stdin,
      timeoutMs: 60_000,
    });

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

  /** From the default branch, never the run's own: a run could edit its branch's copy. */
  const rules = parseRules(
    await must(run, ["git", "show", `refs/remotes/origin/HEAD:${RULES_PATH}`], { cwd }),
  );

  if ("errors" in rules) throw new Error(rules.errors.join("; "));

  return { repo, issue, cwd, rules };
}

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

/**
 * The refusal for a tool call in a factory run the factory can't set up (its rules, its repo, its
 * bot token). Going on would act as the user's own login, so the run is stopped instead.
 */
function cantRun(err: Error | string) {
  return {
    deny: `The factory can't run this session (${err instanceof Error ? err.message : err}). Stop now: end your turn without touching GitHub.`,
  };
}

const RENEW_BEFORE_MS = 10 * 60_000;

/**
 * Makes everything the run starts from here on act on GitHub as the factory's bot, minting a new
 * token when the held one is within ten minutes of expiring. Throws when no token can be had: a
 * run that silently fell back to the user's own login could approve its own plan.
 */
async function asBot($: EngineInterface, fr: FactoryRun): Promise<void> {
  const key = `bot:${fr.repo}`;
  const held = await $.store.get(key);
  /** SAFETY: only this function writes the key, with the token command's JSON output. */
  let bot = held === undefined ? null : (JSON.parse(String(held)) as Bot);

  if (bot === null || Date.parse(bot.expiresAt) - Date.now() < RENEW_BEFORE_MS) {
    const out = await must(runner($), ["bun", `${$.plugin.root}/worker/cli.ts`, "token"], {
      cwd: fr.cwd,
    });

    /** SAFETY: the token command prints a Bot as JSON, and nothing else. */
    bot = JSON.parse(out) as Bot;
    await $.store.set(key, out.trim());
  }

  const env = botEnv(bot);
  /** `$.env.set` takes each name as a literal, so the names are spelled out. */
  await $.env.set("GH_TOKEN", env.GH_TOKEN);
  await $.env.set("GIT_CONFIG_COUNT", env.GIT_CONFIG_COUNT);
  await $.env.set("GIT_CONFIG_KEY_0", env.GIT_CONFIG_KEY_0);
  await $.env.set("GIT_CONFIG_VALUE_0", env.GIT_CONFIG_VALUE_0);
  await $.env.set("GIT_CONFIG_KEY_1", env.GIT_CONFIG_KEY_1);
  await $.env.set("GIT_CONFIG_VALUE_1", env.GIT_CONFIG_VALUE_1);
  await $.env.set("GIT_AUTHOR_NAME", env.GIT_AUTHOR_NAME);
  await $.env.set("GIT_AUTHOR_EMAIL", env.GIT_AUTHOR_EMAIL);
  await $.env.set("GIT_COMMITTER_NAME", env.GIT_COMMITTER_NAME);
  await $.env.set("GIT_COMMITTER_EMAIL", env.GIT_COMMITTER_EMAIL);
}

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
          trusted(c) &&
          !isFactory(c.body),
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
      return cantRun(err instanceof Error ? err : String(err));
    }

    if (!fr) return next(e);

    try {
      await asBot($, fr);
    } catch (err) {
      return cantRun(err instanceof Error ? err : String(err));
    }

    const said = await $.session
      .messages()
      .then((ms) => whyAsked(ms))
      .catch(() => "");

    const questions = e.questions.map((q) => ({
      question: q.question,
      why: said === "" ? q.header : said,
      options: q.options.map((o) => o.label),
    }));

    /**
     * Approving a plan is the human's alone, so it always waits and never counts against the cap.
     */
    const approval = questions.some((q) => parseApprovalQuestion(q.question));
    const key = `waits:${today()}`;
    const used = Number((await $.store.get(key)) ?? 0);

    if (!approval && used >= fr.rules.waitsPerDay)
      return {
        deny: `Today's ${fr.rules.waitsPerDay} waits for the human are used up. Take your recommended pick, post it as a call with the factory's call command, and go on.`,
      };

    try {
      await post(runner($), fr.repo, fr.issue, {
        kind: "wait",
        issue: fr.issue,
        questions,
        answers: null,
      });
    } catch (err) {
      /**
       * Nobody watches this run's question box, so a question that can't reach the issue stops it.
       */
      const why = err instanceof Error ? err.message : String(err);

      return {
        deny: `Your question could not be posted on issue #${fr.issue} (${why}). Mark the issue stuck with the factory's stuck command, giving that reason, and stop.`,
      };
    }

    if (!approval) await $.store.set(key, used + 1);

    return {
      deny: `Your question is posted on issue #${fr.issue}; the human answers it there. End your turn now: write nothing more and run no tool. The answer arrives as your next message.`,
    };
  });

  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const r = await next(e);

    /** Only a failed run is cut: passing output may still hold words like "0 fail". */
    if (r.deny !== undefined || !r.isError || !isTestCommand(e.command))
      return r;

    try {
      if (!(await factoryRun($))) return r;
      const cut = cutToFailures(r.text ?? "");

      /**
       * Output with a failure in it comes back cut; the model reads a deny returned after the
       * tool ran as that tool's error result, and nothing the command did is undone.
       */
      return cut === (r.text ?? "") ? r : { deny: cut };
    } catch (err) {
      shown($, err instanceof Error ? err : String(err));

      return r;
    }
  });

  on("tool.call", async ($, e, next) => {
    /** Before the tool runs, so what it starts acts as the bot. */
    try {
      const fr = await factoryRun($);

      if (fr) await asBot($, fr);
    } catch (err) {
      return cantRun(err instanceof Error ? err : String(err));
    }

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
        /** Keyed by issue, not session: a restarted run never takes the same note twice. */
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
