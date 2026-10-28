/** Why the worker must not start on this machine and repo; each reason says how to fix it. */

import { homedir } from "node:os";
import { join } from "node:path";
import type { Rules } from "../lib/rules.ts";
import * as z from "../lib/vendor/zod-mini.js";
import { botFor, type App } from "./app.ts";
import { run } from "./proc.ts";

const Settings = z.object({
  enabledPlugins: z.optional(z.record(z.string(), z.boolean())),
});

type Settings = z.infer<typeof Settings>;

async function settings(path: string): Promise<Settings> {
  const f = Bun.file(path);

  return (await f.exists()) ? z.parse(Settings, await f.json()) : {};
}

const AuthStatus = z.object({ loggedIn: z.boolean() });

/**
 * Any setup Claude Code reports as logged in counts: a subscription, an API key, `apiKeyHelper`,
 * a cloud provider. `claude auth status` exits 1 when logged out, so its JSON, not its exit, decides.
 */
export function loginRefusal(r: { stdout: string; stderr: string }): string {
  let raw: unknown;

  try {
    raw = JSON.parse(r.stdout);
  } catch {
    return `\`claude auth status\` printed no status: ${r.stderr.trim() || r.stdout.trim()}`;
  }

  return z.parse(AuthStatus, raw).loggedIn
    ? ""
    : "Claude Code has no login on this machine, so no run could start. Run `claude auth login`, or set up an API key.";
}

const BranchRules = z.array(
  z.object({
    type: z.string(),
    parameters: z.optional(
      z.object({
        strict_required_status_checks_policy: z.optional(z.boolean()),
        required_status_checks: z.optional(z.array(z.object({ context: z.string() }))),
      }),
    ),
  }),
);

const Protection = z.object({
  strict: z.boolean(),
  contexts: z.array(z.string()),
  checks: z.optional(z.array(z.object({ context: z.string() }))),
});

/**
 * Why the base's required checks leave auto-merge unsafe, from `rules/branches/<base>` and the
 * classic `protection/required_status_checks`, each null when unreadable: a repo without classic
 * protection gets a 404. A source passes only when it names a check and requires branches up to
 * date, or two PRs green alone could merge into a red base.
 */
export function checksRefusal(repo: string, base: string, [rules, protection]: [string | null, string | null]): string {
  const sources = [
    ...(rules === null ? [] : z.parse(BranchRules, JSON.parse(rules)))
      .filter((r) => r.type === "required_status_checks")
      .map((r) => ({
        checks: r.parameters?.required_status_checks?.length ?? 0,
        strict: r.parameters?.strict_required_status_checks_policy ?? false,
      })),
    ...(protection === null ? [] : [z.parse(Protection, JSON.parse(protection))]).map((p) => ({
      checks: new Set([...p.contexts, ...(p.checks ?? []).map((c) => c.context)]).size,
      strict: p.strict,
    })),
  ].filter((s) => s.checks > 0);

  if (sources.length === 0)
    return `${repo} ${base} requires no checks, so auto-merge would merge unchecked code. Require a check on ${base} first.`;

  return sources.some((s) => s.strict)
    ? ""
    : `${repo} ${base} requires checks but not branches up to date before merging, so two PRs green alone can merge into a red ${base}. Turn on "Require branches to be up to date before merging" where ${base} requires the check: strict_required_status_checks_policy in its ruleset, or required_status_checks.strict in its branch protection.`;
}

async function requiredChecks(repo: string, base: string): Promise<[string | null, string | null]> {
  const read = async (path: string) => {
    const r = await run(["gh", "api", path]);

    return r.exitCode === 0 ? r.stdout : null;
  };

  return Promise.all([
    read(`repos/${repo}/rules/branches/${base}`),
    read(`repos/${repo}/branches/${base}/protection/required_status_checks`),
  ]);
}

export async function refusals(
  repo: string,
  base: string,
  rules: Rules,
  app: App,
): Promise<string[]> {
  const user = await settings(join(homedir(), ".claude", "settings.json"));

  const bot = await botFor(app, repo).then(
    (b) =>
      b.name === rules.bot
        ? ""
        : `the App acts as ${b.name}, but the rules file names ${rules.bot}`,
    (err: Error) => `the factory's GitHub App can't act on ${repo}: ${err.message}`,
  );

  return [
    loginRefusal(await run(["claude", "auth", "status"])),
    Object.entries(user.enabledPlugins ?? {}).some(([k, on]) => on && k.startsWith("factory@"))
      ? ""
      : "the factory plugin is not installed and enabled for your user, so runs load no factory hooks. Install it with /plugin.",
    checksRefusal(repo, base, await requiredChecks(repo, base)),
    bot,
  ].filter((r) => r !== "");
}
