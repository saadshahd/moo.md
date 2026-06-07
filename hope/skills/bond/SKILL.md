---
name: bond
description: Assesses orchestration fitness and authors execution workflows. Use when "should I use agents", "parallelize this", "fan out", "orchestrate this", "team for this", "how many agents".
---

Assess whether a task benefits from parallel fan-out. Most tasks are better solo. A workflow only pays off with genuine independence across modules.

## Presentation

- **Minto pyramid via AskUserQuestion** — Label = recommendation (conclusion first). Description = one-line tradeoff (always visible). Detail panel = structured plain text, short lines (~50 chars), ALL CAPS for section headers, dashes for bullets. No markdown in detail panels.
- **Minimal text between prompts** — One bold sentence framing, then AskUserQuestion. Nothing else.
- **Infer, state, ask only if ambiguous** — Assess fitness yourself. Present your assessment as a choice, not a question.

## Workflow

### Step 1: Assess

Read the task scope. Evaluate internally:
- Can workstreams run without each other's output?
- Do they touch different files?
- Is scope multi-module (8+ story points)?

Search the codebase to identify module boundaries and file ownership zones.

If any answer is no on file independence, fitness = solo. If scope is 3 or fewer story points, fitness = solo. Otherwise, fitness = workflow.

Do not output assessment reasoning in any form — no headers, no bullet points, no labeled sections. Go straight to Step 2.

### Step 2: Choose mode

**One bold sentence stating your assessment**, then AskUserQuestion with two options:

- **Workflow (Recommended)** or **Solo (Recommended)** — whichever fitness determined. Label the recommended option. Description = one-line why.
  - Detail panel: workstream count, story point estimate, file independence summary
- **Solo** or **Workflow** — the non-recommended alternative.
  - Detail panel: what you gain and pay choosing this over the recommendation

If user picks Solo, state the approach in one sentence. Done.

If user picks Workflow, proceed to Step 3.

### Step 3: Design workstreams

Identify 2-5 independent workstreams from the task. For each:
- Name by responsibility (never generic)
- Owned files (no overlap between workstreams)
- Stage shape: what each item passes through (find → transform → verify), where verification happens

Run coupling check internally: for each pair, "if A changes X, does B break?" Merge workstreams where yes.

If shared files remain after merging, plan worktree isolation for those agents — or drop to solo if isolation costs more than parallelism gains.

### Step 4: Present blueprint

**One bold sentence: "N workstreams, zero file overlap."** Then present workstreams via AskUserQuestion (multiSelect) so the user reviews all at once:

- Label: workstream name
- Description: owned files (short path list)
- Detail panel:

```
OWNS:
  - path/to/files

TASK:
  - what this workstream produces

VERIFIED BY:
  - stage or check that confirms it
```

After user reviews, present a separate AskUserQuestion:
- **Approve and author** — proceed to Step 5
- **Adjust a workstream** — modify, then re-present
- **Cancel** — exit without authoring

### Step 5: Author

If plan mode is active: write the orchestration spec to the plan file — workstreams, owned files, stage shape, verification plan. State that the workflow runs after plan approval. Done.

If not in plan mode: author the Workflow script from the blueprint and run it. Record steering choices in `meta.decisions`. The steer hook's review protocol governs fan-out, verification depth, and output caps — answer it, don't bypass it. If the protocol isn't in context (latch consumed earlier, then compacted away), read `hooks/steer.md` at the hope plugin root before authoring.

No output beyond confirmation that the workflow is running.

## Boundaries

User approves before any workflow runs. Bond assesses and recommends; user decides mode and boundaries. Bond asks only bond questions — scope, requirements, and approach belong to intent and shape. Workflows are the only parallel mechanism — never TeamCreate or agent teams.
