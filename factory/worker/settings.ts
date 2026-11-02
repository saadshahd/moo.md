/**
 * How a run starts. A run acts as the user, so what keeps it to the factory's own GitHub writes is
 * Claude Code's permission check: deny rules stop the plain forms of a GitHub write before anything
 * else, and auto mode's classifier judges every shell command against the rules below, with the
 * user's own allow rules set aside. Neither is a wall: a deny rule matches text, and the classifier
 * judges.
 */

import { gitConfigEnv } from "../lib/git.ts";

/** The shell commands that write to GitHub, or read the login that could; a run has `push` and `pr`. */
const GITHUB_WRITES = [
  "gh issue",
  "gh label",
  "gh api",
  "gh auth",
  "gh repo",
  "gh pr create",
  "gh pr comment",
  "gh pr review",
  "gh pr edit",
  "gh pr merge",
  "gh pr ready",
  "gh pr close",
  "git push",
] as const;

/** The flags every run starts with; `cli` is how the run starts `worker/cli.ts`. */
export function runFlags(cli: string): string[] {
  const settings = {
    /**
     * A project's own settings may name an editor that waits for a window (`code --wait`); a run
     * has none, so its `git merge` would wait for good. `--settings` outranks project settings.
     * A run's git takes the worker's git config too, whatever the run's shell profile resets.
     */
    env: { GIT_EDITOR: "true", ...gitConfigEnv() },
    permissions: { deny: GITHUB_WRITES.map((c) => `Bash(${c} *)`) },
    autoMode: {
      classifyAllShell: true,
      environment: [
        "A session named factory:<repo>#<n> is an unattended factory run on branch factory/<n>; nobody watches it, and its person approves plans only in the /factory pane.",
      ],
      allow: [
        "$defaults",
        `Running the factory's own commands (${cli} plan, call, handoff, push, pr, stuck) is the run's routine work, GitHub writes included.`,
        "Reading the run's own PR and its checks on GitHub (gh pr checks, gh pr view, gh run view, --log-failed included) is routine: the factory asks the run to read failed checks and fix them.",
      ],
      hard_deny: [
        "$defaults",
        "Writing to GitHub other than through the factory's own commands: commenting on, labelling, creating, editing or closing issues or PRs, submitting reviews, pushing, or reading a GitHub token (gh auth token, the keychain, ~/.config/gh).",
        "Changing .claude/factory.json or any file under .github/workflows/.",
      ],
    },
  };

  return ["--permission-mode", "auto", "--settings", JSON.stringify(settings)];
}
