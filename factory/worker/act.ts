/** The worker's one edge: each decided action, done on GitHub, git, wt or Claude Code. */

import { join, resolve } from "node:path";
import { branchFor, edit, latest, markStuck, must, post, runName, upsert } from "../lib/github.ts";
import { total, type Plan, type Restart } from "../lib/formats.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import { sum } from "../lib/transcript.ts";
import { approved, notes } from "../lib/wait.ts";
import type { Action, World } from "./decide.ts";
import { run } from "./proc.ts";
import { runPrompt } from "./prompt.ts";
import { RUN_SETTINGS } from "./sandbox.ts";
import { sessionFacts, worktrees, type Ctx } from "./snapshot.ts";

const CLI = `bun ${join(import.meta.dir, "cli.ts")}`;

export const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

const pathOf = (w: World, n: number) => w.local.find((l) => l.issue === n)?.path;

/** No force: if another machine pushed the branch first, this push is not a fast-forward. */
async function claim(ctx: Ctx, n: number): Promise<boolean> {
  await must(run, ["git", "fetch", "origin", ctx.base], { cwd: ctx.dir });

  const git = async (...argv: string[]) => (await must(run, ["git", ...argv], { cwd: ctx.dir })).trim();
  const tree = await git("rev-parse", `origin/${ctx.base}^{tree}`);
  const message = `factory: claim #${n}\n\nFactory-Claim: ${ctx.machine}`;
  const sha = await git("commit-tree", tree, "-p", `origin/${ctx.base}`, "-m", message);
  const r = await run(["git", "push", "origin", `${sha}:refs/heads/${branchFor(n)}`], { cwd: ctx.dir });

  return r.exitCode === 0;
}

async function worktreeFor(ctx: Ctx, n: number, plan: Plan | null): Promise<string> {
  const b = branchFor(n);
  /** The pushed branch is the run's state; a local copy left by a removed worktree yields to it. */
  await must(run, ["git", "fetch", "origin", `+${b}:${b}`], { cwd: ctx.dir });
  await must(run, ["wt", "switch", b, "--no-cd", "--yes"], { cwd: ctx.dir });
  const path = (await worktrees(ctx)).find((t) => t.issue === n)?.path;

  if (path === undefined) throw new Error(`wt made no worktree for ${b}`);

  /** The plan and handoff files live in the worktree but never in the repo. */
  const excludePath = await must(run, ["git", "rev-parse", "--git-path", "info/exclude"], { cwd: path });
  const exclude = Bun.file(resolve(path, excludePath.trim()));
  const had = (await exclude.exists()) ? await exclude.text() : "";

  if (!had.split("\n").includes(".factory/"))
    await Bun.write(exclude, `${had}${had === "" || had.endsWith("\n") ? "" : "\n"}.factory/\n`);

  /** A retry goes on from the sealed plan: the file must be the posted text, byte for byte. */
  if (plan) await Bun.write(join(path, PLAN_PATH), plan.text);

  return path;
}

async function start(ctx: Ctx, w: World, n: number): Promise<void> {
  const issue = w.gh.issues.find((i) => i.number === n);

  if (issue === undefined) throw new Error(`#${n} is no open factory issue`);
  const plan = latest(issue.comments, w.actors, "plan")?.c ?? null;
  const cwd = pathOf(w, n) ?? (await worktreeFor(ctx, n, plan));

  const prompt = runPrompt({
    repo: ctx.repo,
    issue: n,
    title: issue.title,
    body: issue.body,
    notes: notes(issue.comments, w.actors).map((c) => ({ author: c.author ?? "", body: c.body })),
    plan: plan === null ? null : { text: plan.text, approved: approved(issue.comments, w.actors, plan.seal) },
    handoff: latest(issue.comments, w.actors, "handoff")?.c.text ?? null,
    rules: w.rules,
    cli: CLI,
  });

  const flags = ["--permission-mode", "bypassPermissions", "--settings", JSON.stringify(RUN_SETTINGS)];
  await must(run, ["claude", "--bg", "--name", runName(ctx.repo, n), ...flags, prompt], { cwd });
}

/** Does one action; false when a claim was lost, so the issue's later actions are skipped. */
export async function apply(ctx: Ctx, w: World, a: Action): Promise<boolean> {
  const n = a.issue;

  const restarted = (reason: Restart["reason"] | null, session: string | null) =>
    reason === null || session === null ? null : post(run, ctx.repo, n, { kind: "restart", issue: n, reason, session });

  switch (a.kind) {
    case "claim":
      return claim(ctx, n);
    case "start":
      /** The restart is posted first: a start that fails after it counts as a death, not a silent loop. */
      await restarted(a.restart, a.after);
      await start(ctx, w, n);
      log(`#${n}: started${a.restart === null ? "" : ` (${a.restart})`}`);

      return true;
    case "stop":
      await must(run, ["claude", "stop", a.run.id]);

      return true;
    case "wake": {
      const cwd = pathOf(w, n);

      if (cwd === undefined) throw new Error(`#${n} has no worktree here`);
      await restarted(a.restart, a.run.sessionId);
      /** Without flags, `--resume` wakes the same session under its own id, name and options. */
      await run(["claude", "stop", a.run.id]);
      await must(run, ["claude", "--bg", "--resume", a.run.sessionId, a.message], { cwd });
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
    case "postCost": {
      const u = sum(await Promise.all(a.sessions.map(async (s) => (await sessionFacts(s)).usage)));
      const cost = { kind: "cost", issue: n, pr: a.pr, sessions: a.sessions, ...u } as const;
      const did = await upsert(run, ctx.repo, a.pr, cost, w.gh.prs.get(n)?.comments ?? [], w.actors);

      if (did !== "unchanged") log(`#${n}: cost ${did} on PR #${a.pr}: ${total(cost).toLocaleString("en-US")} tokens`);

      return true;
    }

    case "postStopped":
      await post(run, ctx.repo, n, { kind: "stopped", issue: n, session: a.session });

      return true;
    case "removeWorktree":
      await must(run, ["wt", "remove", branchFor(n), "--yes", "--force"], { cwd: ctx.dir });
      log(`#${n}: worktree removed`);

      return true;
  }
}
