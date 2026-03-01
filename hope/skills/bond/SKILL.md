---
name: bond
description: Design and create agent teams for a task. Use when "set up a team", "team for this", "should I use agents", "design a team", "how many agents", "agent team".
---

Assess whether a task benefits from parallel agents. Design roles and boundaries. Create the team. Prevent merge conflicts over maximizing parallelism.

## How

1. **Assess fitness** — Most tasks are better solo. A team only pays off with genuine independence across modules.

   Ask about the task:
   - Can workers operate without each other's output?
   - Do they touch different files?
   - Is scope multi-module (8+ story points)?

   If any answer is no on file ownership → solo. If ≤3 story points → just do it.

2. **Design team** — If team is warranted:
   - 2-5 teammates, one per independent workstream
   - Each role owns distinct files — no overlap
   - Name roles by responsibility ("auth-impl", "api-reviewer"), never generic
   - Models: Opus for architecture/review, Sonnet for implementation, Haiku for research
   - Coupling check: for each role pair, "if A changes X, does B break?" If yes → merge roles

3. **Create** — Present blueprint to user. On approval:
   - Create team with TeamCreate
   - Spawn each role as an Agent with clear scope, owned files, and task list
   - If a persistent agent file fits a role, use it

   On rejection → suggest solo or subagent approach instead.

## Boundaries

User approves before any team is created. Bond recommends; user decides.
