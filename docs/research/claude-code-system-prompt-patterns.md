# Claude Code System Prompt Patterns

Analysis of [claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — the extracted internal system prompts, tool descriptions, agent prompts, and skill definitions that power Claude Code. Patterns relevant to building moo/hope plugins.

## 1. Prompt Architecture

### Layered Composition

Claude Code assembles its system prompt from ~80 modular fragments, not one monolith. Each fragment has a single concern:

| Layer | Example files | Purpose |
|-------|--------------|---------|
| Identity | `system-prompt-main-system-prompt.md` | Core role + constraints |
| Tone | `system-prompt-tone-and-style.md` | Communication rules |
| Policy | `system-prompt-tool-usage-policy.md` | Tool routing decisions |
| Tasks | `system-prompt-doing-tasks.md` | How to approach work |
| Safety | `system-prompt-executing-actions-with-care.md` | Reversibility/blast radius |
| Reminders | `system-reminder-*.md` | Injected per-turn context |
| Tool docs | `tool-description-*.md` | Per-tool usage contracts |
| Agent prompts | `agent-prompt-*.md` | Subagent system prompts |
| Skills | `skill-*.md` | Loaded-on-demand capabilities |

**Takeaway for moo:** This validates our approach of separate SKILL.md files. But note Claude Code goes further — even within the main prompt, each concern is a separate file that gets composed. Consider whether hope skills could benefit from similar decomposition for shared concepts.

### Variable Interpolation

Every file uses template variables (`${TOOL_NAME}`, `${BASH_TOOL_NAME}`), never hardcoded tool names. This allows the same prompt to work across different configurations.

```markdown
<!-- ccVersion: 2.1.41 -->
<!-- variables: TASK_TOOL_NAME, READ_TOOL_NAME, EDIT_TOOL_NAME -->
```

**Takeaway for moo:** Our skills hardcode tool names like `Bash`, `Read`, `Grep`. This is fine for now since we target a single runtime, but worth noting as a pattern if portability ever matters.

## 2. Enforcement Techniques

### The Hierarchy of Directive Strength

Claude Code uses a consistent escalation pattern for how strongly it enforces behavior:

| Level | Pattern | Example |
|-------|---------|---------|
| Suggestion | "consider..." / "you may..." | "consider using the TodoWrite tool" |
| Default | "you should..." | "You should be collaborative" |
| Strong | "IMPORTANT:" prefix | "IMPORTANT: Always use this scratchpad directory" |
| Absolute | "MUST" / "NEVER" / "CRITICAL" | "you MUST NOT make any edits" |
| Blocking | "This supercedes any other instructions" | Plan mode read-only enforcement |

**Key insight:** The strongest enforcement always combines:
1. ALL-CAPS keyword (`CRITICAL`, `MUST`, `NEVER`)
2. Explicit scope ("this supercedes any other instructions")
3. Concrete forbidden actions list

Example from plan mode:
```
Plan mode is active. The user indicated that they do not want you to
execute yet -- you MUST NOT make any edits... This supercedes any
other instructions you have received.
```

**Takeaway for moo:** Our hooks use action directives ("invoke X now"), which the system prompts confirm is the right pattern. But we should adopt the supercession pattern for critical constraints — explicitly stating what they override.

### Explicit Deny Lists

Rather than trusting the model to infer boundaries, Claude Code lists exactly what's forbidden:

```markdown
=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state
```

**Takeaway for moo:** When we need to constrain behavior (like in consult or shape), enumerate forbidden actions. Don't rely on "be careful" — list what "careful" means.

### Positive + Negative Examples

Every major behavior gets both "when to use" and "when NOT to use" examples with reasoning:

```markdown
## When to Use This Tool
1. Complex multi-step tasks...

## When NOT to Use This Tool
1. There is only a single, straightforward task...
```

And each example includes a `<reasoning>` block explaining *why* the decision was made:

```xml
<reasoning>
The assistant used the todo list because:
1. Adding dark mode is a multi-step feature...
2. The user explicitly requested tests...
</reasoning>
```

**Takeaway for moo:** Our skills describe when to trigger but rarely explain when NOT to trigger. Adding explicit negative examples would reduce false activations.

### Repetition at Point of Use

Claude Code repeats key constraints in every file where they apply, rather than relying on one central definition. The parallel tool call instruction appears in at least 3 separate files. "No emojis" appears in 4+ places.

**Takeaway for moo:** Don't assume Claude remembers instructions from other skills. Repeat critical constraints in each skill that needs them. This is especially important post-compaction.

## 3. Skill Design Patterns

### Trigger-Description Pattern

The Skill tool description reveals exactly how skills are discovered and triggered:

```markdown
When users ask you to perform tasks, check if any of the available
skills match. Skills provide specialized capabilities and domain knowledge.

When a skill matches the user's request, this is a BLOCKING REQUIREMENT:
invoke the relevant Skill tool BEFORE generating any other response
```

Skills are listed in `<system-reminder>` tags. The trigger is the `description` field + the `when_to_use` field.

**Critical insight:** `BLOCKING REQUIREMENT` means the skill MUST be invoked before any response. This is the strongest trigger pattern available.

**Takeaway for moo:** Our `description` field in SKILL.md frontmatter serves this exact purpose. The "DESCRIPTION TRAP WARNING" in our CLAUDE.md is validated — process details in descriptions genuinely cause Claude to follow the short description instead of the full skill body.

### Skillify Pattern (Session → Skill)

The `system-prompt-skillify-current-session.md` reveals how Claude Code converts sessions into reusable skills. Key structural elements:

**Frontmatter spec:**
```yaml
---
name: skill-name
description: one-line description
allowed-tools:
  - Bash(gh:*)
when_to_use: "Use when the user wants to..."
argument-hint: "PR_NUMBER [--force]"
arguments:
  - PR_NUMBER
context: fork  # or inline (default)
---
```

**Per-step annotations (critical for execution quality):**
- **Success criteria** — REQUIRED on every step
- **Execution** — Direct, Task agent, Teammate, or [human]
- **Artifacts** — Data this step produces for later steps
- **Human checkpoint** — When to pause for confirmation
- **Rules** — Hard constraints per step

**Takeaway for moo:** Our skills lack per-step success criteria. The skillify prompt proves this is considered essential by the platform itself. Every step in loop/shape/intent should have explicit "you know this step is done when..." markers.

### Verification Specialist Pattern

The `skill-verification-specialist.md` shows a sophisticated delegation pattern:

1. **Discover** available verifier skills (from loaded skills list)
2. **Analyze** changes (via git diff)
3. **Match** files → verifiers by description
4. **Generate** deterministic verification plan (written to `~/.claude/plans/`)
5. **Trigger** verifier skills via the Skill tool
6. **Aggregate** results

**Execution rules embedded in the plan:**
```
You MUST NOT:
- Skip steps
- Modify steps
- Add steps not in the plan
- Interpret ambiguous instructions (mark as FAIL instead)
- Round up "almost working" to "working"
```

**Takeaway for moo:** This is a compositor skill — it doesn't verify itself but orchestrates verification specialists. Our `shape` skill follows a similar pattern (selecting approach, not executing). The embedded execution rules pattern is powerful — write constraints *into the artifact* that gets passed downstream.

## 4. Agent Design Patterns

### Role Constraint Pattern

Every agent prompt follows the same structure:

```markdown
You are a [ROLE TITLE] for Claude Code.

=== CRITICAL: [CONSTRAINT MODE] ===
[Explicit deny list]

Your strengths:
- [capability 1]
- [capability 2]

Guidelines:
- [specific instruction 1]
- [specific instruction 2]
```

Key elements:
1. **Identity sentence** — one line, second person ("You are...")
2. **Hard constraint block** — what you CANNOT do
3. **Strengths** — what you CAN do (focuses attention)
4. **Guidelines** — how to do it

**Takeaway for moo:** Our agent definitions in forge should enforce this structure. The "strengths" section is notable — rather than listing all capabilities, it highlights what this agent is *best at*, which guides tool selection.

### Explore Agent: Speed Directive

```markdown
NOTE: You are meant to be a fast agent that returns output as quickly
as possible. In order to achieve this you must:
- Make efficient use of the tools...
- Wherever possible you should try to spawn multiple parallel tool
  calls for grepping and reading files
```

**Takeaway for moo:** Explicitly stating performance expectations changes agent behavior. If a skill or agent should be fast, say so. If it should be thorough, say that instead. Don't leave it ambiguous.

### Plan Agent: Structured Output Requirement

```markdown
## Required Output

End your response with:

### Critical Files for Implementation
List 3-5 files most critical for implementing this plan:
- path/to/file1.ts - [Brief reason]
```

**Takeaway for moo:** Mandate output structure at the end of agent prompts. This ensures consistent, parseable results that downstream consumers can rely on.

### Agent Creation Architect

The `agent-prompt-agent-creation-architect.md` is a meta-agent that creates other agents. Its output is structured JSON:

```json
{
  "identifier": "lowercase-hyphenated",
  "whenToUse": "Use this agent when...",
  "systemPrompt": "The complete system prompt..."
}
```

Key design principles it enforces:
- "Be specific rather than generic"
- "Include concrete examples"
- "Balance comprehensiveness with clarity"
- "Build in quality assurance and self-correction mechanisms"
- Identifiers: "2-4 words joined by hyphens", "avoids generic terms like 'helper' or 'assistant'"

**Takeaway for moo:** Our forge skill creates agents. We should adopt these naming constraints and the structured JSON output format.

## 5. Hook Patterns

### Three Hook Types

```json
{"type": "command", "command": "shell command"}     // Run a program
{"type": "prompt", "prompt": "LLM evaluation"}      // Ask the model
{"type": "agent", "prompt": "Multi-step verification"} // Spawn agent
```

**Prompt hooks** are lightweight — they evaluate a condition and return `{ok: true/false}`.

**Agent hooks** are heavyweight — they can use tools, read files, and verify complex conditions. They receive the conversation transcript path.

**Takeaway for moo:** Our hooks are all command-type. We should explore prompt-type hooks for lightweight guardrails (like our PreToolUse:ExitPlanMode deny chain) — they'd be more token-efficient than spawning a full command process.

### Hook Output Contract

```json
{
  "decision": "block",
  "reason": "Explanation",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Injected into model context",
    "permissionDecision": "allow|deny|ask",
    "updatedInput": {}
  }
}
```

**Key field: `additionalContext`** — this is how hooks inject information back into the conversation. It appears as a `<system-reminder>` tag.

**Takeaway for moo:** Our hooks use `additionalContext` correctly. The `updatedInput` field is interesting — PreToolUse hooks can actually *modify* tool inputs before execution. We don't use this yet.

### Hook Condition Evaluator

The `agent-prompt-hook-condition-evaluator.md` is tiny:

```
You are evaluating a hook in Claude Code.
Your response must be a JSON object:
1. If the condition is met: {"ok": true}
2. If the condition is not met: {"ok": false, "reason": "..."}
```

**Takeaway for moo:** Extremely minimal prompt for a focused task. Binary decision + reason. This is the minimum viable agent prompt.

## 6. Context Management Patterns

### System Reminders

`<system-reminder>` tags are the primary mechanism for injecting per-turn context. They're described as "automatically added by the system" and "bear no direct relation to specific tool results or user messages in which they appear."

Used for:
- Hook output (`system-reminder-hook-additional-context.md`)
- Available skills listing (`system-reminder-invoked-skills.md`)
- Todo list state (`system-reminder-todowrite-reminder.md`)
- Plan mode enforcement (`system-reminder-plan-mode-is-active-*.md`)
- Team coordination (`system-reminder-team-coordination.md`)

**Takeaway for moo:** Our SessionStart hook uses `additionalContext` to inject the `[SESSION]` marker. This is exactly the right mechanism. We should consider using it more aggressively for state that needs to persist per-turn.

### Compaction Survival

The `system-prompt-context-compaction-summary.md` reveals what Claude Code preserves through compaction:

1. **Task Overview** — user's core request + constraints
2. **Current State** — what's done, files modified, artifacts produced
3. **Important Discoveries** — decisions made, errors encountered, failed approaches
4. **Next Steps** — specific actions needed, blockers, priority order
5. **Context to Preserve** — preferences, domain details, promises

**Takeaway for moo:** Our `[SESSION]` marker + PreCompact hook aligns with this. But the "failed approaches" preservation is notable — we should ensure our compaction hook captures what DIDN'T work to prevent loops.

### Session Continuation

```markdown
This session is being continued from another machine. Application
state may have changed. The updated working directory is ${GET_CWD_FN()}
```

**Takeaway for moo:** Simple but important — when context resets, state environment explicitly. Our soul's session strategy should handle this case.

## 7. Flow Control Patterns

### Plan Mode: Multi-Phase with Constraints

Plan mode demonstrates the most sophisticated flow control:

**5-Phase workflow:**
1. **Initial Understanding** — explore with read-only agents
2. **Design** — launch Plan agents with different perspectives
3. **Review** — verify alignment with user intent
4. **Final Plan** — write to plan file
5. **Exit** — call ExitPlanMode

**Iterative workflow (alternative):**
- Loop: Explore → Update plan file → Ask user → repeat
- Converge when: all ambiguities resolved, approach clear, verification described

**Key constraint:** "Your turn should only end by either using AskUserQuestion OR calling ExitPlanMode"

**Takeaway for moo:** Our shape skill has a similar decision flow but doesn't enforce turn-ending constraints. The pattern of mandating how a turn must end prevents the model from stopping prematurely.

### Parallel Agent Spawning

```markdown
Launch up to N explore agents IN PARALLEL (single message, multiple
tool calls) to efficiently explore the codebase.
- Use 1 agent when the task is isolated to known files
- Use multiple agents when: the scope is uncertain, multiple areas
  are involved, or you need to understand existing patterns
```

**Takeaway for moo:** Bond creates agent teams but doesn't specify when to parallelize vs. serialize. Adding guidance like this would improve execution efficiency.

### Delegate Mode

Team lead can enter "delegate mode" where it can ONLY use coordination tools:

```
You can ONLY use: TeammateTool, TaskCreate, TaskGet, TaskUpdate, TaskList
You CANNOT use: Bash, Read, Write, Edit, etc.
```

**Takeaway for moo:** This is a "manager" pattern — the lead coordinates but doesn't execute. Our bond skill implicitly does this but doesn't enforce the constraint. A team lead that accidentally starts coding instead of delegating wastes the team structure.

## 8. Token Efficiency Techniques

### Decision Tables Over Prose

Claude Code uses tables extensively for decision routing:

```markdown
| Event | Matcher | Purpose |
|-------|---------|---------|
| PreToolUse | Tool name | Run before tool, can block |
| PostToolUse | Tool name | Run after successful tool |
```

### Conditional Inclusion

Templates use JavaScript ternary operators to conditionally include sections:

```javascript
${GET_SUBSCRIPTION_TYPE_FN()!=="pro" ? `parallel agents note` : ""}
```

This means different users see different prompts based on their subscription, reducing token waste.

**Takeaway for moo:** We can't do runtime conditional inclusion in SKILL.md, but we can use hooks to inject context only when relevant, which achieves the same effect.

### Focused Agent Prompts

The hook condition evaluator is 3 lines. The task tool agent is 12 lines. Compare to the verification specialist at 249 lines. Prompt size correlates with task complexity, not with perceived importance.

**Takeaway for moo:** Don't pad simple skills. A skill that makes one decision needs one paragraph. Our 200-line limit is validated — Claude Code's own skills range from 3 to 249 lines.

## 9. Anti-Patterns Confirmed

### Things Claude Code Explicitly Avoids

From cross-referencing all prompts:

1. **No time estimates** — "Never give time estimates or predictions"
2. **No over-engineering** — "Don't create helpers, utilities, or abstractions for one-time operations"
3. **No praise** — "Avoid using over-the-top validation or excessive praise"
4. **No file creation unless necessary** — "NEVER create files unless they're absolutely necessary"
5. **No guessing** — "Never use placeholders or guess missing parameters"
6. **No echo for communication** — "NEVER use bash echo to communicate with the user"
7. **No backwards-compat hacks** — "If something is unused, delete it completely"

### Confirmed: Action Directives > Checklists

The `system-prompt-doing-tasks.md` uses imperative instructions ("read it first", "be careful not to introduce") rather than evaluation checklists. This validates our CLAUDE.md finding that "Action directives outperform evaluation checklists."

## 10. Patterns Unique to Claude Code Internals

### Structured Output Enforcement

For analytics/insights, Claude Code demands JSON-only responses:

```markdown
RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "intro": "1 sentence",
  "categories": [...]
}
```

**Takeaway for moo:** When a skill needs structured output (like consult profiles or shape criteria), mandate the format explicitly and say "RESPOND WITH ONLY" — this prevents preamble/explanation text.

### Tool Routing Heuristics

```markdown
When doing file search, prefer to use the Task tool to reduce context usage.
```

```markdown
For broader codebase exploration, use Task tool with subagent_type=Explore.
This is slower than calling Grep directly so use this only when a simple,
directed search proves insufficient.
```

**Takeaway for moo:** Our search skill mirrors this pattern. The key insight is the *tradeoff guidance* — not just "use X" but "use X because Y, but prefer Z when W." Decision context prevents misapplication.

### Commentary Tags for Training

Examples use `<commentary>` tags to explain reasoning:

```xml
<commentary>
Since a significant piece of code was written and the task was
completed, now use the test-runner agent to run the tests
</commentary>
```

**Takeaway for moo:** If we add examples to skills, wrapping reasoning in tags separates the "what to do" from the "why" — making both clearer without mixing them into the action flow.

## 11. Key Recommendations for moo

### Adopt Now

1. **Per-step success criteria** — Every step in every skill should have "done when..." markers
2. **Explicit negative examples** — Add "when NOT to use" to skill descriptions
3. **Deny lists over trust** — When constraining behavior, list forbidden actions
4. **Turn-ending constraints** — Skills should specify how their turn must end
5. **Supercession statements** — Critical constraints should say what they override
6. **Speed/thoroughness directives** — Tell agents whether to optimize for speed or depth

### Consider

7. **Structured output mandates** — For skills producing data (consult, shape criteria), use "RESPOND WITH ONLY"
8. **Commentary tags in examples** — Separate reasoning from actions in skill examples
9. **Plan file pattern** — Write intermediate artifacts to files for persistence across turns
10. **Prompt-type hooks** — For lightweight guardrails, LLM evaluation may be cheaper than command hooks

### Validate (Already Doing Right)

11. **Trigger-only descriptions** — DESCRIPTION TRAP WARNING is correct
12. **`additionalContext` injection** — Our hook pattern is exactly how Claude Code does it
13. **200-line skill limit** — Claude Code's own skills range from 3-249 lines
14. **DOT for decision flows** — Aligns with Claude Code's use of structured formats over prose
15. **Loose coupling** — Claude Code skills reference each other by description, not import
16. **Action directives over checklists** — Confirmed by system prompt patterns

### Avoid (Anti-Patterns from Internals)

17. **Don't build task management** — Claude Code has TaskCreate/TaskList/TaskUpdate natively
18. **Don't build memory** — Claude Code has session memory natively
19. **Don't build tool orchestration** — Claude Code's parallel tool calls and Team tools handle this
20. **Don't duplicate tool docs** — Tools are already documented in tool descriptions
