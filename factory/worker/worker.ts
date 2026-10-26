// The factory worker: one per machine per target repo, kept up by launchd.
//   bun factory/worker/worker.ts <path to the target repo's main worktree>
// Each minute it watches its runs, cleans up after closed issues, then picks and starts new runs
// up to the rules' limit. All state lives in GitHub and in Claude Code's own session list.

import { hostname } from "node:os";
import { join } from "node:path";
import { isFactory, type Cost, type Wait } from "../lib/formats.ts";
import {
  branchFor,
  comments,
  edit,
  factoryComments,
  issueOf,
  latest,
  markStuck,
  must,
  openPrFiles,
  post,
  prFrom,
  repoOf,
  STUCK_LABEL,
  upsert,
  type Comment,
} from "../lib/github.ts";
import { answerMessage, answerTo, approvedSeal, openWait } from "../lib/wait.ts";
import { overlap, planFiles } from "../lib/plan.ts";
import { RULES_PATH, parseRules, type Rules } from "../lib/rules.ts";
import {
  contextSize,
  pendingAsk,
  rejectedUntil,
  sum,
  usage,
} from "../lib/transcript.ts";
import { run, sessions, transcript, type Session } from "./proc.ts";
import { runPrompt } from "./prompt.ts";

const LABEL = "factory";
const TICK_MS = 60_000;
const CRASHES_BEFORE_STUCK = 3;
const CLI = `bun ${join(import.meta.dir, "cli.ts")}`;

type Ctx = {
  dir: string;
  repo: string;
  base: string;
  rules: Rules;
  prefix: string;
};

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

/** Every reason the worker must not start on `dir`, read once at start; empty when it may. */
async function refusals(
  dir: string,
  repo: string,
  base: string,
): Promise<string[]> {
  const out: string[] = [];

  if (process.env.ANTHROPIC_API_KEY)
    out.push(
      "ANTHROPIC_API_KEY is set; it silently overrides your subscription. Unset it.",
    );

  const rules = await run([
    "gh",
    "api",
    `repos/${repo}/rules/branches/${base}`,
    "--jq",
    '[.[] | select(.type == "required_status_checks")] | length',
  ]);

  const protection = await run([
    "gh",
    "api",
    `repos/${repo}/branches/${base}/protection/required_status_checks`,
    "--jq",
    ".contexts | length",
  ]);

  const required =
    Number(rules.stdout.trim() || 0) + Number(protection.stdout.trim() || 0);

  if (required === 0)
    out.push(
      `${repo} ${base} requires no checks, so auto-merge would merge unchecked code. Require a check on ${base} first.`,
    );

  return out;
}

/** The runs of issue `n`, oldest first: every session the worker started for it on this machine. */
const runsOf = (all: Session[], ctx: Ctx, n: number) =>
  all
    .filter((s) => s.name === `${ctx.prefix}${n}`)
    .sort((a, b) => a.startedAt - b.startedAt);

async function issueView(ctx: Ctx, n: number) {
  // SAFETY: gh prints JSON with exactly the --json fields asked for, typed here.
  return JSON.parse(
    await must(run, [
      "gh",
      "issue",
      "view",
      String(n),
      "--repo",
      ctx.repo,
      "--json",
      "number,title,body,state,labels",
    ]),
  ) as {
    number: number;
    title: string;
    body: string;
    state: string;
    labels: { name: string }[];
  };
}

async function start(ctx: Ctx, n: number, cwd: string): Promise<void> {
  const issue = await issueView(ctx, n);
  const cs = await comments(run, ctx.repo, n);

  const prompt = runPrompt({
    repo: ctx.repo,
    issue: n,
    title: issue.title,
    body: issue.body,
    notes: cs
      .filter((c) => !isFactory(c.body))
      .map((c) => ({ author: c.author, body: c.body })),
    plan: latest(cs, "plan")?.c ?? null,
    handoff: latest(cs, "handoff")?.c ?? null,
    rules: ctx.rules,
    cli: CLI,
  });

  await must(
    run,
    [
      "claude",
      "--bg",
      "--name",
      `${ctx.prefix}${n}`,
      "--permission-mode",
      "bypassPermissions",
      prompt,
    ],
    { cwd },
  );
  log(`#${n}: started in ${cwd}`);
}

/** Posts the cost of every run of `n` on its PR; the same comment is updated, never posted twice. */
async function postCost(
  ctx: Ctx,
  n: number,
  pr: number,
  runs: Session[],
): Promise<void> {
  const u = sum(
    await Promise.all(
      runs.map(async (s) => usage(await transcript(s.sessionId))),
    ),
  );

  const cost: Cost = {
    kind: "cost",
    issue: n,
    pr,
    sessions: runs.map((s) => s.sessionId),
    ...u,
  };

  await upsert(run, ctx.repo, pr, cost);
}

type Worktree = { branch: string; path: string };

async function worktrees(ctx: Ctx): Promise<Worktree[]> {
  // SAFETY: `wt list --format json` (schema 2) prints `items`, each with these fields when present.
  const out = JSON.parse(
    await must(run, ["wt", "list", "--format", "json"], { cwd: ctx.dir }),
  ) as {
    items: { branch?: string; worktree?: { path: string } }[];
  };

  return out.items.flatMap((i) =>
    i.branch && i.worktree ? [{ branch: i.branch, path: i.worktree.path }] : [],
  );
}

async function stop(s: Session | undefined): Promise<void> {
  if (s && s.state !== "stopped") await run(["claude", "stop", s.id]);
}

const permissions = new Map<string, boolean>();

/** Whether `login` may push to the repo, so their answer counts; asked of GitHub once per login. */
function writers(ctx: Ctx, login: string): boolean {
  return permissions.get(`${ctx.repo}:${login}`) ?? false;
}

/** Reads, for every author on the issue not yet known, whether they may push to the repo. */
async function learnWriters(ctx: Ctx, cs: readonly Comment[]): Promise<void> {
  for (const login of new Set(cs.map((c) => c.author))) {
    const key = `${ctx.repo}:${login}`;

    if (permissions.has(key)) continue;

    const r = await run([
      "gh",
      "api",
      `repos/${ctx.repo}/collaborators/${login}/permission`,
      "--jq",
      ".permission",
    ]);

    permissions.set(key, ["admin", "maintain", "write"].includes(r.stdout.trim()));
  }
}

/**
 * Records the answers on the wait (and the plan's approval, when they approve it), then wakes
 * the waiting run with them as its next message.
 */
async function deliver(
  ctx: Ctx,
  cs: readonly Comment[],
  wait: { id: number; c: Wait },
  answers: string[],
  current: Session,
  path: string,
): Promise<void> {
  await edit(run, ctx.repo, wait.id, { ...wait.c, answers });
  const seal8 = approvedSeal(wait.c, answers);
  const plan = latest(cs, "plan");

  if (seal8 !== null && plan && plan.c.seal.startsWith(seal8))
    await edit(run, ctx.repo, plan.id, { ...plan.c, approved: plan.c.seal });
  await stop(current);
  // Without flags, `--resume` wakes the same session under its own id, name and options.
  await must(
    run,
    ["claude", "--bg", "--resume", current.sessionId, answerMessage(wait.c, answers)],
    { cwd: path },
  );
  log(`#${wait.c.issue}: answered; the run goes on`);
}

/** One issue this machine claimed: is its run alive, waiting, done, dead or over its context cap? */
async function watch(
  ctx: Ctx,
  all: Session[],
  n: number,
  path: string,
  limited: boolean,
): Promise<"busy" | "free"> {
  const issue = await issueView(ctx, n);
  const runs = runsOf(all, ctx, n);
  const current = runs.at(-1);
  const stuck = issue.labels.some((l) => l.name === STUCK_LABEL);
  const pr = await prFrom(run, ctx.repo, branchFor(n));
  const text = current ? await transcript(current.sessionId) : "";

  // A run that opened its PR is done once its turn ends, whatever state it ends in; a fast
  // merge can close the issue before any tick saw the run stop.
  if (pr !== null && current?.state !== "working" && !pendingAsk(text))
    await postCost(ctx, n, pr, runs);

  if (issue.state !== "OPEN" || stuck) {
    await stop(current);
    await must(run, ["wt", "remove", branchFor(n), "--yes", "--force"], {
      cwd: ctx.dir,
    });
    log(`#${n}: ${stuck ? "stuck" : "closed"}; worktree removed`);

    return "free";
  }

  if (current?.state === "working") {
    if (contextSize(text) <= ctx.rules.contextCap) return "busy";
    await stop(current);
    await post(run, ctx.repo, n, {
      kind: "restart",
      issue: n,
      reason: "context",
      session: current.sessionId,
    });
    await start(ctx, n, path);

    return "busy";
  }

  if (pendingAsk(text)) return "busy";
  const cs = await comments(run, ctx.repo, n);
  const wait = openWait(cs);

  // It asked on the issue and ended its turn: it waits until someone with write access answers.
  if (wait && current) {
    await learnWriters(ctx, cs);

    const a = answerTo(cs, wait.id, wait.c.questions.length, (login) =>
      writers(ctx, login),
    );

    if (a) await deliver(ctx, cs, wait, a.answers, current, path);

    return "busy";
  }

  if (pr !== null) {
    await stop(current);

    return "free";
  }

  // Its plan overlaps an open PR: `factory plan` sent it home. Keep the claim; go on after that PR.
  const plan = latest(cs, "plan");
  const theirs = [...(await openPrFiles(run, ctx.repo, branchFor(n))).values()].flat();

  if (plan && overlap(planFiles(plan.c.text), theirs).length > 0) return "free";

  // Dead, or its turn ended with no PR: a crash. Go on from plan, branch and handoff, or give up.
  if (limited) return "free";

  const crashes = crashesSinceRetry(cs);

  if (current && crashes >= CRASHES_BEFORE_STUCK) {
    await markStuck(run, ctx.repo, n, `the run died or ended without a PR ${crashes + 1} times`);
    log(`#${n}: stuck`);
    await stop(current);

    return "free";
  }

  if (current)
    await post(run, ctx.repo, n, {
      kind: "restart",
      issue: n,
      reason: "crash",
      session: current.sessionId,
    });
  await start(ctx, n, path);

  return "busy";
}

/** Crash restarts since the issue was last marked stuck: removing the stuck label is a retry, and
 * it starts the count again. */
export function crashesSinceRetry(cs: readonly Comment[]): number {
  const fs = factoryComments(cs).map((x) => x.c);
  const since = fs.findLastIndex((c) => c.kind === "stuck") + 1;

  return fs
    .slice(since)
    .filter((c) => c.kind === "restart" && c.reason === "crash").length;
}

/** Whether this machine pushed the claim on issue `n`'s branch. */
async function claimedHere(ctx: Ctx, n: number): Promise<boolean> {
  const b = branchFor(n);
  await must(run, ["git", "fetch", "origin", b], { cwd: ctx.dir });

  const subjects = await must(
    run,
    ["git", "log", "FETCH_HEAD", "--format=%s", "--grep", `^factory: claim #${n} on `],
    { cwd: ctx.dir },
  );

  return subjects.trim().split("\n").at(-1) === claimSubject(n);
}

const claimSubject = (n: number) => `factory: claim #${n} on ${hostname()}`;

/** Open issues labelled for the factory that nobody claimed, no open issue blocks, and whose plan
 * (if one was posted before) touches no file an open PR changes; unfinished ones first. */
async function candidates(
  ctx: Ctx,
  local: ReadonlySet<number>,
): Promise<{ n: number; resume: boolean }[]> {
  // SAFETY: gh prints JSON with exactly the --json fields asked for, typed here.
  const issues = JSON.parse(
    await must(run, [
      "gh",
      "issue",
      "list",
      "--repo",
      ctx.repo,
      "--label",
      LABEL,
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,labels",
    ]),
  ) as { number: number; labels: { name: string }[] }[];

  const claimed = new Set(
    (
      await must(run, ["git", "ls-remote", "--heads", "origin", "factory/*"], {
        cwd: ctx.dir,
      })
    )
      .split("\n")
      .flatMap((l) => {
        const n = issueOf(l.split("refs/heads/")[1] ?? "");

        return n === null ? [] : [n];
      }),
  );

  const prFiles = [...(await openPrFiles(run, ctx.repo, "")).values()].flat();

  const out: { n: number; planned: boolean; resume: boolean }[] = [];

  for (const i of issues) {
    if (local.has(i.number) || i.labels.some((l) => l.name === STUCK_LABEL))
      continue;

    // A claimed branch with no run here goes on only if this machine claimed it: after a retry
    // (the stuck label removed) or a worktree lost; another machine's claim stays theirs.
    const resume = claimed.has(i.number);

    if (resume && !(await claimedHere(ctx, i.number))) continue;

    const blockers = await must(run, [
      "gh",
      "api",
      `repos/${ctx.repo}/issues/${i.number}/dependencies/blocked_by`,
      "--jq",
      '[.[] | select(.state == "open")] | length',
    ]);

    if (Number(blockers.trim()) > 0) continue;
    const plan = latest(await comments(run, ctx.repo, i.number), "plan");

    if (plan && overlap(planFiles(plan.c.text), prFiles).length > 0) continue;
    out.push({ n: i.number, planned: plan !== null, resume });
  }

  return out
    .sort((a, b) => Number(b.planned) - Number(a.planned) || a.n - b.n)
    .map(({ n, resume }) => ({ n, resume }));
}

/** Pushes a claim commit to issue `n`'s branch; true when this push created it, so the issue is ours. */
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
        claimSubject(n),
      ],
      { cwd: ctx.dir },
    )
  ).trim();

  // No force: if another machine pushed the branch first, this push is not a fast-forward and fails.
  const r = await run(
    ["git", "push", "origin", `${sha}:refs/heads/${branchFor(n)}`],
    { cwd: ctx.dir },
  );

  return r.exitCode === 0;
}

async function worktreeFor(ctx: Ctx, n: number): Promise<string> {
  const b = branchFor(n);
  await must(run, ["git", "fetch", "origin", `${b}:${b}`], { cwd: ctx.dir });
  await must(run, ["wt", "switch", b, "--no-cd", "--yes"], { cwd: ctx.dir });
  const wt = (await worktrees(ctx)).find((w) => w.branch === b);

  if (!wt) throw new Error(`wt made no worktree for ${b}`);

  // The plan and handoff files live in the worktree but never in the repo.
  const common = (
    await must(run, ["git", "rev-parse", "--git-common-dir"], { cwd: wt.path })
  ).trim();

  const exclude = Bun.file(join(wt.path, common, "info", "exclude"));
  const had = (await exclude.exists()) ? await exclude.text() : "";

  if (!had.split("\n").includes(".factory/"))
    await Bun.write(
      exclude,
      `${had}${had.endsWith("\n") || had === "" ? "" : "\n"}.factory/\n`,
    );

  return wt.path;
}

let awake: ReturnType<typeof Bun.spawn> | null = null;

/** Holds the Mac awake while any run is busy, and lets it sleep when none is. */
function holdAwake(busy: boolean): void {
  if (busy && !awake) awake = Bun.spawn(["caffeinate", "-i"]);

  if (!busy && awake) {
    awake.kill();
    awake = null;
  }
}

async function tick(ctx: Ctx): Promise<void> {
  const all = await sessions();
  const mine = all.filter((s) => s.name?.startsWith(ctx.prefix));

  const until = Math.max(
    0,
    ...(await Promise.all(
      mine.map(async (s) => rejectedUntil(await transcript(s.sessionId)) ?? 0),
    )),
  );

  const limited = until * 1000 > Date.now();

  if (limited)
    log(
      `Claude refused for a usage limit; no run starts until ${new Date(until * 1000).toISOString()}`,
    );

  let busy = 0;
  const local = new Set<number>();

  for (const w of await worktrees(ctx)) {
    const n = issueOf(w.branch);

    if (n === null) continue;
    local.add(n);

    try {
      if ((await watch(ctx, all, n, w.path, limited)) === "busy") busy++;
    } catch (err) {
      log(`#${n}: ${err instanceof Error ? err.message : String(err)}`);
      busy++; // unknown state takes a slot rather than risk a second run of it
    }
  }

  if (!limited)
    for (const { n, resume } of await candidates(ctx, local)) {
      if (busy >= ctx.rules.atOnce) break;

      if (!resume && !(await claim(ctx, n))) {
        log(`#${n}: another machine claimed it first`);
        continue;
      }

      await start(ctx, n, await worktreeFor(ctx, n));
      busy++;
    }

  holdAwake(busy > 0);
}

async function main(dir: string): Promise<void> {
  const repo = await repoOf(run, dir);

  const base = (
    await must(run, [
      "gh",
      "repo",
      "view",
      repo,
      "--json",
      "defaultBranchRef",
      "--jq",
      ".defaultBranchRef.name",
    ])
  ).trim();

  const no = await refusals(dir, repo, base);

  if (no.length > 0) {
    for (const r of no) console.error(`factory: ${r}`);
    process.exit(1);
  }

  const read = parseRules(await Bun.file(join(dir, RULES_PATH)).text());

  if ("errors" in read) {
    for (const e of read.errors) console.error(`factory: ${e}`);
    process.exit(1);
  }

  const ctx: Ctx = {
    dir,
    repo,
    base,
    rules: read,
    prefix: `factory-${repo.split("/")[1]}-`,
  };

  log(`watching ${repo} (${base}), ${read.atOnce} at once`);

  for (;;) {
    try {
      await tick(ctx);
    } catch (err) {
      log(`tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    await Bun.sleep(TICK_MS);
  }
}

if (import.meta.main) {
  const dir = process.argv[2];

  if (!dir) {
    console.error(
      "usage: bun factory/worker/worker.ts <path to the target repo>",
    );
    process.exit(2);
  }

  await main(dir);
}
