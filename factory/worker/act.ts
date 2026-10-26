/** The worker's one edge: each decided action, done on GitHub, git, wt or Claude Code. */

import { join, resolve } from "node:path";
import {
  branchFor,
  edit,
  latest,
  markStuck,
  must,
  post,
  runName,
  upsert,
} from "../lib/github.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import { sum } from "../lib/transcript.ts";
import { approved, notes } from "../lib/wait.ts";
import type { Action, RunId, World } from "./decide.ts";
import { run } from "./proc.ts";
import { runPrompt } from "./prompt.ts";
import { sessionFacts, worktrees, type Ctx } from "./snapshot.ts";

const CLI = `bun ${join(import.meta.dir, "cli.ts")}`;

export const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

const pathOf = (w: World, n: number) =>
  w.local.find((l) => l.issue === n)?.path;

async function stop(r: RunId): Promise<void> {
  await must(run, ["claude", "stop", r.id]);
}

/** Without flags, `--resume` wakes the same session under its own id, name and options. */
async function wake(r: RunId, cwd: string, message: string): Promise<void> {
  await run(["claude", "stop", r.id]);
  await must(run, ["claude", "--bg", "--resume", r.sessionId, message], {
    cwd,
  });
}

/** No force: if another machine pushed the branch first, this push is not a fast-forward. */
async function claim(ctx: Ctx, n: number): Promise<boolean> {
  await must(run, ["git", "fetch", "origin", ctx.base], { cwd: ctx.dir });

  const tree = (
    await must(run, ["git", "rev-parse", `origin/${ctx.base}^{tree}`], {
      cwd: ctx.dir,
    })
  ).trim();

  const sha = (
    await must(
      run,
      [
        "git",
        "commit-tree",
        tree,
        "-p",
        `origin/${ctx.base}`,
        "-m",
        `factory: claim #${n}\n\nFactory-Claim: ${ctx.machine}`,
      ],
      { cwd: ctx.dir },
    )
  ).trim();

  const r = await run(
    ["git", "push", "origin", `${sha}:refs/heads/${branchFor(n)}`],
    {
      cwd: ctx.dir,
    },
  );

  return r.exitCode === 0;
}

async function worktreeFor(ctx: Ctx, w: World, n: number): Promise<string> {
  const b = branchFor(n);
  /** The pushed branch is the run's state; a local copy left by a removed worktree yields to it. */
  await must(run, ["git", "fetch", "origin", `+${b}:${b}`], { cwd: ctx.dir });
  await must(run, ["wt", "switch", b, "--no-cd", "--yes"], { cwd: ctx.dir });
  const path = (await worktrees(ctx)).find((t) => t.issue === n)?.path;

  if (path === undefined) throw new Error(`wt made no worktree for ${b}`);

  /** The plan and handoff files live in the worktree but never in the repo. */
  const exclude = resolve(
    path,
    (
      await must(run, ["git", "rev-parse", "--git-path", "info/exclude"], {
        cwd: path,
      })
    ).trim(),
  );

  const had = (await Bun.file(exclude).exists())
    ? await Bun.file(exclude).text()
    : "";

  if (!had.split("\n").includes(".factory/"))
    await Bun.write(
      exclude,
      `${had}${had === "" || had.endsWith("\n") ? "" : "\n"}.factory/\n`,
    );
  const issue = w.gh.issues.find((i) => i.number === n);

  const plan =
    issue === undefined ? null : latest(issue.comments, w.actors, "plan");

  /** A retry goes on from the sealed plan: the file must be the posted text, byte for byte. */
  if (plan) await Bun.write(join(path, PLAN_PATH), plan.c.text);

  return path;
}

async function start(ctx: Ctx, w: World, n: number): Promise<void> {
  const issue = w.gh.issues.find((i) => i.number === n);

  if (issue === undefined) throw new Error(`#${n} is no open factory issue`);
  const cwd = pathOf(w, n) ?? (await worktreeFor(ctx, w, n));
  const plan = latest(issue.comments, w.actors, "plan")?.c ?? null;

  const prompt = runPrompt({
    repo: ctx.repo,
    issue: n,
    title: issue.title,
    body: issue.body,
    notes: notes(issue.comments, w.actors).map((c) => ({
      author: c.author ?? "",
      body: c.body,
    })),
    plan:
      plan === null
        ? null
        : {
            text: plan.text,
            approved: approved(issue.comments, w.actors, plan.seal),
          },
    handoff: latest(issue.comments, w.actors, "handoff")?.c.text ?? null,
    rules: w.rules,
    cli: CLI,
  });

  await must(
    run,
    [
      "claude",
      "--bg",
      "--name",
      runName(ctx.repo, n),
      "--permission-mode",
      "bypassPermissions",
      prompt,
    ],
    { cwd },
  );
}

async function postCost(
  ctx: Ctx,
  w: World,
  n: number,
  pr: number,
  sessions: string[],
): Promise<void> {
  const u = sum(
    await Promise.all(sessions.map(async (s) => (await sessionFacts(s)).usage)),
  );

  const existing = w.gh.prs.get(n)?.comments ?? [];

  await upsert(
    run,
    ctx.repo,
    pr,
    { kind: "cost", issue: n, pr, sessions, ...u },
    existing,
    w.actors,
  );
}

/** Does one action; false when a claim was lost, so the issue's later actions are skipped. */
export async function apply(ctx: Ctx, w: World, a: Action): Promise<boolean> {
  const n = a.issue;

  switch (a.kind) {
    case "claim":
      return claim(ctx, n);
    case "start":
      /** The restart is posted first: a start that fails after it counts as a death, not a silent loop. */
      if (a.restart !== null && a.after !== null)
        await post(run, ctx.repo, n, {
          kind: "restart",
          issue: n,
          reason: a.restart,
          session: a.after,
        });
      await start(ctx, w, n);
      log(`#${n}: started${a.restart === null ? "" : ` (${a.restart})`}`);

      return true;
    case "stop":
      await stop(a.run);

      return true;
    case "wake": {
      const cwd = pathOf(w, n);

      if (cwd === undefined) throw new Error(`#${n} has no worktree here`);

      if (a.restart !== null)
        await post(run, ctx.repo, n, {
          kind: "restart",
          issue: n,
          reason: a.restart,
          session: a.run.sessionId,
        });
      await wake(a.run, cwd, a.message);
      log(`#${n}: woken`);

      return true;
    }

    case "closeWait":
      await edit(run, ctx.repo, a.wait.id, { ...a.wait.c, answers: a.answers });

      return true;
    case "markStuck":
      await markStuck(run, ctx.repo, n, a.reason);
      log(`#${n}: stuck: ${a.reason}`);

      return true;
    case "postCost":
      await postCost(ctx, w, n, a.pr, a.sessions);

      return true;
    case "removeWorktree":
      await must(run, ["wt", "remove", branchFor(n), "--yes", "--force"], {
        cwd: ctx.dir,
      });
      log(`#${n}: worktree removed`);

      return true;
  }
}
