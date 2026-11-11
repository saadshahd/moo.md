---
name: hum
description: Set hum up in this repo, or change how it is set up. Reads the repo, proposes every setting, asks only what you alone hold, writes .hum/hum.json and proves it on a scratch copy.
disable-model-invocation: true
---

Read first, then ask. Every question leads with what the repo showed and a proposal to accept or change.

## Read

Run `bunx hum setup scan` (the pinned engine: `bun add --exact @moo.md/hum@<version>` first if `package.json` has none). It prints the scan, a proposal for each setting, the waiting states, how many open issues the label map covers, and `gitIdentity`: the name and email hum will commit as, read from your git config. If `gitIdentity.found` is false, stop: tell the owner to set the `missing` keys with `git config --global <key> "<value>"` and ask nothing more. Answer nothing from the scan that the repo already says.

## Ask

Ask in this order. One question per turn, each with its proposal. Where a question is open-ended, call **hope:elicit**; where the answer is a rule others must apply the same way, call **hope:anchor**; where a setting steers unattended work, call **hope:target**.

| Ask | Proposal comes from | The answer sets |
| --- | --- | --- |
| Where runs happen: your Mac, CI, or both | the scan: CI workflows, a service unit | `runPlaces` |
| Which commands a change must pass | CI jobs on pull requests, else package scripts, after the lockfile install a fresh clone needs | `checks` |
| For CI runs: the repo's setting "Allow GitHub Actions to create and approve pull requests" | `workflowsMayOpenPullRequests` in the scan; if off, ask the owner to turn it on and never change it yourself | nothing written |
| For CI runs: how a pull request's required checks start | a pull request opened with the workflow token starts no workflows, and dispatching the check workflow does not satisfy the required check; ask for a GitHub App or fine-grained token as the repository secret `pullRequestTokenSecret` names | `pullRequestTokenSecret` |
| One question per waiting state: after how many hours it ends stuck | `waits` in the scan | `waitHours` |
| What each folder's risk is | folder history and names | `paths`, `strictPaths` |
| Which paths hold data or secrets | the scan's matches | `strictPaths` |
| How many merged changes judge a fix or a measure | the shipped windows | `changeLabels.fixWindow`, `measureWindow` |
| Which label means which kind | issue-template labels and repo labels | `kindLabels` |
| Services and setup each run slot needs | compose file, env script, install command | `runSlots` |
| The date the CI token expires, after `claude setup-token` | only the owner holds it | a reminder the owner keeps |

Say what the labels cover: "`kindLabels` covers N of M open issues; the rest get the fallback kind and one question."

## Write

1. Write the answers as JSON: `{ "hum": {settings}, "waitHours": { "kind/state": hours }, "schemaVersion": 1 }`.
2. Run `bunx hum setup write --answers <file>`. A refusal writes nothing: relay its message, which names the fix.
3. Run `bunx hum setup measure` to record each model's pass rate, so a check that cannot yet be trusted reports instead of gating.
4. Run `bunx hum setup prove`. Add `--item` only after the owner agrees to the live calls it spends.

End by stating what is now written, which proofs passed, and which were skipped and why.
