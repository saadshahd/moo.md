/**
 * The factory worker: one per machine per target repo, kept up by launchd or a systemd user unit.
 *   bun factory/worker/main.ts <path to the target repo's main worktree>
 * Each minute it reads one snapshot, decides every action from it, then does them. Run state
 * lives in GitHub and Claude Code's session list, never in a file of the worker's.
 */

import { messageOf } from "../lib/errors.ts";
import { botEnv, needsRenew, type Bot } from "../lib/bot.ts";
import { must, repoOf } from "../lib/github.ts";
import { actorsOf, readRules, rulesChangedBy, RULES_PATH } from "../lib/rules.ts";
import { apply, log, say } from "./act.ts";
import { botFor, readApp } from "./app.ts";
import { trustedIssue } from "../lib/snapshot.ts";
import { classify, decide, occupies, stateLine } from "./decide.ts";
import { guard } from "./guard.ts";
import { machineId, platformOf, type Platform } from "./platform.ts";
import { run } from "./proc.ts";
import { readWorld, type Ctx } from "./snapshot.ts";

const TICK_MS = 60_000;

let awake: ReturnType<typeof Bun.spawn> | null = null;

/** The hold ends with the worker's pid, so a crashed worker never holds the machine awake. */
function holdAwake(p: Platform, busy: boolean): void {
  if (p.awake === null) return;

  if (busy && !awake) awake = Bun.spawn(p.awake(process.pid));

  if (!busy && awake) {
    awake.kill();
    awake = null;
  }
}

let bot: Bot | null = null;

async function asBot(ctx: Ctx): Promise<Bot> {
  if (bot !== null && !needsRenew(bot, Date.now())) return bot;
  bot = await botFor(ctx.app, ctx.repo);
  Object.assign(process.env, botEnv(bot));

  return bot;
}

async function tick(ctx: Ctx, p: Platform): Promise<void> {
  const me = await asBot(ctx);
  await must(run, ["git", "fetch", "origin", ctx.base], { cwd: ctx.dir });
  const rules = await readRules(run, ctx.dir);
  const byBot = await rulesChangedBy(run, ctx.dir, ctx.repo, me.name);

  if (byBot !== null)
    throw new Error(`the newest change to ${RULES_PATH} on ${ctx.base} came from the bot's PR #${byBot}; revert it, or change the file in a PR of your own, and the worker goes on`);
  const world = await readWorld(ctx, rules, actorsOf(rules, ctx.repo));

  const states = world.local.map((l) => classify(l, world));
  world.local.forEach((l, i) => say(l.issue, "state", stateLine(states[i]!)));

  for (const n of world.foreign) say(n, "state", "a factory worktree this machine never claimed; left alone");

  /** One at a time: claims, fetches and worktree commands all write the one repo's refs and locks. */
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
    if (!trustedIssue(i, world.actors))
      say(i.number, "trust", `passed over: labelled by ${i.labelledBy ?? "nobody seen"}, body by ${i.editor ?? i.author ?? "nobody"}; neither may be untrusted`);

  holdAwake(p, started || states.some(occupies));
}

async function main(dir: string): Promise<void> {
  const p = platformOf(process.platform);

  if (p === null) throw new Error(`the worker runs on macOS and Linux, not ${process.platform}`);
  const repo = await repoOf(run, dir);

  /** The run hooks and the rules read origin's default branch. */
  await must(run, ["git", "remote", "set-head", "origin", "--auto"], { cwd: dir });
  const argv = ["gh", "repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"];
  const base = (await must(run, argv)).trim();

  await must(run, ["git", "fetch", "origin", base], { cwd: dir });
  const rules = await readRules(run, dir);
  const app = await readApp();
  const { refusals, warnings } = await guard(repo, base, rules, app);

  if (refusals.length > 0) {
    for (const r of refusals) console.error(`factory: ${r}`);
    process.exit(1);
  }

  for (const w of warnings) log(`warning: ${w}`);
  const ctx: Ctx = { app, dir, repo, base, machine: await machineId(run, p) };
  log(`watching ${repo} (${base}), ${rules.atOnce} at once`);

  if (p.awake === null) log(`no keep-awake command for ${process.platform}, so busy runs never hold the machine awake`);

  for (;;) {
    try {
      await tick(ctx, p);
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
