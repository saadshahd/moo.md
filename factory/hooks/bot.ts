import type { Args, EngineInterface, Next, ToolCallResult } from "claude-code";
import { Bot, needsRenew } from "../lib/bot.ts";
import { must } from "../lib/github.ts";
import * as z from "../lib/vendor/zod-mini.js";
import { inRun, runner, useLogin } from "./session.ts";
import type { FactoryRun } from "./state.d.ts";

/**
 * The bot this session holds, minted again near its expiry. The token command looks the repo up
 * through gh, so a mint works under the user's login or the bot's, and fails under the placeholder.
 */
async function heldBot($: EngineInterface, fr: FactoryRun): Promise<Bot> {
  const { value: held } = await $.state.get({ plugin: "factory", key: "bot" });

  if (held !== undefined && !needsRenew(held, await $.clock.now())) return held;

  const out = await must(
    runner($),
    ["bun", `${$.plugin.root}/worker/cli.ts`, "token", fr.repo],
    {
      cwd: fr.cwd,
    },
  );

  const bot = z.parse(Bot, JSON.parse(out));
  await $.state.set({ plugin: "factory", key: "bot" }, bot);

  return bot;
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
  await inRun($, undefined, async (fr) => {
    try {
      await useLogin($, fr.cwd, await heldBot($, fr));
    } catch (err) {
      await useLogin($, fr.cwd, null);
      throw err;
    }
  });

  return next(e);
}
