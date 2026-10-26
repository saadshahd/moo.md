/** Why the worker must not start on this machine and repo; each reason says how to fix it. */

import { homedir } from "node:os";
import { join } from "node:path";
import type { Rules } from "../lib/rules.ts";
import * as z from "../lib/vendor/zod-mini.js";
import { botFor, type App } from "./app.ts";
import { run } from "./proc.ts";

const Settings = z.object({
  env: z.optional(z.record(z.string(), z.string())),
  apiKeyHelper: z.optional(z.nullable(z.string())),
  enabledPlugins: z.optional(z.record(z.string(), z.boolean())),
});

type Settings = z.infer<typeof Settings>;

async function settings(path: string): Promise<Settings> {
  const f = Bun.file(path);

  return (await f.exists()) ? z.parse(Settings, await f.json()) : {};
}

/** Every file whose settings a `claude --bg` run in `dir` takes. */
const SETTINGS = (dir: string) => [
  join(homedir(), ".claude", "settings.json"),
  join(dir, ".claude", "settings.json"),
  join(dir, ".claude", "settings.local.json"),
];

/** Each answers with a count only on success; a repo without classic protection gets a 404. */
async function requiredChecks(repo: string, base: string): Promise<number> {
  const asks = [
    [
      `repos/${repo}/rules/branches/${base}`,
      '[.[] | select(.type == "required_status_checks")] | length',
    ],
    [
      `repos/${repo}/branches/${base}/protection/required_status_checks`,
      ".contexts | length",
    ],
  ];

  const counts = await Promise.all(
    asks.map(async ([path, jq]) => {
      const r = await run(["gh", "api", path!, "--jq", jq!]);

      return r.exitCode === 0 ? Number(r.stdout.trim()) || 0 : 0;
    }),
  );

  return counts.reduce((a, b) => a + b, 0);
}

export async function refusals(
  dir: string,
  repo: string,
  base: string,
  rules: Rules,
  app: App,
): Promise<string[]> {
  const files = await Promise.all(
    SETTINGS(dir).map(async (p) => ({ p, s: await settings(p) })),
  );

  const user = files[0]!.s;

  const bot = await botFor(app, repo).then(
    (b) =>
      b.name === rules.bot
        ? ""
        : `the App acts as ${b.name}, but the rules file names ${rules.bot}`,
    (err: Error) =>
      `the factory's GitHub App can't act on ${repo}: ${err.message}`,
  );

  return [
    process.env.ANTHROPIC_API_KEY
      ? "ANTHROPIC_API_KEY is set; it silently overrides your subscription. Unset it."
      : "",
    ...files.flatMap(({ p, s }) => [
      s.env?.ANTHROPIC_API_KEY
        ? `${p} sets ANTHROPIC_API_KEY; runs would bill the API. Remove it.`
        : "",
      s.apiKeyHelper
        ? `${p} sets apiKeyHelper; runs would bill the API. Remove it.`
        : "",
    ]),
    user.env?.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS === "1"
      ? ""
      : 'runs load no factory hooks: set "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" under env in ~/.claude/settings.json.',
    Object.entries(user.enabledPlugins ?? {}).some(
      ([k, on]) => on && k.startsWith("factory@"),
    )
      ? ""
      : "the factory plugin is not installed and enabled for your user, so runs load no factory hooks. Install it with /plugin.",
    (await requiredChecks(repo, base)) > 0
      ? ""
      : `${repo} ${base} requires no checks, so auto-merge would merge unchecked code. Require a check on ${base} first.`,
    bot,
  ].filter((r) => r !== "");
}
