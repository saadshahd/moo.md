import type { EngineInterface, ToolCallInput, ToolCallResult } from "claude-code";
import { botEnv, gitConfigEnv, type Bot } from "../lib/bot.ts";
import { messageOf } from "../lib/errors.ts";
import { issueOf, must, repoOf, runName, type Run } from "../lib/github.ts";
import type { FactoryRun } from "./state.d.ts";

/** A `tool.call` event for tool `T`. */
export type ToolCall<T extends string> = Extract<ToolCallInput, { tool: T }>;

/** The `next` a `tool.call` hook passes its event on with. */
export type PassOn<E> = (e: E) => Promise<ToolCallResult>;

/** Where this plugin's `worker/cli.ts` sits. */
export function cliPath($: EngineInterface): string {
  return `${$.plugin.root}/worker/cli.ts`;
}

export function runner($: EngineInterface): Run {
  return (argv, opts) =>
    $.process.run(argv, {
      cwd: opts?.cwd,
      stdin: opts?.stdin,
      timeoutMs: 60_000,
    });
}

/**
 * Sets the whole GitHub login on every call, so nothing rests on what an earlier call set. With no
 * bot, gh and git get no login at all, so the run fails on GitHub rather than acting as the user.
 * `GH_CONFIG_DIR` alone is not enough: with no token in the environment, gh falls back to the
 * user's token in the macOS keychain, so `GH_TOKEN` holds a placeholder. `$.env.set` takes each
 * name as a literal, so the names are spelled out, one pair per entry of the factory's git config.
 */
export async function useLogin($: EngineInterface, cwd: string, bot: Bot | null): Promise<void> {
  const env = bot === null ? null : botEnv(bot);
  const git = gitConfigEnv();
  await $.env.set("GH_CONFIG_DIR", `${cwd}/.factory/no-gh-login`);
  await $.env.set("GH_TOKEN", env?.GH_TOKEN ?? "factory-no-login");
  await $.env.set("GITHUB_TOKEN", undefined);
  await $.env.set("GIT_CONFIG_COUNT", git.GIT_CONFIG_COUNT);
  await $.env.set("GIT_CONFIG_KEY_0", git.GIT_CONFIG_KEY_0);
  await $.env.set("GIT_CONFIG_VALUE_0", git.GIT_CONFIG_VALUE_0);
  await $.env.set("GIT_CONFIG_KEY_1", git.GIT_CONFIG_KEY_1);
  await $.env.set("GIT_CONFIG_VALUE_1", git.GIT_CONFIG_VALUE_1);
  await $.env.set("GIT_CONFIG_KEY_2", git.GIT_CONFIG_KEY_2);
  await $.env.set("GIT_CONFIG_VALUE_2", git.GIT_CONFIG_VALUE_2);
  await $.env.set("GIT_CONFIG_KEY_3", git.GIT_CONFIG_KEY_3);
  await $.env.set("GIT_CONFIG_VALUE_3", git.GIT_CONFIG_VALUE_3);
  await $.env.set("GIT_CONFIG_KEY_4", git.GIT_CONFIG_KEY_4);
  await $.env.set("GIT_CONFIG_VALUE_4", git.GIT_CONFIG_VALUE_4);

  if (env === null) return;
  await $.env.set("GIT_AUTHOR_NAME", env.GIT_AUTHOR_NAME);
  await $.env.set("GIT_AUTHOR_EMAIL", env.GIT_AUTHOR_EMAIL);
  await $.env.set("GIT_COMMITTER_NAME", env.GIT_COMMITTER_NAME);
  await $.env.set("GIT_COMMITTER_EMAIL", env.GIT_COMMITTER_EMAIL);
}

/**
 * The factory run this session is, or null. A session is a run when it sits on a `factory/<n>`
 * branch and carries the name the worker gave that issue's run; a person's session in the same
 * worktree is not. `$` carries no session name, so the session finds its own among the ones
 * `claude agents` lists. A `factory/<n>` session that can't tell loses the user's login.
 */
async function currentRun($: EngineInterface): Promise<FactoryRun | null> {
  const held = await $.state.get({ plugin: "factory", key: "run" });

  if (held.value !== undefined) return held.value;
  const run = runner($);
  const cwd = await $.session.cwd();
  const branch = await run(["git", "branch", "--show-current"], { cwd });
  const issue = branch.exitCode === 0 ? issueOf(branch.stdout) : null;
  let found: FactoryRun | null = null;

  if (issue !== null) {
    try {
      const repo = await repoOf(run, cwd);
      const id = await $.session.id();

      /** SAFETY: `claude agents --json` prints an array of sessions, each with `sessionId` and `name`. */
      const all = JSON.parse(
        await must(run, ["claude", "agents", "--json", "--all"]),
      ) as { sessionId: string; name?: string | null }[];

      if (all.find((s) => s.sessionId === id)?.name === runName(repo, issue))
        found = { repo, issue, cwd };
    } catch (err) {
      await useLogin($, cwd, null);
      throw err;
    }
  }

  await $.state.set({ plugin: "factory", key: "run" }, found);

  return found;
}

/**
 * In a factory run, what `act` gives; otherwise `orElse`. A failure shows once a session and gives
 * `orElse`, so the hook that met it passes its event on.
 */
export async function inRun<T>(
  $: EngineInterface,
  orElse: T,
  act: (fr: FactoryRun) => Promise<T>,
): Promise<T> {
  try {
    const fr = await currentRun($);

    return fr ? await act(fr) : orElse;
  } catch (err) {
    const why = `factory: ${messageOf(err)}`;

    const { value: shown = [] } = await $.state.get({ plugin: "factory", key: "shown" });

    if (!shown.includes(why)) {
      await $.state.set({ plugin: "factory", key: "shown" }, [...shown, why]);
      $.ui.toast(why);
    }

    return orElse;
  }
}
