/**
 * The settings every run starts under, so the App's key stays out of the run's reach. Bash runs
 * in Claude Code's sandbox (Seatbelt on macOS, bubblewrap on Linux), which can't read the key's
 * folder and can't be turned off; a `Read` rule shuts the folder to the file tools. The run hooks
 * mint the bot's token through `$.process.run`, outside the sandbox. A machine with no sandbox
 * fails the run's commands rather than running them unsandboxed.
 */

import { APP_DIR } from "./app.ts";

export const RUN_SETTINGS = {
  sandbox: {
    enabled: true,
    failIfUnavailable: true,
    allowUnsandboxedCommands: false,
    /** On macOS, lets Go tools such as `gh` reach the TLS trust service, without which they fail every TLS check. */
    enableWeakerNetworkIsolation: true,
    filesystem: {
      denyRead: [`~/${APP_DIR}`],
      allowWrite: ["~/.bun", "~/.npm", "~/.cache"],
    },
    network: {
      allowedDomains: [
        "github.com",
        "api.github.com",
        "*.githubusercontent.com",
        "registry.npmjs.org",
        "api.anthropic.com",
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
