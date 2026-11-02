import type { Register } from "claude-code";
import { askOnIssue } from "./ask.ts";
import { cutFailedTests } from "./logs.ts";
import { passNewNotes } from "./notes.ts";
import { revokeEditedPlan } from "./seal.ts";

/**
 * The run hooks. In a session that is no factory run each passes its event straight on; when one
 * fails, the tool still runs and the failure shows once. The engine loads one `tool.call` hook per
 * matcher; the hook on every tool passes new notes on after the tool runs.
 */
export const register: Register = (on) => {
  on("tool.call", async ($, e, next) => passNewNotes($, await next(e)));
  on("tool.call", { tool: "AskUserQuestion" }, askOnIssue);
  on("tool.call", { tool: "Bash" }, cutFailedTests);
  on("tool.call", { tool: "Edit" }, revokeEditedPlan);
  on("tool.call", { tool: "Write" }, revokeEditedPlan);
  on("tool.call", { tool: "NotebookEdit" }, revokeEditedPlan);
};
