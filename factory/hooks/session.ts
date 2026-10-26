import type { EngineInterface, ToolCallInput, ToolCallResult } from "claude-code";
import { issueOf, must, repoOf, type Run } from "../lib/github.ts";
import type { FactoryRun } from "./state.d.ts";

/** A `tool.call` event for tool `T`. */
export type ToolCall<T extends string> = Extract<ToolCallInput, { tool: T }>;

/** The `next` a `tool.call` hook passes its event on with. */
export type PassOn<E> = (e: E) => Promise<ToolCallResult>;

export function runner($: EngineInterface): Run {
  return (argv, opts) =>
    $.process.run(argv, {
      cwd: opts?.cwd,
      stdin: opts?.stdin,
      timeoutMs: 60_000,
    });
}

/** The name the worker gives issue `n`'s run with `claude --bg --name`. */
function runName(repo: string, n: number): string {
  return `factory-${repo.split("/")[1]}-${n}`;
}

/** `$` carries no session name, so the session finds its own among the ones `claude agents` lists. */
async function sessionName(
  $: EngineInterface,
  run: Run,
): Promise<string | null> {
  const id = await $.session.id();

  /** SAFETY: `claude agents --json` prints an array of sessions, each with `sessionId` and `name`. */
  const all = JSON.parse(
    await must(run, ["claude", "agents", "--json", "--all"]),
  ) as {
    sessionId: string;
    name?: string | null;
  }[];

  return all.find((s) => s.sessionId === id)?.name ?? null;
}

/**
 * Leaves gh and git with no GitHub login, so a run that has no bot token fails on GitHub rather
 * than acting as the user. `GH_CONFIG_DIR` alone is not enough: with no token in the environment,
 * gh falls back to the user's token in the macOS keychain, so `GH_TOKEN` holds a placeholder.
 */
async function withoutLogin($: EngineInterface, cwd: string): Promise<void> {
  await $.env.set("GH_CONFIG_DIR", `${cwd}/.factory/no-gh-login`);
  await $.env.set("GH_TOKEN", "factory-no-login");
  await $.env.set("GITHUB_TOKEN", undefined);
  await $.env.set("GIT_CONFIG_COUNT", "2");
  await $.env.set("GIT_CONFIG_KEY_0", "credential.helper");
  await $.env.set("GIT_CONFIG_VALUE_0", "");
  await $.env.set("GIT_CONFIG_KEY_1", "credential.helper");
  await $.env.set("GIT_CONFIG_VALUE_1", "!gh auth git-credential");
}

/**
 * The factory run this session is, or null. A session is a run when it sits on a `factory/<n>`
 * branch and carries the name the worker gave that issue's run; a person's session in the same
 * worktree is not. A run, or a `factory/<n>` session that can't tell, loses the user's login
 * before any tool runs.
 */
export async function currentRun(
  $: EngineInterface,
): Promise<FactoryRun | null> {
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

      if ((await sessionName($, run)) === runName(repo, issue))
        found = { repo, issue, cwd };
    } catch (err) {
      await withoutLogin($, cwd);
      throw err;
    }
  }

  if (found) await withoutLogin($, cwd);
  await $.state.set({ plugin: "factory", key: "run" }, found);

  return found;
}

/** Shows a failure once a session; the hook that met it passes its event on. */
export async function showOnce(
  $: EngineInterface,
  failure: string,
): Promise<void> {
  const why = `factory: ${failure}`;

  const { value: shown = [] } = await $.state.get({
    plugin: "factory",
    key: "shown",
  });

  if (shown.includes(why)) return;
  await $.state.set({ plugin: "factory", key: "shown" }, [...shown, why]);
  $.ui.toast(why);
}
