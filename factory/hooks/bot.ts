import type { Args, EngineInterface, Next, ToolCallResult } from "claude-code";
import { Bot, needsRenew } from "../lib/bot.ts";
import { must } from "../lib/github.ts";
import * as z from "../lib/vendor/zod-mini.js";
import { cliPath, inRun, runner, useLogin } from "./session.ts";
import type { FactoryRun } from "./state.d.ts";

/**
 * The bot this session holds, minted again near its expiry. The token command looks the repo up
 * through gh, so a mint works under the user's login or the bot's, and fails under the placeholder.
 */
async function heldBot($: EngineInterface, fr: FactoryRun): Promise<Bot> {
  const { value: held } = await $.state.get({ plugin: "factory", key: "bot" });

  if (held !== undefined && !needsRenew(held, await $.clock.now())) return held;

  const out = await must(runner($), ["bun", cliPath($), "token", fr.repo], { cwd: fr.cwd });

  const bot = z.parse(Bot, JSON.parse(out));
  await $.state.set({ plugin: "factory", key: "bot" }, bot);

  return bot;
}

/**
 * Before any tool runs in a factory run, makes what it starts act on GitHub as the factory's bot.
 * With no token to be had, the tool still runs with no GitHub login at all, never the user's, and
 * the run hears once that it has none: a run told nothing goes looking for a token of its own.
 */
export async function actAsBot(
  $: EngineInterface,
  e: Args<"tool.call">,
  next: Next<"tool.call">,
): Promise<ToolCallResult> {
  let unminted = false;

  await inRun($, undefined, async (fr) => {
    try {
      await useLogin($, fr.cwd, await heldBot($, fr));
    } catch (err) {
      unminted = true;
      await useLogin($, fr.cwd, null);
      throw err;
    }
  });

  const r = await next(e);
  const { value: hinted = false } = await $.state.get({ plugin: "factory", key: "hinted" });

  if (!unminted || hinted || r.deny !== undefined) return r;
  await $.state.set({ plugin: "factory", key: "hinted" }, true);

  return { ...r, context: [...(r.context ?? []), NO_LOGIN_HINT] };
}

const NO_LOGIN_HINT =
  "factory: this run has no GitHub login. Don't look for a token or the factory's key: GitHub steps fail until the human fixes it.";
