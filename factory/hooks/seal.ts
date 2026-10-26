import type { EngineInterface, ToolCallResult } from "claude-code";
import type { Plan } from "../lib/formats.ts";
import { comments, edit, latest } from "../lib/github.ts";
import { PLAN_PATH } from "../lib/plan.ts";
import { currentRun, runner, showOnce, type PassOn, type ToolCall } from "./session.ts";

type FileEdit = ToolCall<"Edit" | "Write" | "NotebookEdit">;

/**
 * After a file tool changes the run's plan, its approval is revoked. An edit made through Bash slips
 * past this; `factory pr` still compares the plan with its seal.
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
    const plan = latest(await comments(run, fr.repo, fr.issue), "plan");

    if (!plan || plan.c.approved === null) return r;
    await edit(run, fr.repo, plan.id, {
      ...plan.c,
      approved: null,
    } satisfies Plan);

    return {
      ...r,
      context: [
        ...(r.context ?? []),
        "You changed the approved plan, so its approval is revoked. Post it again with `factory plan` and ask for approval before building on it.",
      ],
    };
  } catch (err) {
    await showOnce($, String(err));

    return r;
  }
}
