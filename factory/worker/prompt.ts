/**
 * The prompt a factory run starts from. A restarted run gets the same prompt plus the sealed plan
 * and the newest handoff, so it goes on from written work, never from a saved conversation.
 */

import {
  approvalQuestion,
  APPROVE,
  type Handoff,
  type Plan,
} from "../lib/formats.ts";
import { HANDOFF_PATH, PLAN_PATH } from "../lib/plan.ts";
import type { Rules } from "../lib/rules.ts";

export type RunInput = {
  repo: string;
  issue: number;
  title: string;
  body: string;
  notes: { author: string; body: string }[];
  plan: Plan | null;
  handoff: Handoff | null;
  rules: Rules;
  cli: string;
};

const list = (xs: readonly string[]) =>
  xs.length === 0 ? "(none)" : xs.map((x) => `- ${x}`).join("\n");

export function runPrompt(i: RunInput): string {
  const f = i.cli;

  const resume =
    i.plan === null
      ? ""
      : `
## You are continuing this issue
An earlier session started it and stopped. Go on from what is written; don't redo it.
- The branch already holds its commits.
- The plan (${i.plan.approved === i.plan.seal ? "approved" : "NOT approved yet"}):

${i.plan.text}

- The newest handoff:

${i.handoff?.text ?? "(none)"}
`;

  return `You are a factory run for issue #${i.issue} in ${i.repo}. No one watches this session live.
You are on branch factory/${i.issue}, which claims the issue. Work only here.

## The issue
# ${i.title}

${i.body}

## Notes people left on it
${i.notes.map((n) => `@${n.author}: ${n.body}`).join("\n\n") || "(none)"}
${resume}
## How to work
Use the hope:compose skill to plan which hope skills this issue needs and run each as its condition arrives.

1. Plan at design level. Write ${PLAN_PATH} with these sections, each filled:
   \`## Types\` (types added or changed), \`## Signatures\` (functions added or changed), \`## Files\` (one \`- path\` per file you will touch).
   Follow these design rules from the project: ${list(i.rules.layers.plan)}
2. Post it: \`${f} plan\`. It refuses a plan missing a section, or one whose files overlap an open PR's; fix it or stop as it says.
3. Ask for approval with AskUserQuestion, exactly: question "${approvalQuestion(i.issue, "<seal>")}" (the 8-character seal \`plan\` printed), options "${APPROVE}" and "Change". Build nothing before the answer is "${APPROVE}". On "Change", rework the plan and go back to step 2.
4. Every choice you make without asking (a name, a data shape, a library, where code lives) is a call. Post each: \`${f} call --choice "<what was open>" --picked "<what you chose>" --other "<an option you did not pick>" --why "<why this one>" --undo "<what reversing it takes>"\`, with one --other per option you passed over.
   Ask (AskUserQuestion) only when undoing the choice costs more than asking. In the same message, say in one or two sentences why you ask: the human reads it beside the choices.
   An ask goes to the issue: when the refusal says it is posted, end your turn at once; the answer arrives as your next message. If it says the waits are used up, take your recommended pick and post it as a call.
5. Build against the approved plan. If the plan must change, edit ${PLAN_PATH}, post it again and ask again: an edit revokes the approval.
6. Commit and push to factory/${i.issue} as you go. After each push write ${HANDOFF_PATH} (what is done, what is left, any step cut off) and run \`${f} handoff\`.
7. When the project's checks pass locally, run \`${f} pr\`. It opens the PR and turns on auto-merge. Then \`gh pr checks --watch\`; on a failure, fix and push.
   Use hope:judge on the diff: does it meet the issue and these rules? ${list(i.rules.layers.judge)}
   Post the verdict as a PR comment. It is advice and never holds the merge.
8. After 2 failed fixes of the same failure, run \`${f} stuck "<the reason, in one line>"\` and stop.

Comments on the issue reach you as notes while you work; follow them.
When the PR is open and its checks pass, or you ran \`${f} stuck\`, end your turn.`;
}
