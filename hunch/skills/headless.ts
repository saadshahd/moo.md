/**
 * Runs hunch's own code in a headless session, for an eval: a scratch copy of hunch whose hooks module is
 * the eval's, beside hunch's own hooks, and one slash command that module adds, run with `claude -p`.
 */
import { $ } from "bun";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HUNCH = resolve(import.meta.dir, "..");

/** A scratch hunch whose hooks module is `module`: TypeScript that registers hunch's hooks from
 * "./index.tsx" and adds the eval's command. Tests stay behind. */
export function scratchHunch(module: string): string {
  const plugin = mkdtempSync(join(tmpdir(), "hunch-eval-"));
  cpSync(join(HUNCH, "hooks"), join(plugin, "hooks"), {
    recursive: true,
    filter: (f) => !f.endsWith(".test.ts"),
  });
  const { types } = JSON.parse(
    readFileSync(join(HUNCH, ".claude-plugin/plugin.json"), "utf8"),
  );
  if (types) cpSync(join(HUNCH, types), join(plugin, types));
  mkdirSync(join(plugin, ".claude-plugin"));
  writeFileSync(
    join(plugin, ".claude-plugin/plugin.json"),
    JSON.stringify({
      name: "hunch",
      version: "0.0.0",
      description: "Runs one of hunch's evals",
      ...(types && { types }),
    }),
  );
  writeFileSync(
    join(plugin, "hooks/hooks.json"),
    JSON.stringify({ modules: ["./eval.tsx"] }),
  );
  writeFileSync(join(plugin, "hooks/eval.tsx"), module);
  return plugin;
}

/** Runs `/<command>` headless in `plugin`, with no settings and no MCP server; throws unless it
 * exits 0 and writes `to`. */
export async function runHeadless(plugin: string, command: string, to: string) {
  const r =
    await $`claude -p --setting-sources "" --strict-mcp-config --no-session-persistence --plugin-dir ${plugin} ${`/${command}`}`
      .env({ ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" })
      .nothrow()
      .quiet();
  if (r.exitCode !== 0 || !existsSync(to))
    throw new Error(
      `${to} got nothing (exit ${r.exitCode}): ${r.stderr.toString() || r.stdout.toString()}`,
    );
}
