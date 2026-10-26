import type { Args, EngineInterface, Next, ToolCallResult } from "claude-code";
import { botEnv, must, type Bot } from "../lib/github.ts";
import { currentRun, runner, showOnce } from "./session.ts";
import type { FactoryRun } from "./state.d.ts";

const RENEW_BEFORE_MS = 10 * 60_000;

async function heldBot($: EngineInterface, fr: FactoryRun): Promise<Bot> {
  const { value: held } = await $.state.get({ plugin: "factory", key: "bot" });

  if (
    held !== undefined &&
    Date.parse(held.expiresAt) - (await $.clock.now()) >= RENEW_BEFORE_MS
  )
    return held;

  const out = await must(
    runner($),
    ["bun", `${$.plugin.root}/worker/cli.ts`, "token", fr.repo],
    {
      cwd: fr.cwd,
    },
  );

  /** SAFETY: the token command prints a Bot as JSON, and nothing else. */
  const bot = JSON.parse(out) as Bot;
  await $.state.set({ plugin: "factory", key: "bot" }, bot);

  return bot;
}

/**
 * Before any tool runs in a factory run, makes what it starts act on GitHub as the factory's bot.
 * With no token to be had, the tool still runs, with no GitHub login at all.
 */
export async function actAsBot(
  $: EngineInterface,
  e: Args<"tool.call">,
  next: Next<"tool.call">,
): Promise<ToolCallResult> {
  try {
    const fr = await currentRun($);

    if (fr) {
      const env = botEnv(await heldBot($, fr));
      /** `$.env.set` takes each name as a literal, so the names are spelled out. */
      await $.env.set("GH_TOKEN", env.GH_TOKEN);
      await $.env.set("GIT_AUTHOR_NAME", env.GIT_AUTHOR_NAME);
      await $.env.set("GIT_AUTHOR_EMAIL", env.GIT_AUTHOR_EMAIL);
      await $.env.set("GIT_COMMITTER_NAME", env.GIT_COMMITTER_NAME);
      await $.env.set("GIT_COMMITTER_EMAIL", env.GIT_COMMITTER_EMAIL);
    }
  } catch (err) {
    await showOnce($, String(err));
  }

  return next(e);
}
