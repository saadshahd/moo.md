/**
 * The factory worker: one per machine per target repo, kept up by launchd.
 *   bun factory/worker/main.ts <path to the target repo's main worktree>
 * Each minute it reads one snapshot, decides every action from it, then does them. Run state
 * lives in GitHub and Claude Code's session list, never in a file of the worker's.
 */

import { messageOf } from "../lib/errors.ts";
import { botEnv, needsRenew, type Bot } from "../lib/bot.ts";
import { must, repoOf } from "../lib/github.ts";
import { actorsOf, readRules } from "../lib/rules.ts";
import { apply, log } from "./act.ts";
import { botFor, readApp } from "./app.ts";
import { classify, decide, occupies, trustedIssue } from "./decide.ts";
import { refusals } from "./guard.ts";
import { run } from "./proc.ts";
import { readWorld, type Ctx } from "./snapshot.ts";

const TICK_MS = 60_000;

let awake: ReturnType<typeof Bun.spawn> | null = null;

/** `-w` ends `caffeinate` with the worker, so a crashed worker never holds the Mac awake. */
function holdAwake(busy: boolean): void {
  if (busy && !awake)
    awake = Bun.spawn(["caffeinate", "-i", "-w", String(process.pid)]);

  if (!busy && awake) {
    awake.kill();
    awake = null;
  }
}

let bot: Bot | null = null;

/** Untrusted issues already logged, so each is said once per worker run, not each minute. */
const passedOver = new Set<number>();

async function asBot(ctx: Ctx): Promise<void> {
  if (!needsRenew(bot, Date.now())) return;
  bot = await botFor(ctx.app, ctx.repo);
  Object.assign(process.env, botEnv(bot));
}

async function tick(ctx: Ctx): Promise<void> {
  await asBot(ctx);
  await must(run, ["git", "fetch", "origin", ctx.base], { cwd: ctx.dir });
  const rules = await readRules(run, ctx.dir);
  const world = await readWorld(ctx, rules, actorsOf(rules, ctx.repo));

  /** One at a time: claims, fetches and `wt` all write the one repo's refs and locks. */
  let started = false;

  for (const actions of decide(world))
    for (const a of actions) {
      try {
        if (!(await apply(ctx, world, a))) {
          log(`#${a.issue}: another machine claimed it first`);
          break;
        }

        started ||= a.kind === "start" || a.kind === "wake";
      } catch (err) {
        log(`#${a.issue}: ${a.kind} failed: ${messageOf(err)}`);
        break;
      }
    }

  for (const i of world.gh.issues)
    if (!trustedIssue(i, world.actors) && !passedOver.has(i.number)) {
      passedOver.add(i.number);
      log(`#${i.number}: passed over: labelled by ${i.labelledBy ?? "nobody seen"}, body by ${i.editor ?? i.author ?? "nobody"}; neither may be untrusted`);
    }

  holdAwake(started || world.local.some((l) => occupies(classify(l, world))));
}

async function machineId(): Promise<string> {
  const out = await must(run, ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"]);
  const id = /"IOPlatformUUID" = "([^"]+)"/.exec(out)?.[1];

  if (id === undefined) throw new Error("ioreg names no IOPlatformUUID for this Mac");

  return id;
}

async function main(dir: string): Promise<void> {
  const repo = await repoOf(run, dir);

  /** The run hooks and the rules read origin's default branch. */
  await must(run, ["git", "remote", "set-head", "origin", "--auto"], { cwd: dir });
  const argv = ["gh", "repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"];
  const base = (await must(run, argv)).trim();

  await must(run, ["git", "fetch", "origin", base], { cwd: dir });
  const rules = await readRules(run, dir);
  const app = await readApp();
  const no = await refusals(dir, repo, base, rules, app);

  if (no.length > 0) {
    for (const r of no) console.error(`factory: ${r}`);
    process.exit(1);
  }

  const ctx: Ctx = { app, dir, repo, base, machine: await machineId() };
  log(`watching ${repo} (${base}), ${rules.atOnce} at once`);

  for (;;) {
    try {
      await tick(ctx);
    } catch (err) {
      log(`tick failed: ${messageOf(err)}`);
    }

    await Bun.sleep(TICK_MS);
  }
}

if (import.meta.main) {
  const dir = process.argv[2];

  if (!dir) {
    console.error("usage: bun factory/worker/main.ts <path to the target repo>");
    process.exit(2);
  }

  await main(dir).catch((err: Error) => {
    console.error(`factory: ${messageOf(err)}`);
    process.exit(1);
  });
}
