import type { EngineInterface, ToolCallResult } from "claude-code";
import { latest } from "../lib/github.ts";
import { PLAN_PATH, planText } from "../lib/plan.ts";
import { actorsOf, readRules } from "../lib/rules.ts";
import { comments } from "../lib/snapshot.ts";
import { approved } from "../lib/wait.ts";
import { currentRun, runner, showOnce, type PassOn, type ToolCall } from "./session.ts";

type FileEdit = ToolCall<"Edit" | "Write" | "NotebookEdit">;

/**
 * After a file tool changes an approved plan, the agent hears that the approval no longer holds.
 * Nothing on GitHub changes: an approval names its plan's seal, and the changed plan has a new one.
 * An edit made through Bash slips past this; `factory pr` still compares the plan with its seal.
 */
export async function revokeEditedPlan<E extends FileEdit>(
  $: EngineInterface,
  e: E,
  next: PassOn<E>,
): Promise<ToolCallResult> {
  const r = await next(e);
  const path = e.tool === "NotebookEdit" ? e.notebook_path : e.file_path;

  if (r.deny !== undefined || r.isError || !path.endsWith(PLAN_PATH)) return r;

  try {
    const fr = await currentRun($);

    if (!fr) return r;
    const run = runner($);
    const actors = actorsOf(await readRules(run, fr.cwd), fr.repo);
    const cs = await comments(run, fr.repo, fr.issue);
    const plan = latest(cs, actors, "plan");

    if (
      !plan ||
      !approved(cs, actors, plan.c.seal) ||
      planText(await $.fs.read(path)) === plan.c.text
    )
      return r;

    return {
      ...r,
      context: [
        ...(r.context ?? []),
        "You changed the approved plan, so its approval no longer holds. Post it again with `factory plan` and ask for approval before building on it.",
      ],
    };
  } catch (err) {
    await showOnce($, String(err));

    return r;
  }
}
