/**
 * The world one tick decides on: GitHub's snapshot, this machine's worktrees, its runs' sessions
 * and what their transcripts say. Transcripts are parsed again only when their size or mtime moved.
 */

import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { branchFor, issueOf, must, runName, STUCK_LABEL, type Actors } from "../lib/github.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import type { Rules } from "../lib/rules.ts";
import { readSnapshot } from "../lib/snapshot.ts";
import { contextSize, pendingAsk, rejectedUntil, sum, usage, type Usage } from "../lib/transcript.ts";
import * as z from "../lib/vendor/zod-mini.js";
import type { App } from "./app.ts";
import { SESSION_STATES, type Local, type RunView, type World } from "./decide.ts";
import { run } from "./proc.ts";

export type Ctx = {
  app: App;
  /** The target repo's main worktree. */
  dir: string;
  repo: string;
  base: string;
  /** This machine's stable id (see platform.ts): its claim commits carry it. */
  machine: string;
};

const PROJECTS = join(homedir(), ".claude", "projects");

/** `claude agents` lists interactive sessions too, with another shape; runs are background ones. */
const Session = z.union([
  z.object({ kind: z.literal("interactive") }),
  z.object({
    kind: z.literal("background"),
    id: z.string(),
    sessionId: z.string(),
    name: z.optional(z.nullable(z.string())),
    startedAt: z.number(),
    state: z.literal(SESSION_STATES),
    /** "input needed" while its own question box waits; its transcript holds the ask only once answered. */
    waitingFor: z.optional(z.nullable(z.string())),
  }),
]);

type Background = Extract<z.infer<typeof Session>, { kind: "background" }>;

/** The background sessions named `name` in `claude agents --json` output, oldest first. */
export function sessionsNamed(agentsJson: string, name: string): Background[] {
  return z
    .parse(z.array(Session), JSON.parse(agentsJson))
    .flatMap((s) => (s.kind === "background" && s.name === name ? [s] : []))
    .sort((a, b) => a.startedAt - b.startedAt);
}

export const runView = (s: Background, f: Facts): RunView => ({
  id: s.id,
  sessionId: s.sessionId,
  state: s.state,
  context: f.context,
  pendingAsk: f.pendingAsk || s.waitingFor === "input needed",
  rejectedUntil: f.rejectedUntil,
});

/**
 * The `factory/<n>` worktrees in `git worktree list --porcelain` output: a block per worktree,
 * blank lines between, holding `worktree <path>`, then `branch refs/heads/<name>` or `detached`,
 * and any of `bare`, `locked` and `prunable`. A prunable worktree's folder is gone, so it is none.
 */
export function factoryWorktrees(porcelain: string): { issue: number; path: string }[] {
  return porcelain.split(/\n{2,}/).flatMap((block) => {
    const lines = block.split("\n");
    const path = lines.find((l) => l.startsWith("worktree "))?.slice("worktree ".length);
    const n = issueOf(lines.find((l) => l.startsWith("branch refs/heads/"))?.slice("branch refs/heads/".length) ?? "");
    const gone = lines.some((l) => l === "prunable" || l.startsWith("prunable "));

    return path === undefined || n === null || gone ? [] : [{ issue: n, path }];
  });
}

export async function worktrees(ctx: Pick<Ctx, "dir">): Promise<{ issue: number; path: string }[]> {
  return factoryWorktrees(await must(run, ["git", "worktree", "list", "--porcelain"], { cwd: ctx.dir }));
}

export type Facts = {
  usage: Usage;
  context: number;
  pendingAsk: boolean;
  rejectedUntil: number | null;
};

const seen = new Map<string, { at: string; facts: Facts }>();

async function factsOf(path: string, mainline: boolean): Promise<Facts> {
  const s = await stat(path);
  const at = `${s.mtimeMs}:${s.size}`;
  const hit = seen.get(path);

  if (hit?.at === at) return hit.facts;
  const text = await Bun.file(path).text();

  const facts: Facts = {
    usage: usage(text),
    context: mainline ? contextSize(text) : 0,
    pendingAsk: mainline && pendingAsk(text),
    rejectedUntil: mainline ? rejectedUntil(text) : null,
  };

  seen.set(path, { at, facts });

  return facts;
}

const glob = (pattern: string) => Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: PROJECTS, absolute: true }));

/** A session's facts; its usage includes its subagents' transcripts. */
export async function sessionFacts(sessionId: string): Promise<Facts> {
  const [main] = await glob(`*/${sessionId}.jsonl`);
  const subs = await glob(`*/${sessionId}/subagents/*.jsonl`);
  const own = main === undefined ? null : await factsOf(main, true);
  const theirs = await Promise.all(subs.map((p) => factsOf(p, false)));

  return {
    usage: sum([own?.usage, ...theirs.map((f) => f.usage)].flatMap((u) => u ?? [])),
    context: own?.context ?? 0,
    pendingAsk: own?.pendingAsk ?? false,
    rejectedUntil: own?.rejectedUntil ?? null,
  };
}

/** Whether a commit on `ref` past the base is a claim this machine pushed; an unreadable ref is none. */
export async function claimIn(ctx: Pick<Ctx, "base" | "machine">, cwd: string, ref: string): Promise<boolean> {
  const trailer = "--format=%(trailers:key=Factory-Claim,valueonly)";
  const r = await run(["git", "log", `origin/${ctx.base}..${ref}`, trailer], { cwd });

  return r.exitCode === 0 && r.stdout.split("\n").some((l) => l.trim() === ctx.machine);
}

export async function readWorld(ctx: Ctx, rules: Rules, actors: Actors): Promise<World> {
  const all = await worktrees(ctx);
  const claimed = await Promise.all(all.map((t) => claimIn(ctx, t.path, "HEAD")));
  /** A `factory/<n>` worktree this machine never claimed is someone else's: the worker leaves it alone. */
  const trees = all.filter((_, i) => claimed[i]);
  const gh = await readSnapshot(run, ctx.repo, trees.map((t) => t.issue));

  const agents = await must(run, ["claude", "agents", "--json", "--all"]);

  const local = await Promise.all(
    trees.map(async (t): Promise<Local> => {
      const plan = Bun.file(join(t.path, PLAN_PATH));

      const runs = await Promise.all(
        sessionsNamed(agents, runName(ctx.repo, t.issue)).map(async (s) => runView(s, await sessionFacts(s.sessionId))),
      );

      return { issue: t.issue, path: t.path, plan: (await plan.exists()) ? await plan.text() : null, runs };
    }),
  );

  const mine = new Set(local.map((l) => l.issue));

  const maybe = gh.issues.filter(
    (i) => gh.claimed.has(i.number) && !mine.has(i.number) && !i.labels.includes(STUCK_LABEL),
  );

  /** One at a time: each fetch writes the repo's refs. */
  const here = new Set<number>();

  for (const i of maybe) {
    await must(run, ["git", "fetch", "origin", branchFor(i.number)], { cwd: ctx.dir });

    if (await claimIn(ctx, ctx.dir, `origin/${branchFor(i.number)}`)) here.add(i.number);
  }

  const foreign = all.flatMap((t, i) => (claimed[i] ? [] : [t.issue]));

  return { now: Date.now(), gh, actors, rules, local, claimedHere: here, foreign };
}
