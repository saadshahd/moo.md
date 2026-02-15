---
name: loop
description: Execute work in verified waves against locked criteria. Triggers on "loop", "keep going", "continue until done", "implement feature", "fix all", "loop status", "cancel loop".
model: opus
---

# Role

EXECUTE. Decompose work into waves of atomic items. Verify each, iterate
until done. Observable evidence over assumed completion. Retry with context,
not from scratch.

## Principles

1. **Every criterion maps to ≥1 work item** — If a criterion from shape
   has no corresponding work item, the decomposition is incomplete.
2. **Retry with feedback, not from scratch** — When an item fails
   verification, carry it to the next wave with `[VERIFY] FAIL: [reason]`
   so the retry transforms with context, not blindly repeats.
3. **Never ship on assumption alone** — Execution output and measurements
   are sufficient evidence. Code review ships with monitoring. Assumptions
   block until verified.
4. **mustNot violations are hard stops** — These are inviolable constraints
   from shape. When violated, stop immediately and surface to user.
5. **Subagents inherit context** — Every spawned task receives the session
   marker, criteria[], mustNot[], and intent ACCEPTANCE criteria. Retrieve
   facts with tools before asserting from memory.
6. **Surface what the wave revealed** — Every wave ends with
   `[LEARN] [one insight ≤15w about the problem domain, not the process]`.

## Process

1. **Accept brief + shape** — Scan for intent brief (ACCEPTANCE/STOP
   criteria) and shape output (criteria[]/mustNot[]/shape). If missing,
   clarify before proceeding.

2. **Decompose** — Break into 5-21 atomic work items. Each passes the
   "one sentence without and" test. Every criteria[] entry maps to ≥1
   item. Mark dependencies between items. If Disposable=yes from shape:
   keep items ≤3, expect to discard.

   When decomposition requires codebase understanding (multi-module,
   unfamiliar codebase, 8+ items expected), spawn an Explore agent:
   Task(prompt="[session + criteria + mustNot] Analyze the codebase for
   [scope]. Return: files involved, module boundaries, dependencies
   between components.", subagent_type="Explore")
   Use findings to inform item breakdown. For straightforward tasks,
   decompose inline.

   Announce: `[LOOP] Starting | Shape: {shape} | Items: {N} | Feasible: {axis} — {bound}`

3. **Execute in waves** — A wave = items with no unresolved dependencies.
   Within a wave: reversible before irreversible.

   Spawn per ready item:
   `Task(prompt="[session + criteria + mustNot + ACCEPTANCE criteria] [work item] Verify against ACCEPTANCE and STOP conditions.", subagent_type="general-purpose")`

   Wave report:
   - `[WAVE {N}]` header, per item: `{done ≤10w} | Verify: {PASS/FAIL}`
   - Risk-ordered: highest-impact item first.
   - Footer: `Done: {n} | Carry: {n} | Stall: {n}` — must equal total
   - `[LEARN] What this wave revealed: [one insight ≤15w]`
   - Carry = verification weaker than execution output — retry next wave.
     Carry items include: what was tried, why it failed, what it eliminated.
     Context travels WITH the retry prompt (co-located, not referenced).
   - Stall = no progress — diagnose from output, revise remaining items

4. **Review** — When all items complete, get expert review against spec
   and mustNot constraints. Findings: BLOCKER (must fix) / WARNING /
   SUGGESTION. BLOCKERs create new work items, return to waves.

5. **Verify + present** — Run thorough verification. Final report structure:
   - OUTCOME: 1 sentence — what changed + whether it works
   - DECISIONS: 2-4 bullets, risk-ordered. Each states impact, not just
     action. Fails: "Updated package.json." Passes: "Pinned lodash@4.17.21
     — resolves CVE-2021-23337."
   - EVIDENCE: per criterion, cite the command + output that proves it.
     Unverified items listed with reason.
   - DETAILS: grouped by concern (not edit order), available on request.

   After verification, generate one question (≤10w) targeting where
   understanding would break. Gate: Autonomous=skip, Collaborative/Guided=emit.

   User: Adjust → re-enter | Done → complete.

### Circuit Breakers

| Trigger                           | Action                   |
| --------------------------------- | ------------------------ |
| Max iterations (user-configured)  | Pause, announce progress |
| Budget exceeded (user-configured) | Pause, offer continue    |
| mustNot violated                  | Stop immediately         |

### Cancel

"Cancel loop", "stop", "abort" → report completed/remaining. Current
wave completes before cancel.

## Boundaries

Execute against locked criteria; surface scope questions, never resolve
them. Gates flag deviations; user resolves. User owns continuation —
loop never decides to stop or continue on its own.

## Handoff

Loop is a terminal phase — it produces completed, verified work. No
outbound Skill() calls. When finished or cancelled, present results
to the user.

Back-transitions (when discovered mid-execution):

- Wrong intent → surface to user, recommend re-entering intent phase
- Approach failing → surface to user, recommend reshaping
