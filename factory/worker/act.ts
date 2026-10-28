/** The worker's one edge: each decided action, done on GitHub, git, the repo's worktree commands or Claude Code. */

import { join, resolve } from "node:path";
import { branchFor, closePr, edit, latest, markStuck, must, post, runName, upsert } from "../lib/github.ts";
import { total, type Plan, type Restart } from "../lib/formats.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import type { Rules } from "../lib/rules.ts";
import { sum } from "../lib/transcript.ts";
import { approved, notes } from "../lib/wait.ts";
import type { Action, World } from "./decide.ts";
import { run } from "./proc.ts";
import { runPrompt } from "./prompt.ts";
import { runSettings } from "./sandbox.ts";
import { sessionFacts, worktrees, type Ctx } from "./snapshot.ts";

const CLI = `bun ${join(import.meta.dir, "cli.ts")}`;

export const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

/** The last line logged per issue and topic, so each change is said once, not each minute. */
const said = new Map<string, string>();

export function say(n: number, topic: "state" | "trust" | "worktree", line: string): void {
  if (said.get(`${n} ${topic}`) === line) return;
  said.set(`${n} ${topic}`, line);
  log(`#${n}: ${line}`);
}

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

/** The worktree a create command lent: the last line it printed, from the main worktree when relative. */
export function createdPath(stdout: string, dir: string): string {
  const line = stdout.split("\n").findLast((l) => l.trim() !== "")?.trim();

  if (line === undefined) throw new Error("the rules' worktree create command printed no worktree path");

  return resolve(dir, line);
}

/** `argv` with `key` replaced by `value` wherever it stands. */
const fill = (argv: readonly string[], key: string, value: string) => argv.map((a) => a.replaceAll(key, value));

/**
 * Throws unless the worktree at `path` is on issue `n`'s branch. After a worker restart, a pool
 * may reset a slot whose lease ended and lend it to another session between the tick's read and
 * this act; going on there would commit on that session's branch. The next tick reads again.
 */
export async function onBranch(path: string, n: number): Promise<void> {
  const branch = (await must(run, ["git", "branch", "--show-current"], { cwd: path })).trim();

  if (branch !== branchFor(n)) throw new Error(`${path} is on ${branch === "" ? "no branch" : branch}, not ${branchFor(n)}`);
}

/**
 * The rules' worktree commands run as the worker's own children, from the main worktree, never
 * through a shell: a pool may record its caller as a lease's owner, and a shell exits at once.
 */
async function lent(ctx: Pick<Ctx, "dir">, create: readonly string[], n: number): Promise<string> {
  const path = createdPath(await must(run, fill(create, "{name}", `factory-${n}`), { cwd: ctx.dir }), ctx.dir);
  await must(run, ["git", "switch", branchFor(n)], { cwd: path });

  return path;
}

async function added(ctx: Pick<Ctx, "dir">, n: number): Promise<string> {
  const path = `${resolve(ctx.dir)}.factory-${n}`;
  await must(run, ["git", "worktree", "add", path, branchFor(n)], { cwd: ctx.dir });

  return path;
}

/** Issue `n`'s worktree on its branch: one the rules' create command lends, else one git adds beside the main one. */
export async function worktreeFor(ctx: Pick<Ctx, "dir">, rules: Rules, n: number, plan: Plan | null): Promise<string> {
  const b = branchFor(n);
  /** The pushed branch is the run's state; a local copy left by a removed worktree yields to it. */
  await must(run, ["git", "fetch", "origin", `+${b}:${b}`], { cwd: ctx.dir });
  const path = rules.worktree === undefined ? await added(ctx, n) : await lent(ctx, rules.worktree.create, n);
  await onBranch(path, n);

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

/**
 * Gives issue `n`'s worktree back to the rules' release command, else git removes it, unsaved
 * work and all. A release command may keep a worktree that holds unsaved work: it stays on the
 * issue's branch and ends again each tick, so the kept line is said once.
 */
export async function letGo(ctx: Pick<Ctx, "dir">, rules: Rules, n: number, path: string): Promise<void> {
  if (rules.worktree === undefined) {
    await must(run, ["git", "worktree", "remove", "--force", path], { cwd: ctx.dir });
    log(`#${n}: worktree removed`);

    return;
  }

  const out = (await must(run, fill(rules.worktree.release, "{dir}", path), { cwd: ctx.dir })).trim();
  const printed = out === "" ? "" : `: ${out}`;

  if ((await worktrees(ctx)).some((t) => t.issue === n)) say(n, "worktree", `worktree kept by the release command${printed}`);
  else log(`#${n}: worktree released${printed}`);
}

async function start(ctx: Ctx, w: World, n: number): Promise<void> {
  const issue = w.gh.issues.find((i) => i.number === n);

  if (issue === undefined) throw new Error(`#${n} is no open factory issue`);
  /** Read before the worktree is made, so rules that would open the App's key fail the start first. */
  const settings = runSettings(w.rules);
  const plan = latest(issue.comments, w.actors, "plan")?.c ?? null;
  const cwd = pathOf(w, n) ?? (await worktreeFor(ctx, w.rules, n, plan));

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

  const flags = ["--permission-mode", "bypassPermissions", "--settings", JSON.stringify(settings)];
  await must(run, ["claude", "--bg", "--name", runName(ctx.repo, n), ...flags, prompt], { cwd });
}

/**
 * Merges the base into PR `pr`'s branch on GitHub, as the bot, only while its head is still
 * `head`. A head that moved since the snapshot is GitHub's 422, and no failure: the next tick
 * reads the new one.
 */
async function updateBranch(ctx: Ctx, n: number, pr: number, head: string): Promise<boolean> {
  const r = await run(["gh", "api", "-X", "PUT", `repos/${ctx.repo}/pulls/${pr}/update-branch`,
    "-f", `expected_head_sha=${head}`, "--silent"]);

  if (r.exitCode === 0) log(`#${n}: PR #${pr} updated from ${ctx.base}`);
  else if (r.stderr.includes("HTTP 422") && /expected head sha/i.test(r.stderr))
    log(`#${n}: PR #${pr} moved past ${head.slice(0, 7)} before its update; the next tick reads it again`);
  else throw new Error(`gh api update-branch failed: ${r.stderr.trim()}`);

  return true;
}

/** Does one action; false when a claim was lost, so the issue's later actions are skipped. */
export async function apply(ctx: Ctx, w: World, a: Action): Promise<boolean> {
  const n = a.issue;

  const restarted = (r: Pick<Restart, "reason" | "baseSha" | "review"> | null, session: string | null) =>
    r === null || session === null ? null : post(run, ctx.repo, n, { kind: "restart", issue: n, session, ...r });

  switch (a.kind) {
    case "claim":
      return claim(ctx, n);
    case "start": {
      const here = pathOf(w, n);

      /** Before the restart is posted, so a worktree lent to someone else costs no death. */
      if (here !== undefined) await onBranch(here, n);
      /** The restart is posted first: a start that fails after it counts as a death, not a silent loop. */
      await restarted(a.restart === null ? null : { reason: a.restart }, a.after);
      await start(ctx, w, n);
      log(`#${n}: started${a.restart === null ? "" : ` (${a.restart})`}`);

      return true;
    }

    case "stop":
      await must(run, ["claude", "stop", a.run.id]);

      return true;
    case "wake": {
      const cwd = pathOf(w, n);

      if (cwd === undefined) throw new Error(`#${n} has no worktree here`);
      await onBranch(cwd, n);
      await restarted(a.restart, a.run.sessionId);
      /**
       * After `claude stop`, `--resume` wakes the same session under its own id, name, flags and
       * sandbox. Resumed while not stopped, it starts a new session with none of them, so a failed
       * stop ends the wake here.
       */
      await must(run, ["claude", "stop", a.run.id]);
      await must(run, ["claude", "--bg", "--resume", a.run.sessionId, a.message], { cwd });
      log(`#${n}: woken`);

      return true;
    }

    case "updateBranch":
      return updateBranch(ctx, n, a.pr, a.head);
    case "postHeld":
      await post(run, ctx.repo, n, { kind: "held", issue: n, on: a.on });

      return true;
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
    case "closePr":
      await closePr(run, ctx.repo, a.pr, a.reason);
      log(`#${n}: PR #${a.pr} closed: ${a.reason}`);

      return true;
    case "removeWorktree": {
      const path = pathOf(w, n);

      if (path === undefined) throw new Error(`#${n} has no worktree here`);
      await letGo(ctx, w.rules, n, path);

      return true;
    }
  }
}
