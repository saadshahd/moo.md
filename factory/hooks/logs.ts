import type { EngineInterface, ToolCallResult } from "claude-code";
import { cutToFailures, isTestCommand } from "../lib/logs.ts";
import { currentRun, showOnce, type PassOn, type ToolCall } from "./session.ts";

type Bash = ToolCall<"Bash">;

/**
 * A failed test run in a factory run reaches the agent cut to its failures. Only a failed run is
 * cut: passing output may still hold words like "0 fail". The cut comes back as a deny, which the
 * model reads as the tool's error result; the command has run, and nothing it did is undone. A
 * failed Bash raises `PostToolUseFailure`, which can't replace the output, and a `text` rewritten
 * here is ignored.
 */
export async function cutFailedTests(
  $: EngineInterface,
  e: Bash,
  next: PassOn<Bash>,
): Promise<ToolCallResult> {
  const r = await next(e);

  if (r.deny !== undefined || !r.isError || !isTestCommand(e.command)) return r;

  try {
    if (!(await currentRun($))) return r;
    const whole = r.text ?? "";
    const cut = cutToFailures(whole);

    return cut === whole ? r : { deny: cut };
  } catch (err) {
    await showOnce($, String(err));

    return r;
  }
}
