/**
 * The settings every run starts under, so the App's key stays out of the run's reach. Bash runs
 * in Claude Code's sandbox (Seatbelt on macOS, bubblewrap on Linux), which can't read the key's
 * folder and can't be turned off; a `Read` rule shuts the folder to the file tools. The run hooks
 * mint the bot's token through `$.process.run`, outside the sandbox. A machine with no sandbox
 * fails the run's commands rather than running them unsandboxed. The rules add the repo's own
 * hosts and folders, never the key's folder.
 */

import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { RULES_PATH, type Rules } from "../lib/rules.ts";
import { APP_DIR } from "./app.ts";

/** Whether `path` is `folder` or sits inside it. */
function inside(path: string, folder: string): boolean {
  const rel = relative(folder, path);

  return rel !== ".." && !rel.startsWith("../");
}

/**
 * A rules path a run may write, or a throw when writing there could replace the App's key or
 * `app.json`: its folder, one holding it, or one inside it. A glob counts as all of the folder
 * its first wildcard sits in, and a relative path, with no place to compare, is refused.
 */
function writable(path: string): string {
  const wild = path.search(/[*?[{]/);
  const folder = wild < 0 ? path : path.slice(0, path.lastIndexOf("/", wild) + 1);
  const full = folder === "~" || folder.startsWith("~/") ? join(homedir(), folder.slice(1)) : folder;

  if (!isAbsolute(full)) throw new Error(`${RULES_PATH} sandbox.paths: ${path} is relative; start it at / or ~`);
  const key = join(homedir(), APP_DIR);

  if (inside(full, key) || inside(key, full))
    throw new Error(`${RULES_PATH} sandbox.paths: ${path} would let a run write the App's key folder ~/${APP_DIR}`);

  return path;
}

export function runSettings(rules: Rules) {
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      /** On macOS, lets Go tools such as `gh` reach the TLS trust service, without which they fail every TLS check. */
      enableWeakerNetworkIsolation: true,
      filesystem: {
        denyRead: [`~/${APP_DIR}`],
        allowWrite: ["~/.bun", "~/.npm", "~/.cache", ...(rules.sandbox?.paths ?? []).map(writable)],
      },
      network: {
        allowedDomains: [
          "github.com",
          "api.github.com",
          "*.githubusercontent.com",
          "registry.npmjs.org",
          "api.anthropic.com",
          ...(rules.sandbox?.domains ?? []),
        ],
      },
    },
    permissions: { deny: [`Read(~/${APP_DIR}/**)`] },
    /**
     * A project's own settings may name an editor that waits for a window (`code --wait`); a run
     * has none, so its `git merge` would wait for good. `--settings` outranks project settings.
     */
    env: { GIT_EDITOR: "true" },
  };
}
