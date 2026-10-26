import type { Args, EngineInterface, Next, ToolCallResult } from "claude-code";
import { Bot, botEnv, needsRenew } from "../lib/bot.ts";
import { must } from "../lib/github.ts";
import * as z from "../lib/vendor/zod-mini.js";
import { currentRun, ghConfigDir, runner, showOnce, withoutLogin } from "./session.ts";
import type { FactoryRun } from "./state.d.ts";

/**
 * The bot this session holds, minted again near its expiry. The token command looks the repo up
 * through gh, so a mint works under the user's login or the bot's, and fails under the placeholder.
 */
async function heldBot($: EngineInterface, fr: FactoryRun): Promise<Bot> {
  const { value: held } = await $.state.get({ plugin: "factory", key: "bot" });

  if (held !== undefined && !needsRenew(held, await $.clock.now())) return held;

  const out = await must(runner($), ["bun", `${$.plugin.root}/worker/cli.ts`, "token", fr.repo], {
    cwd: fr.cwd,
  });

  const bot = z.parse(Bot, JSON.parse(out));
  await $.state.set({ plugin: "factory", key: "bot" }, bot);

  return bot;
}

/** Sets the whole login on every call, so nothing rests on what an earlier call set. */
async function asBot($: EngineInterface, fr: FactoryRun): Promise<void> {
  const env = botEnv(await heldBot($, fr));
  /** `$.env.set` takes each name as a literal, so the names are spelled out. */
  await $.env.set("GH_CONFIG_DIR", ghConfigDir(fr.cwd));
  await $.env.set("GH_TOKEN", env.GH_TOKEN);
  await $.env.set("GITHUB_TOKEN", undefined);
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

/**
 * Before any tool runs in a factory run, makes what it starts act on GitHub as the factory's bot.
 * With no token to be had, the tool still runs with no GitHub login at all, never the user's.
 */
export async function actAsBot(
  $: EngineInterface,
  e: Args<"tool.call">,
  next: Next<"tool.call">,
): Promise<ToolCallResult> {
  let fr: FactoryRun | null = null;

  try {
    fr = await currentRun($);

    if (fr) await asBot($, fr);
  } catch (err) {
    if (fr) await withoutLogin($, fr.cwd);
    await showOnce($, String(err));
  }

  return next(e);
}
