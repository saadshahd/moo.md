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

const REQUIRED_CHECKS = {
  contexts: z.array(z.string()),
  checks: z.optional(z.array(z.object({ context: z.string() }))),
};

const RequiredChecks = z.object(REQUIRED_CHECKS);

/** The checks classic protection names, in either of its two lists. */
const named = (r: z.infer<typeof RequiredChecks>) => new Set([...r.contexts, ...(r.checks ?? []).map((c) => c.context)]).size;

const Protection = z.object({ ...REQUIRED_CHECKS, strict: z.boolean() });

/** `branches/<base>`'s own view of its protection: the checks it requires, never whether they are strict. */
const Branch = z.object({
  protection: z.optional(z.object({ required_status_checks: z.optional(RequiredChecks) })),
});

/** A refusal stops the worker; a warning is logged and the worker starts. */
export type Reason = { kind: "refusal" | "warning"; text: string };

/**
 * Why the base's required checks leave auto-merge unsafe, from `rules/branches/<base>`, the
 * classic `protection/required_status_checks` and `branches/<base>`, each null when unreadable:
 * a repo without classic protection gets a 404, and so does a token that can't administer it. A
 * source passes only when it names a check and requires branches up to date, or two PRs green
 * alone could merge into a red base. With the protection unreadable, `branches/<base>` still
 * names the checks it requires but not whether they are strict: that unknown only warns.
 */
export function checksReason(
  repo: string,
  base: string,
  [rules, protection, branch]: [string | null, string | null, string | null],
): Reason | null {
  const sources = [
    ...(rules === null ? [] : z.parse(BranchRules, JSON.parse(rules)))
      .filter((r) => r.type === "required_status_checks")
      .map((r) => ({
        checks: r.parameters?.required_status_checks?.length ?? 0,
        strict: r.parameters?.strict_required_status_checks_policy ?? false,
      })),
    ...(protection === null ? [] : [z.parse(Protection, JSON.parse(protection))]).map((p) => ({
      checks: named(p),
      strict: p.strict,
    })),
  ].filter((s) => s.checks > 0);

  if (sources.some((s) => s.strict)) return null;
  const seen = branch === null ? undefined : z.parse(Branch, JSON.parse(branch)).protection?.required_status_checks;

  if (protection === null && seen !== undefined && named(seen) > 0)
    return {
      kind: "warning",
      text: `${repo} ${base}'s branch protection requires checks, but this token can't read whether it requires branches up to date. If it doesn't, two PRs green alone can merge into a red ${base}.`,
    };

  if (sources.length === 0)
    return {
      kind: "refusal",
      text: `${repo} ${base} requires no checks, so auto-merge would merge unchecked code. Require a check on ${base} first.`,
    };

  return {
    kind: "refusal",
    text: `${repo} ${base} requires checks but not branches up to date before merging, so two PRs green alone can merge into a red ${base}. Turn on "Require branches to be up to date before merging" where ${base} requires the check: strict_required_status_checks_policy in its ruleset, or required_status_checks.strict in its branch protection.`,
  };
}

async function branchReads(repo: string, base: string): Promise<[string | null, string | null, string | null]> {
  const read = async (path: string) => {
    const r = await run(["gh", "api", path]);

    return r.exitCode === 0 ? r.stdout : null;
  };

  return Promise.all([
    read(`repos/${repo}/rules/branches/${base}`),
    read(`repos/${repo}/branches/${base}/protection/required_status_checks`),
    read(`repos/${repo}/branches/${base}`),
  ]);
}

export async function refusals(
  repo: string,
  base: string,
  rules: Rules,
  app: App,
): Promise<{ refusals: string[]; warnings: string[] }> {
  const user = await settings(join(homedir(), ".claude", "settings.json"));

  const bot = await botFor(app, repo).then(
    (b) =>
      b.name === rules.bot
        ? ""
        : `the App acts as ${b.name}, but the rules file names ${rules.bot}`,
    (err: Error) => `the factory's GitHub App can't act on ${repo}: ${err.message}`,
  );

  const checks = checksReason(repo, base, await branchReads(repo, base));

  return {
    refusals: [
      loginRefusal(await run(["claude", "auth", "status"])),
      Object.entries(user.enabledPlugins ?? {}).some(([k, on]) => on && k.startsWith("factory@"))
        ? ""
        : "the factory plugin is not installed and enabled for your user, so runs load no factory hooks. Install it with /plugin.",
      checks?.kind === "refusal" ? checks.text : "",
      bot,
    ].filter((r) => r !== ""),
    warnings: checks?.kind === "warning" ? [checks.text] : [],
  };
}
