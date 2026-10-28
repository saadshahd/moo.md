/**
 * The prompt a factory run starts from. A restarted run gets the same prompt plus the sealed plan
 * and the newest handoff, so it goes on from written work, never from a saved conversation.
 */

import { usage } from "../lib/commands.ts";
import { branchFor } from "../lib/github.ts";
import { HANDOFF_PATH, PLAN_PATH, PR_PATH } from "../lib/plan.ts";
import type { Rules } from "../lib/rules.ts";
import { APPROVAL_QUESTION, APPROVE } from "../lib/wait.ts";

export type RunInput = {
  repo: string;
  issue: number;
  title: string;
  body: string;
  notes: { author: string; body: string }[];
  plan: { text: string; approved: boolean } | null;
  handoff: string | null;
  rules: Rules;
  cli: string;
};

const list = (xs: readonly string[]) =>
  xs.length === 0 ? "(none)" : xs.map((x) => `   - ${x}`).join("\n");

export function runPrompt(i: RunInput): string {
  const u = usage(i.cli);

  const resume =
    i.plan === null
      ? ""
      : `
## You are continuing this issue
An earlier session stopped; the branch holds its commits. Go on from them; don't redo work.

The plan (${i.plan.approved ? "approved" : "NOT approved yet"}):

${i.plan.text}

The newest handoff:

${i.handoff ?? "(none)"}
`;

  return `You are a factory run for issue #${i.issue} in ${i.repo}. No one watches this session live.
Work only on branch ${branchFor(i.issue)}. Run the issue with hope:compose.

## The issue
# ${i.title}

${i.body}

## Notes from people (more arrive while you work; follow them)
${i.notes.map((n) => `@${n.author}: ${n.body}`).join("\n\n") || "(none)"}
${resume}
## Factory steps
1. Write ${PLAN_PATH} with the sections \`## Types\`, \`## Signatures\` and \`## Files\` (one \`- path\` per line).
   The project's plan rules:
${list(i.rules.layers.plan)}
2. Run \`${u.plan}\`.
3. Ask with AskUserQuestion: question "${APPROVAL_QUESTION}", options "${APPROVE}" and "Change". Build nothing before "${APPROVE}". On "Change", rework the plan and go to step 2.
   Build what the approved plan says; to change it, edit the plan and go to step 2.
4. Post each choice you make without asking: \`${u.call}\`, one --other per option you passed over.
   Ask only when undoing a choice costs more than asking, and say why in one or two sentences in the same message.
   An ask goes to the issue; the answer arrives as your next message.
5. Commit and push as you go. After each push, write ${HANDOFF_PATH} (what is done, what is left, any step cut off) and run \`${u.handoff}\`.
6. When the checks pass locally, write ${PR_PATH}: the PR's body, as the project's own PR rules ask for one. Then run \`${u.pr}\`.
7. Post a verdict on the diff as a PR comment: does it meet the issue and these rules?
${list(i.rules.layers.judge)}
   The verdict never holds the merge.
8. After 2 failed fixes of the same failure, run \`${u.stuck}\` and stop.

End your turn after step 7 or step 8, and never wait on the PR's checks: the worker wakes you when a required check fails, the PR conflicts with the base, or a review asks for changes.`;
}
