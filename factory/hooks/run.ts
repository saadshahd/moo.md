import type { Register } from "claude-code";
import { askOnIssue } from "./ask.ts";
import { actAsBot } from "./bot.ts";
import { cutFailedTests } from "./logs.ts";
import { passNewNotes } from "./notes.ts";
import { revokeEditedPlan } from "./seal.ts";

/**
 * The run hooks. In a session that is no factory run each passes its event straight on; when one
 * fails, the tool still runs and the failure shows once. The engine loads one `tool.call` hook per
 * matcher, so the hook on every tool does both of its steps, and the first registered runs
 * outermost: the bot's login is in place before any other hook reaches GitHub.
 */
export const register: Register = (on) => {
  on("tool.call", async ($, e, next) =>
    passNewNotes($, await actAsBot($, e, next)),
  );
  on("tool.call", { tool: "AskUserQuestion" }, askOnIssue);
  on("tool.call", { tool: "Bash" }, cutFailedTests);
  on("tool.call", { tool: "Edit" }, revokeEditedPlan);
  on("tool.call", { tool: "Write" }, revokeEditedPlan);
  on("tool.call", { tool: "NotebookEdit" }, revokeEditedPlan);
};
