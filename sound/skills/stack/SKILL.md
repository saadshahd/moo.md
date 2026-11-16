---
name: stack
description: Find a tool for each step this project still does by hand, and write the picks into CLAUDE.md under `## Tools` for you to review in the diff.
disable-model-invocation: true
---

# sound:stack

Edit nothing except the project-root `CLAUDE.md`. Install nothing. Change no manifest.

## Gaps

Read the manifests, scripts, CI, README hand-steps, and the goals in the instruction files. List each step a human still does by hand.

A step whose doing is a decision, or builds the user's understanding, is kept by the user: it gets no tool.

## Picks

1. Write your own pick for each gap from memory, one line each, before any search.
2. Run `sound:find` once per gap, one subagent per gap, all in one message so they run in parallel. Each gets the gap as its need, the project's current tool, and your memory pick.

## Write

Put one line per gap under `## Tools` in the project-root `CLAUDE.md`, in the working tree: create the file, or merge into the existing `## Tools` and keep its lines.

```text
<step>: use <owner/repo>; run <first command> first
```

A gap where `sound:find` names no tool gets no line.

The first command is read-only (help, version, skills listing) and runs the installed binary, never `npx` or `curl | sh`: later sessions run it unasked, and a tool not yet installed then fails loudly.

## Chat

Everything else goes in chat only:

- install commands
- evidence per pick: memory pick against found, the latest version's age, weekly downloads (npm only), license
- rejected tools, each with its reason
- steps kept by the user
- substrate changes

End on what is now settled and what is still open.
