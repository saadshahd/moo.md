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
  /** This Mac's hardware UUID: its claim commits carry it. */
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
  }),
]);

const WtList = z.object({
  items: z.array(
    z.object({
      branch: z.optional(z.nullable(z.string())),
      worktree: z.optional(z.nullable(z.object({ path: z.string() }))),
    }),
  ),
});

export async function worktrees(ctx: Ctx): Promise<{ issue: number; path: string }[]> {
  const out = z.parse(WtList, JSON.parse(await must(run, ["wt", "list", "--format", "json"], { cwd: ctx.dir })));

  return out.items.flatMap((i) => {
    const n = issueOf(i.branch ?? "");

    return n === null || !i.worktree ? [] : [{ issue: n, path: i.worktree.path }];
  });
}

type Facts = {
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

/** The claim commit on `factory/<n>` carries this machine's id. */
async function claimedHere(ctx: Ctx, n: number): Promise<boolean> {
  await must(run, ["git", "fetch", "origin", branchFor(n)], { cwd: ctx.dir });

  const range = `origin/${ctx.base}..origin/${branchFor(n)}`;
  const trailer = "--format=%(trailers:key=Factory-Claim,valueonly)";
  const out = await must(run, ["git", "log", range, trailer], { cwd: ctx.dir });

  return out.split("\n").some((l) => l.trim() === ctx.machine);
}

export async function readWorld(ctx: Ctx, rules: Rules, actors: Actors): Promise<World> {
  const trees = await worktrees(ctx);
  const gh = await readSnapshot(run, ctx.repo, trees.map((t) => t.issue));

  const all = z.parse(
    z.array(Session),
    JSON.parse(await must(run, ["claude", "agents", "--json", "--all"])),
  ).flatMap((s) => (s.kind === "background" ? [s] : []));

  const local = await Promise.all(
    trees.map(async (t): Promise<Local> => {
      const plan = Bun.file(join(t.path, PLAN_PATH));

      const runs = await Promise.all(
        all
          .filter((s) => s.name === runName(ctx.repo, t.issue))
          .sort((a, b) => a.startedAt - b.startedAt)
          .map(async (s): Promise<RunView> => {
            const { context, pendingAsk, rejectedUntil } = await sessionFacts(s.sessionId);

            return { id: s.id, sessionId: s.sessionId, state: s.state, context, pendingAsk, rejectedUntil };
          }),
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

  for (const i of maybe) if (await claimedHere(ctx, i.number)) here.add(i.number);

  return { now: Date.now(), gh, actors, rules, local, claimedHere: here };
}
