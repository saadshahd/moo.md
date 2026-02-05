# Changelog

All notable changes to moo are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **hope/breakthrough**: DOT notation decision tree for symptom→technique routing (replaces ASCII art)
- **hope/fit-decision**: DOT notation decision flow for score→shape routing
- **hope/differential-review**: DOT notation 6-phase workflow with risk-based routing
- **loop/waves**: DOT notation state machine for wave execution protocol
- **loop/start**: DOT notation for resume decision flow and spec→fit scoring
- **counsel/panel**: DOT notation workflow for panel assembly process
- **counsel/counsel**: DOT notation for main workflow (Steps 0-3)
- **counsel/confidence**: DOT notation pipeline for confidence scoring
- **CLAUDE.md**: DOT notation guidelines (color palette, node conventions, when to use)
- **CLAUDE.md**: Description Trap warning in conventions and anti-patterns

### Changed

- **counsel**: Switch from `model: opus` to `model: sonnet` (cost optimization - expert simulation is pattern matching, not complex reasoning)
- **loop/start**: Switch from `model: opus` to `model: sonnet` (cost optimization - orchestration, not reasoning)
- **hope/soul**: Replace 37-tool inline table with [Tools Index](hope/skills/soul/references/tools/_index.md) for selective loading
- **loop/start**: Stage-conditional reference loading (load only decomposition/waves/expert-review when needed)
- **counsel/panel**: Default to 2 experts with progressive disclosure ("expand" to add more)

### Fixed

- **hope/gate**: Remove process details from description (trigger-only)
- **hope/intent**: Remove process details from description (trigger-only)
- **hope/shape**: Remove process details from description (trigger-only)
- **hope/trace**: Remove process details from description (trigger-only)
- **loop/cancel**: Remove process details from description (trigger-only)
- **loop/start**: Remove process details from description (trigger-only)

---

## [loop@2.4.1] - 2026-02-05

### Fixed

- **loop/docs**: Corrected slash command syntax (`/loop:start`, `/loop:status`, `/loop:cancel`)

---

## [loop@2.4.0] - 2026-02-05

### Removed

- **loop/ralph-bridge**: Removed fresh-instance orchestration skill (context summarization makes it unnecessary)
- **loop/prd**: Removed pre-decomposed PRD execution skill (simplify to single `/loop` entry point)

### Changed

- **loop/start**: Wave execution now uses adaptive parallelization via `counsel:panel`
  - Panel advises on task coupling (sequential) vs independence (parallel) per wave
- **loop/start**: Removed `--budget` flag from continue command (ask via question if needed)

---

## [loop@2.3.1] - 2026-02-05

### Fixed

- **loop/session-resume.sh**: Hook reading wrong state file after compaction
  - Root cause: Hook read `.loop/state.json` (legacy) but loop writes `.loop/workflow-state.json` (current)
  - Fix: Updated file path and jq field names to match current schema
  - SessionStart hook now properly detects active loops after compaction

---

## [loop@2.3.0, hope@0.20.0, counsel@0.12.0] - 2026-02-05

### Added

- **loop/start**: Complete workflow state management and cross-session resume
  - Step 0: State detection checks `.loop/workflow-state.json`, SHAPE.md, and TaskList
  - Resume decision MCQ: Resume / Start fresh / View status
  - `workflow-state.json` schema with version, stage, task, spec_score, fit_score, shape_chosen, timestamps, recall_surfaced, reviews
- **loop/start**: Recall learnings before decomposition (Step 0.5)
  - Extracts domain hints from task
  - Invokes `hope:recall` to surface past failures/discoveries/constraints
  - User confirms or dismisses; persists to workflow-state.json
- **loop/start**: Fit score calculation for workflow shape selection
  - Formula: spec_score × 5 + constraints + success_criteria + done_definition + domain_familiarity
  - Shape decision: 40+ Tool, 30-39 Tool-review, 25-29 Colleague, <25 BLOCKED
- **loop/start**: Light expert review after each wave (Step 4 enhancement)
  - counsel:panel invoked with domain-relevant experts
  - Quick idiomaticity/cleanliness/delivery check (~30s)
  - Non-blocking: issues shown as guidance
- **loop/start**: Thorough expert review before gate (Step 5)
  - Full expert panel with interactive findings loop
  - Severity levels: BLOCKER / WARNING / SUGGESTION
  - Constraint-aware guidance respects SHAPE.md mustNot
  - Creates remediation tasks for unresolved blockers
- **loop/status**: New skill showing workflow state
  - Stage, spec/fit scores, task progress, review status
  - Suggested next action based on current stage
- **loop/references**: `expert-review.md` documenting review protocol
  - Expert-to-aspect mapping for light and thorough reviews
  - Severity level definitions
  - Constraint-aware guidance rules
- **hope/intent**: Spec score persistence to `.loop/workflow-state.json`
  - Enables loop to read persisted score instead of recalculating
- **counsel/panel**: Review mode for loop integration
  - Light review pattern: `review wave {N} changes for: {spec}`
  - Thorough review pattern: `thorough review for: {spec} with constraints: {mustNot}`
  - Severity levels with interactive approve/reject/create-task
  - Constraint checking against SHAPE.md mustNot

### Changed

- **loop/start**: Architecture now 7 steps (0, 0.5, 1, 2, 3, 4, 5, 6)
- **loop/loop-mechanics.md**: Rewritten with workflow-state schema, fit_score calculation, expert review stage, session resume protocol
- **hope/gate**: Added expert review requirement check (`reviews.thorough.passed`)

### Removed

- **loop/references**: Deleted orphaned reference files (spec-rubric.md, cost-controls.md, headless.md)

---

## [hope@0.19.0, loop@2.2.0] - 2026-02-04

### Added

- **hope/verify**: Complete redesign with tiered architecture
  - Three verification tiers: Quick (<5s), Standard (<30s), Thorough (<2min)
  - Tool discovery phase — detects project tools from package.json, pyproject.toml, Makefile
  - AskUserQuestion fallback when tools not detected
  - Lock mode (before building) + Execute mode (after building)
  - Gemini visual verification as default when `GEMINI_API_KEY` exists, with Claude fallback
  - Expert consultation integration (counsel:panel for strategy and failure diagnosis)
  - 7 new reference files: tiers.md, tool-discovery.md, tools-code.md, tools-visual.md, tools-api.md, tools-llm.md, integration-points.md
  - 4 new eval test cases: verify-tiered-quick, verify-tiered-thorough, verify-tool-discovery, verify-lock-criteria
- **hope/shape**: Verify integration — triggers verify to lock criteria after shape generation
- **loop/start**: Verify integration at two points:
  - Quick verify after each atomic task completion
  - Thorough verify before claiming done (before gate)
- **hope/gate**: Verify integration — checks thorough tier results before allowing completion

### Changed

- **hope/verify**: No longer assumes specific tools (tsc, biome, etc.) — discovers from project
- **hope/verify**: Tiered execution replaces single-mode verification
- **hope/gate**: Verification tiers section added with tier expectations

---

## [loop@2.1.0, hope@0.18.0, counsel@0.11.0] - 2026-02-04

### Changed

- **loop/start**: Expert-driven spec clarification
  - For unclear dimensions (<2), counsel:panel generates expert-informed options
  - Dimension → Expert Panel Mapping (Outcome, Scope, Constraints, Success, Done)
  - Extended Aspects coverage (Design, UI, UX, Innovation)
  - Each option includes expert reasoning for informed selection
- **counsel/panel.md**: Added Clarification Mode for loop integration
  - `clarify {dimension} for: {spec}` pattern triggers expert-informed option generation
  - Extended aspect mappings for design, UI, UX, innovation
- **loop/stop-check.sh**: Removed state.json backward compatibility
  - Now uses TaskList API exclusively
  - Simplified from 103 to 33 lines
- **loop/loop-mechanics.md**: Removed legacy state.json section and references
- **hope/soul, loop/start**: Softened aggressive language
  - EXTREMELY-IMPORTANT → core-principles
  - MUST → Use/Ensure, NEVER → Avoid, CRITICAL → Important
  - FORBIDDEN → Avoid, MANDATORY → should

---

## [loop@2.0.0, hope@0.17.0, counsel@0.10.0] - 2026-02-04

### Added

- **loop**: Ralph Wiggum wave-based execution mechanics
  - Atomic task decomposition with "one sentence without and" test
  - Wave detection: tasks with no blockedBy execute in parallel
  - Parallel subagent spawning via Task tool
  - TaskList API as source of truth (persists to ~/.claude/tasks/)
  - Human-readable `.loop/PROGRESS.md` for status tracking
  - `references/decomposition.md` — Atomic task format and guidelines
  - `references/waves.md` — Wave execution protocol
- **loop**: Self-unblocking via counsel integration
  - First failure (stuckCount >= 1) triggers immediate counsel:panel
  - No human escalation — only pause at max iterations
  - User configures max iterations at loop start
- **loop**: User configuration at loop start via AskUserQuestion
  - Task list mode (new/resume/session-only)
  - Max iterations (10/25/50/unlimited)
  - Budget limit ($10/$25/$50/none)
- **counsel**: Stuck mode for loop integration
  - `stuck on [task]: [error]` pattern triggers diagnostic mode
  - Expert diagnosis from multiple perspectives
  - Consensus recommendation with confidence level
  - 3 new eval test cases: stuck-unblock, panel-conflict, calibration-persistence
- **hope/recall**: Expanded from 57 to 115 lines
  - Capture guidance: when and what to capture
  - Loop integration: automatic recall before decomposition
  - Example learnings for each category
  - Integration points documented

### Changed

- **loop/start**: Complete redesign with Ralph mechanics
  - Architecture: spec scoring → shape generation → decomposition → wave execution → completion
  - Auto-invoke hope:intent when spec score <5
  - Auto-invoke hope:shape when spec score ≥5
  - Completion gate via hope:gate before claiming done
  - allowed-tools updated to include Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Skill, AskUserQuestion
- **loop/stop-check.sh**: Fixed stdin input parsing
  - Changed from environment variable ($ARGUMENTS) to stdin (cat)
  - Added stop_hook_active check to prevent infinite loops
  - Added TaskList file reading for new wave-based state
  - Maintains backward compatibility with .loop/state.json
- **loop/loop-mechanics.md**: Rewritten for new architecture
  - TaskList API as primary state management
  - PROGRESS.md as human-readable secondary
  - Stop hook stdin protocol documented
  - Self-unblocking flow documented
- **hope/soul**: Extracted references to reduce size
  - Tool Pairings → references/tool-pairings.md
  - Common Rationalizations → references/rationalizations.md
  - Inline sections replaced with concise summaries + links
- **counsel/panel.md**: Added stuck mode section for loop integration

### Removed

- **hope/agents/delve.md**: Deleted (native Explore is better)
- **hope/references/design-patterns.md**: Deleted duplicate (keeping skill-judge version)

---

## [hope@0.16.0] - 2026-02-04

### Fixed

- **hope/soul**: Quality footer regression — footer stopped appearing after recent changes
  - Root cause: Commit a949b47 (Jan 29) condensed Silent Audit checklist, losing explicit output reminders
  - Root cause: Commit ae4b3bf (Feb 2) softened gate from blocker to advisory without syncing quality-footer.md
  - Fix: Added explicit "Output requirements" checklist to Silent Audit (verification, reversibility, alternative, risk)
  - Fix: Synced quality-footer.md with advisory philosophy (`assumption` → ⚠️ Flag with warning)
  - Fix: Strengthened footer emission directive with inline template and MANDATORY language
  - Fix: Removed `assumption` from blocking table (now flags, doesn't force verdict)
  - Fix: Updated verdict rules — RESEARCH triggered by low confidence OR no verification plan, not assumption alone

### Changed

- **hope/soul**: Quality Footer section now includes inline template (not just reference link)
- **hope/soul**: Verification Gates table updated — `assumption` now flags warning instead of blocking SHIP
- **hope/references/quality-footer.md**: Updated to advisory philosophy — verdicts advise, don't block

### Removed

- **playground**: Deleted plugin entirely (user requested removal)
  - Removed playground directory
  - Removed from marketplace.json

---

## [hope@0.15.0, loop@1.7.0, product@0.9.0, counsel@0.9.0, career@0.6.0, design@0.6.0, wordsmith@0.6.0] - 2026-02-03

### Added

- **all skills**: Ethical Boundaries framework across 13 skills
  - Core principle: "Claude advises, never commands. Claude discloses, never hides. Claude teaches, never traps. Claude reflects, never decides."
  - **hope/soul**: New "Ethical Boundaries" section with Pause Protocol, Session Boundaries, Graduate Principle, and Boundary Violations table
  - **hope/gate**: Boundary clarification — gates advise, never prevent; user owns their work
  - **hope/intent**: Anti-dependency note — goal is user graduation, offers checklist export after 3+ uses
  - **hope/shape**: Boundary statement — surfaces considerations, user owns architecture
  - **hope/trace**: Boundary statement — system gaps only, reframe personal blame to system gaps
  - **hope/recall**: Boundary clarification — user controls retention, discloses storage location
  - **loop/start**: Boundary section — executes user's spec, never expands it; state file transparency with cleanup offer
  - **loop/ralph-bridge**: Boundary statement — executes user's decomposition, never creates its own
  - **counsel**: Boundary statement — pattern-matching on published work, not channeling actual experts
  - **career**: Boundary statement — patterns not truth, user interprets significance
  - **design**: Boundary statement — generates options, user chooses; commitment is user's act
  - **wordsmith/writing**: Boundary statement — author's voice is sovereign, suggestions are proposals
  - **product**: Boundary statement — structures thinking, business judgment remains human

### Changed

- **hope/gate**: Verification types now include "reasoned inference" (flag, don't block) and "assumption" (flag with warning, don't hard-block)

---

## [hope@0.14.0] - 2026-02-03

### Added

- **hope/presence**: New skill for maintaining cognitive presence during complex AI work
  - Surfaces decisions made, assumptions active, uncertainties open, and verification needed
  - Triggers on "lost track", "overwhelmed", "what just happened", "summarize progress"
  - Frequency calibration based on context length
  - Integration points with soul, gate, trace, shape skills
- **hope/verify**: New skill for machine-verifiable acceptance criteria
  - Phase 1: Lock boolean criteria before building
  - Phase 2: Execute verification after building
  - agent-browser CLI integration for browser verification (93% less context than MCP)
  - Criterion types: exit code, string presence, HTTP status, element visible, state change
  - Vague-to-boolean conversion table for common acceptance criteria
- **hope**: 4 new eval test cases for presence and verify skills

---

## [playground@0.1.0] - 2026-02-02

### Added

- **playground**: New plugin for interactive HTML playgrounds
  - `playground:system` - Feedback loop visualizer with poke mode
    - Canvas-based system dynamics visualization
    - Auto loop detection (reinforcing/balancing classification)
    - "Poke" mode simulates value changes rippling through connected nodes
    - Leverage point ranking based on Meadows' hierarchy
  - `playground:timeline` - 10-10-10 timeline simulator
    - Parallel tracks for decision options
    - Three time zones (10 min / 10 months / 10 years)
    - Probability cones with decay over time
    - Regret markers for flagging future regret points
  - Pattern: Single HTML file, no external deps, live preview, copy-to-clipboard prompt output
  - Learned from Anthropic's official playground plugin patterns

---

## [hope@0.13.0, loop@1.6.0, product@0.8.0, counsel@0.8.0, founder@0.5.0, career@0.5.0, design@0.5.0, wordsmith@0.5.0] - 2026-02-02

### Added

- **wordsmith/voices**: New skill for voice profile management (list, apply, delete)
- **hope**: Stop hooks for learnings capture on `trace`, `breakthrough`, and `shape` skills
  - Prompts user to run `/hope:learn` when session produces valuable insights

### Changed

- **all skills**: Added `model:` and `allowed-tools:` frontmatter fields for optimization
  - Opus (9 skills): soul, shape, trace, breakthrough, skill-judge, loop:start, loop:prd, ralph-bridge, founder, counsel
  - Sonnet (8 skills): intent, interactive-code-review, product, writing, template, career, design
  - Haiku (4 skills): gate, recall, cancel, voices
- **hope/recall**: Added `context: fork` with `agent: Explore` for isolated execution

---

## [hope@0.12.0, loop@1.5.0, product@0.7.0, counsel@0.7.0, founder@0.4.0, career@0.4.0, design@0.4.0, wordsmith@0.4.0] - 2026-02-01

### Added

- **wordsmith/voices**: New skill for voice profile management (list, apply, delete)

### Changed

- **all skills**: Added `model:` and `allowed-tools:` frontmatter fields for optimization
  - Opus (9 skills): soul, shape, trace, breakthrough, skill-judge, loop:start, loop:prd, ralph-bridge, founder, counsel
  - Sonnet (8 skills): intent, interactive-code-review, product, writing, template, career, design
  - Haiku (4 skills): gate, recall, cancel, voices
- **hope/recall**: Added `context: fork` with `agent: Explore` for isolated execution
- **all**: Minor version bump for release synchronization

---

## [hope@0.11.0, product@0.6.0, loop@1.4.0] - 2026-02-01

### Added

- **hope/shape**: New skill bridging WHAT (intent) to HOW (implementation)
  - Aspect discovery (12 dimensions: Data, API, UI, Auth, Performance, Error, Testing, Migration, Integration, Deployment, Observability, Documentation)
  - Anchor experts for each aspect (Hickey, Fowler, Norman, OWASP, Gregg, Nygard, Beck, Newman, Hohpe, Humble)
  - Expert hierarchy for conflict resolution (Hickey → Fowler → fewer deps)
  - Outputs SHAPE.md with criteria[], mustNot[], verification{}
  - Present mode (show reasoning) vs Autonomous mode (apply hierarchy silently)
  - References: aspect-discovery.md, anchor-experts.md, shape-template.md
- **hope/intent**: MCQ rapid clarification format (lettered options for 3-5x faster iteration)
- **hope/intent**: Shape suggestion after spec_score ≥5 (bridges intent→shape→loop pipeline)
- **hope/soul**: Shape skill added to Available Hope Skills table
- **hope**: Shape trigger eval test (`shape-trigger.yaml`)
- **loop/prd**: New skill for PRD execution mode (`/loop:prd`)
  - Executes pre-decomposed tasks from PRD with machine-verifiable criteria
  - Supports T-NNN task format with blockedBy dependencies
  - Parallel execution with `--parallel` flag (max 3 subagents)
- **loop/start**: SHAPE.md integration
  - Extracts criteria[], mustNot[], verification{} from .loop/shape/SHAPE.md
  - mustNot conditions trigger circuit breaker
  - verification types block exit when "assumption"
- **loop**: `references/prd-mode.md` - PRD execution mode for pre-decomposed tasks
- **loop/ralph-bridge**: New skill for fresh-instance orchestration
  - Spawns fresh Claude per story via moo-ralph.sh
  - Solves context exhaustion for N>5 stories
- **product**: `references/testing-patterns.md` - Machine-verifiable acceptance criteria patterns
- **product**: Story Size Gate and Task Explosion Protocol in prd.md
- **PHILOSOPHY**: 4 new principles (machine-verifiable, investigation before implementation, expert hierarchy, fresh context)

### Changed

- **loop/start**: Added Confirmation Gates by Shape section
  - Tool-shaped (≥8): No confirmation gates, runs autonomously
  - Colleague-shaped (5-7): Three gates (G1, G2, G3)
  - Intent-required (<5): Block and route to /hope:intent
- **loop**: State schema `criteriaStatus` tracks verification type per criterion
- **product**: prd.md Rules section expanded with story sizing and requirement scoring gates

---

## [loop@1.3.0, product@0.5.0, hope@0.10.2] - 2026-02-01

### Added

- **loop**: 4 new eval test cases for loop verification
  - `dual-exit.yaml` - Both criteriaStatus AND exit_signal required
  - `circuit-breaker.yaml` - stuckCount >= 5 triggers stop
  - `shape-selection.yaml` - Score <5 routes to /hope:intent
  - `tool-shape.yaml` - Score >=8 runs autonomously as tool-shaped
- **loop**: Workflow A/B/C detection based on spec content (build/debug/refactor)
- **loop**: Reversibility classification in Before You Start checklist (Type 2A/2B/1)
- **loop**: Quality footer required after `<loop-complete>` with verdict mapping
- **loop**: Verification types for criteria in state schema
- **product**: Pre-work spec gate with 5-dimension scoring (Problem, Audience, Constraints, Success, Done)
- **product**: Quality footer requirement in Rules section
- **product**: 3 new eval test cases (compete-request, metrics-request, research-request)
- **product**: `references/market-sizing.md` - TAM/SAM/SOM framework
- **product**: `references/experimentation.md` - A/B testing framework
- **hope**: `loop:start` added to Available Hope Skills table in soul SKILL.md

### Changed

- **loop**: State schema `criteriaStatus` now tracks verification type per criterion
- **loop**: `stop-check.sh` updated to block exit when any criterion has "assumption" verification
- **loop**: Announcement format now includes workflow
- **product**: Workflow table expanded with Market Sizing and Experimentation workflows

---

## [hope@0.10.1] - 2026-01-30

### Fixed

- **hope**: `ensure-soul.sh` hook failing on systems where jq doesn't accept file argument
  - Changed from `jq '.name' "$plugin_json"` to `jq '.name' < "$plugin_json"` (stdin)
  - Affects SessionStart hook that ensures soul skill is loaded

---

## [loop@1.2.0] - 2026-01-29

### Changed

- **loop**: Stop hook rewritten from prompt-based to command-based
  - Root cause: LLM-based stop hook couldn't reliably read files, defaulted to stopping
  - Fix: Bash script (`stop-check.sh`) reads `.loop/state.json` directly for deterministic decisions
- **loop**: Dual-condition exit now enforced by script
  - Both `criteriaStatus` all true AND `exit_signal: true` required to stop
  - Prevents premature stops when criteria verified but intent not confirmed
- **loop**: State file schema extended with `exit_signal` boolean and `circuitBreaker` object
- **loop**: Circuit breaker moved from LLM judgment to state file tracking
  - `stuckCount` increments when same criteria remain unmet across iterations
  - Script opens circuit at 5 stuck iterations
- **loop**: Session resume now uses command-based hook (`session-resume.sh`)
- **loop**: SKILL.md rewritten with EXIT_SIGNAL protocol and `---LOOP_STATUS---` block format

### Added

- **loop**: `hooks/scripts/stop-check.sh` - Deterministic stop decision script
- **loop**: `hooks/scripts/session-resume.sh` - Session start resume detection script

### Fixed

- **loop**: Stop hook returns `{ok: true}` when it should return `{ok: false}` to continue
  - LLM prompt couldn't access files, always defaulted to stopping
  - Command-based script reads state file directly

---

## [hope@0.10.0] - 2026-01-29

### Added

- **hope**: Delegation Operating System - enforcement over advice for AI delegation
  - `references/delegation-failures.md` - Library of common delegation failure patterns
  - `references/adversarial-precheck.md` - Protocol for high-stakes delegations (Reversibility < 5)
  - `delegation.jsonl` - New learnings category for capturing delegation misses

### Changed

- **hope/soul**: Silent Audit now has **blocking items** that force verdicts
  - Spec score < 5 → Forces 🔴 RESEARCH, must run /hope:intent
  - Fit score < 25 → Forces 🔴 RESEARCH, must clarify
  - Verification type "assumption" → Forces 🔴 RESEARCH
  - High stakes + Reversibility < 5 → Requires adversarial pre-check
- **hope/soul**: Fit decision auto-selects workflow shape based on score
  - 40+: Tool-shaped, 30-39: Tool-with-review, 25-29: Colleague-shaped, <25: BLOCKED
- **hope/gate**: Added Pre-Work Gate (before starting work)
  - Verification method must be locked (not "assumption")
  - At least 2 "must NOT" criteria required
  - Fit score must determine workflow shape
- **hope/recall**: Now surfaces delegation learnings from past sessions
- **hope/learn**: Captures delegation failures with pattern classification

---

## [loop@1.1.0] - 2026-01-26

### Added

- **loop**: File-based state persistence (`.loop/state.json`) for cross-session recovery
  - State file survives compaction and session boundaries
  - Contains spec, criteria, criteriaStatus, steps, and progress
  - Stop hook reads criteriaStatus to make informed continue/stop decisions
- **loop**: SessionStart hook for compaction recovery
  - Detects active loops on session start
  - Announces resume with progress and unmet criteria
- **loop**: Criteria-aware stop hook
  - Reads `.loop/state.json` to verify spec criteria before stopping
  - Returns `{ok: false}` when criteria are unmet
  - Circuit breaker: stops after 5x consecutive same unmet criteria

### Changed

- **loop**: Setup hook now creates project-local `.loop/` directory instead of `~/.claude/loop`
- **loop**: State File Protocol section added to SKILL.md
- **loop**: Iteration Protocol updated to include state file read/write steps
- **loop**: Dual-State Model documented in loop-mechanics.md (Tasks API + file-based)

### Fixed

- **loop**: Stop hook returning `{ok: true}` when loop should continue due to unmet spec criteria
  - Root cause: stop hook couldn't verify criteria without state file
  - Fix: criteriaStatus object in state file provides source of truth

---

## [loop@1.0.2] - 2026-01-26

### Fixed

- **loop**: Stop hook was blocking normal conversation stops when no loop was active
  - Hook now checks for active loop (via `[LOOP]` announcements) before evaluating
  - Returns `{"ok": true}` immediately when no loop is running

---

## [loop@1.0.1] - 2026-01-26

### Fixed

- **loop**: Stop hook "JSON validation failed" error
  - Rewrote prompt with explicit "JSON ONLY:" suffix to prevent Haiku from adding preamble
  - Added `<loop-complete>` completion marker detection
  - Added `stop_hook_active` counter check to prevent infinite loops
- **loop**: Abstract protocol not being followed
  - Added "Rigid Enforcement Gates" section with mandatory output formats
  - Inlined spec rubric, state schema, and circuit breakers into SKILL.md
  - Added "Before You Start" checklist
  - Added concrete `[LOOP]` announcement formats for iterations
- **loop**: Added stop_hook_active handling documentation to loop-mechanics.md
- **loop**: Added troubleshooting section for common hook failures

### Added

- **loop**: New eval test `loop-enforcement.yaml` for protocol compliance verification

---

## [0.9.1] - 2026-01-25

### Changed

- **hope/soul**: Improved description with explicit trigger KEYWORDS
  - Added: "how confident", "verify this", "alternative approach", "what could go wrong", "think through"
  - Removed overly broad "MANDATORY for ALL tasks" trigger
  - Clearer WHAT/WHEN/KEYWORDS structure for reliable activation

---

## [0.9.0] - 2026-01-25

### Changed

- **eval**: Optimized for speed and cost
  - Quick mode (default): Layer A + C only, haiku model, 30s timeout
  - Full mode (`--full`): Adds Layer D with default model
  - Deep mode (`--deep`): Original behavior with expensive model
  - Full suite: 10+ minutes → ~30 seconds
- **eval**: Added flaky test support with concurrent retries
  - `flaky: true` in test YAML enables up to 5 attempts (2 concurrent)
  - Retry logic only activates for haiku model
  - Output shows `[flaky: N/5]` for retried tests
- **eval**: Added single test mode (`--test <name>`)
- **eval**: Fixed plugin filter bug (positional arg parsing)
- **docs**: Added counsel, design, loop to docs/index.md and README.md

### Fixed

- **marketplace.json**: Removed invalid `skills` field from plugin entries (not part of schema)
- **loop**: Merged `/loop:help` into `/loop:start` (redundancy audit)
  - Added help triggers to start description ("what is loop", "how does loop work", "loop help")
  - Moved tips section from help into start
- **.github/hooks/pre-push**: Simplified quality gates (objective checks only)
  - Line count < 500, frontmatter exists, no multi-line YAML
  - Removed unreliable WHAT/WHEN/KEYWORDS regex validation
- **wordsmith, design, founder**: Added confirmation gates to multi-step workflows
  - Gates at research, approach selection, and final output phases
  - Skip with "proceed without confirmation"
- **hope/interactive-code-review**: Streamlined workflow, added Skip/Done/Jump commands

### Removed

- **loop**: Deleted `loop/skills/help/` directory (content merged into start)

### Added

- **wordsmith, design, founder**: Compatibility matrices for multi-dimensional skills
  - `references/compatibility-matrix.md` in each plugin
  - Voice × Format, Style × Audience, Workflow × Stage combinations
- **hope**: `/hope:skill-judge` meta-skill for evaluating skill quality
  - 8-dimension evaluation framework (120 points total)
  - Knowledge Delta classification ([E]xpert / [A]ctivation / [R]edundant)
  - Description validation (WHAT + WHEN + KEYWORDS)
  - 5 design pattern templates (Mindset, Navigation, Philosophy, Process, Tool)
  - 9 anti-pattern detection patterns
  - References: evaluation-dimensions.md, knowledge-delta.md, design-patterns.md, anti-patterns.md
- **hope**: `/hope:breakthrough` skill for creative problem-solving when stuck
  - 6 techniques: Simplification Cascade, Scale Game, Meta-Pattern Recognition, Assumption Inversion, Constraint Removal, Fresh Perspective
  - Symptom-based dispatch table for technique selection
  - Decision tree for chaining techniques
  - References: techniques.md, symptoms.md, when-not-to-use.md
- **hope**: 7 new specialized references in `skills/soul/references/`:
  - `reducing-entropy.md` - Philosophy for minimizing codebase complexity ("LESS TOTAL CODE")
  - `property-testing.md` - Advanced testing with automatic edge case discovery
  - `variant-analysis.md` - Finding similar bugs from a known vulnerability (Trail of Bits)
  - `differential-review.md` - Security-focused code review methodology (Trail of Bits)
  - `prior-art.md` - Research existing solutions before building
  - `research-methodology.md` - Structured research with confidence tagging
  - `plugin-forge.md` - Creating Claude Code plugins and skills
- **hope**: Specialized References section added to soul SKILL.md
- **hope**: 3 infrastructure references in `references/`:
  - `archive-pattern.md` - .hope-archive/ directory pattern for skill outputs
  - `extensibility.md` - EXTEND.md pattern for user/project customization
  - `design-patterns.md` - 5 skill design patterns with line count guidance
- **product**: Game-changing features workflow added to product router
  - 6-criteria evaluation matrix (Impact, Reach, Frequency, Differentiation, Defensibility, Feasibility)
  - 9-category forced exploration (Speed, Automation, Intelligence, Integration, Collaboration, Personalization, Visibility, Confidence, Delight)
  - Three scales of innovation (Massive, Medium, Small)
  - Reference: `game-changing-features.md`
- **loop**: New plugin for autonomous iteration with spec-driven quality gates
  - `/loop:start` - Start autonomous iteration loop
  - `/loop:cancel` - Terminate active loops cleanly
  - `/loop:help` - Plugin documentation
  - Tasks API integration for state tracking across iterations
  - Prompt-based Stop hook for intelligent termination
  - 5-dimension spec clarity rubric (Outcome, Scope, Constraints, Success Criteria, Done Definition)
  - Workflow shape detection (Tool-shaped vs Colleague-shaped)
  - Cost controls: $25 default budget, 10 iteration limit, circuit breakers
  - CI/CD examples for GitHub Actions and GitLab CI
  - Headless mode documentation for automated environments
- **hope**: 9 prompt kit framework references in `skills/soul/references/`:
  - `fit-decision.md` - 5-dimension scoring for AI task appropriateness
  - `high-grade-intent.md` - NON-GOALS and STOP CONDITIONS for drift prevention
  - `workflow-shape.md` - Tool-shaped (CNC) vs Colleague-shaped (Machinist Loop) patterns
  - `trust-ladder.md` - 4-stage graduated AI delegation (Observe/Draft/Act+Guardrails/Act+Trust)
  - `volatility-budget.md` - GREEN/YELLOW/RED change frequency tiers
  - `attention-budget.md` - CORE/ENABLING/OVERHEAD classification
  - `pattern-vs-taste.md` - Delegatable rules vs human judgment
  - `agency-debugger.md` - "Why am I stuck?" diagnostic (6 blocker types)
  - `spec-rubric.md` - Spec clarity scoring (0-10 scale)
- **hope**: Silent Audit extended with 4 new checkboxes (Fit decision, Workflow shape, Trust level, Attention budget)
- **hope**: Setup hook creates `~/.claude/learnings/` directory on init
- **hope**: `/hope:intent` now includes Task Definition Protocol and Spec Score Check
- **hope**: `/hope:plan` now includes Phase 0: Fit Decision and Spec Score Gate
- **career**: 2 new framework references:
  - `identity-shift.md` - Role transition framework (IC → Manager, Engineer → PM)
  - `ownership.md` - Loop 1 (proactive) vs Loop 2 (reactive) agency diagnostic
- **career**: Agency Debugger integration in `stakeholder.md`
- **career**: 3 eval cases (career-trigger, interview-simulator, identity-shift-trigger)
- **founder**: 1 new framework reference:
  - `depth-ranking.md` - Claim validation levels (Intuition/Anecdote/Validated)
- **founder**: Loop 1 Ownership accountability in `launch.md`
- **founder**: 3 eval cases (founder-trigger, validate-idea, pitch-deck)
- **product**: `volatility-budget.md` - Metrics volatility tiers (High/Medium/Stable)
- **product**: Spec Clarity Rubric in `prd.md`
- **counsel**: `colleague-framework.md` - Expert deferral decision tree and trust ladder
- **design**: `token-volatility.md` - Design token change frequency and Pattern vs Taste
- **wordsmith**: Attention Budget stop gates in `editing.md`
- **hope**: 3 additional framework references:
  - `delegation.md` - Anti-footgun rules for safe AI delegation
  - `altitude.md` - Strategic Deep-Diving (zoom in/out, evidence levels)
  - Verification Plan framework in gate skill
- **hope**: Feature Blast Radius Triage in `pre-mortem.md`
- **hope**: Build vs Buy analysis in `opportunity-cost.md`
- **hope**: Temporal Separation guidance in Learnings System
- **hope**: Action Specification (Loop 1) in `/hope:intent`

### Changed

- **hope**: intent.md restructured with Task Definition Protocol + Spec Score Check + High-Grade Intent output + Action Specification
- **hope**: plan.md now gates on Fit Decision (5 dimensions) and Spec Score before Phase 1
- **hope**: soul SKILL.md Silent Audit expanded from 9 to 13 checkboxes
- **hope**: gate SKILL.md now includes Verification Plan with stakes-based requirements
- **eval**: Added `acceptableSkills` to test cases for short name variants (founder, career, design)
- **loop** added to marketplace.json under "core" category
- **syntax**: Migrated 15 command files from `$ARGUMENTS` to `$0` (new Claude Code syntax)
- **counsel**: 12 new expert profiles (21 → 33 total) - Steve Jobs, Michael Feathers, Bret Victor, Andy Matuschak, Maggie Appleton, Nicky Case, Ink & Switch, Gordon Brander, Geoffrey Litt, Alan Kay, Christopher Alexander, Seymour Papert
- **counsel**: Updated inference.md with 12 new domain signal keywords

---

## [Revert] - 2026-01-06

### Reverted

- **Breaking change reverted:** Rolled back "decompose router skills into 61 focused skills" (commit 3028506)
- Claude Code truncates available_skills list at token budget limit
- 61 skills caused truncation → counsel plugin invisible → auto-triggering broken
- Restored router skill pattern (11 skills total across all plugins)

### Why Router Pattern Works

- Fewer top-level skills = all visible in Claude Code's skill list
- Workflows contained in reference files (same functionality)
- Important slash commands remain directly invocable

### Skill Counts (Post-Revert)

| Plugin    | Skills |
| --------- | ------ |
| counsel   | 1      |
| wordsmith | 2      |
| product   | 1      |
| founder   | 1      |
| career    | 1      |
| design    | 1      |
| hope      | 4      |
| **Total** | **11** |

---

## [hope@0.5.0] - 2026-01-05

### Added

- feat(hope): `/hope:prime` command for dynamic skill selection from available_skills block
- feat(hope): `/hope:plan` now invokes `/prime` after intent reaches ≥85% confidence
- feat(wordsmith): Template skill for document scaffolding (RFC, ADR, Blog)
- docs: STRATEGY.md with competitive analysis vs design-os and marketing roadmap
- docs: MARKETING-TASKS.md with GitHub topics, marketplace submissions, content calendar

### Changed

- **hope:** Quality footer now shows dual signal: Verified type (primary), Checklist items, Subjective percentage (labeled)
  - Format: `Verified: execution output | Checklist: 4/4 | Subjective: ~85%`
  - Verification types: execution output > observation > measurement > code review > assumption
  - `assumption` blocks SHIP regardless of subjective percentage
- **hope:** "Confidence Gates" renamed to "Verification Gates" throughout
- **hope:** Subjective percentages now labeled honestly as "Claude's estimates, not calibrated accuracy"
- **docs:** Removed `/hope:calibrate` command (non-functional per ADR-001)

**Why dual-signal?** Research shows self-reported confidence percentages are systematically inflated (80-100% range). Our verification funnel uses extrinsic feedback which research validates. Sources: [MIT/TACL 2024](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713), [Anthropic 2022](https://arxiv.org/abs/2207.05221)

- docs: Complete documentation rewrite following expert panel review (Hickey/Graham/Jobs principles)
  - **README**: Problem → transformation → action structure
    - Hook: "Claude answers fast. moo makes it answer right."
    - Before/after blockquotes replace feature tables
    - Horizontal plugin links instead of table
    - One screenshot at bottom (proof, not sales)
  - **hope.md**: Value-first structure
    - Opens with "What changes" (before/after), not command table
    - "You don't see the checklist. You see better answers."
  - **getting-started.md**: "Start in 30 seconds" (under-promise, over-deliver)
- fix(design): WireMD syntax corrected based on parser analysis
  - Use state containers (`error-state`, `success-state`, etc.) instead of alert variants
  - Blank lines required after `:::`, between elements, and before closing `:::`
  - Removed `---` horizontal rules from examples
  - Removed invalid `::: alert {:error}` syntax (use `::: error-state` instead)
- refactor(design): `/wireframe` command restructured with Anthropic prompting patterns
  - Example moved to top (Claude reads linearly)
  - Converted to Goal + Constraints format
  - Added "Adapt to Context" escape hatch

---

## [counsel@0.3.0] - 2026-01-03

### Added

- Profile blocking via `/counsel:block`, `/counsel:unblock`, `/counsel:blocked`
  - Block profiles by name (case-insensitive, partial match)
  - User-global storage at `~/.claude/counsel-blocklist.json`
  - Blocked profiles excluded from paneling, summoning, and auto-detection

---

## [design@0.1.1] - 2026-01-01

### Changed

- WireMD syntax reference rewritten to match v0.1.5 verified behavior
  - Pinned to version 0.1.5 (alpha tool, avoid breakage)
  - Documented: flat containers only (no nesting), grid heading hierarchy, inline HTML support
  - Removed: sidebar-main layout, nested container examples (non-functional)
  - Added: badge backtick syntax, alert variants, styled container types list
- `/wireframe` command now auto-detects wiremd CLI and asks before installing

### Fixed

- Removed unsupported nested `:::` patterns from WireMD documentation (GitHub issue #9)
- Removed non-functional `{.sidebar-main}` layout from examples

---

## [hope@0.4.8] - 2026-01-01

### Added

- CLI installation pattern reference (`cli-install.md`) for reusable tool detection flow

### Changed

- `/slides` command now auto-detects marp CLI and asks before installing

---

## [0.1.0] - 2025-12-31

### Added

- feat(hope): 10-10-10 Rule lifted from career to hope as single source of truth
- feat(hope): Rationalization tables in gate and soul skills
- feat(founder): Quality Footer section for high-stakes outputs
- feat(founder): Rationalization table for startup thinking traps
- feat(career): Quality Footer section for assessments
- feat(counsel): Lazy loading instruction in SKILL.md Step 2

### Changed

- **All domain plugins** now explicitly document hope dependency in plugin.json description
- **Tool naming standardized**: All "ask tool" references now "Ask tool" (40+ files)
- **Token efficiency**: wiremd.md trimmed from 325 → 141 lines (57% reduction)
- **Version bumps to 0.1.0** (signals marketplace maturity):
  - product: 0.0.4 → 0.1.0
  - wordsmith: 0.0.7 → 0.1.0
  - founder: 0.0.4 → 0.1.0
  - career: 0.0.4 → 0.1.0
  - design: 0.0.2 → 0.1.0

### Fixed

- fix(founder): Broken 10-10-10 reference in regret-minimization.md (now points to hope)
- fix(product): Duplicate "Use ask tool" line removed from research.md

---

## [counsel@0.2.0] - 2025-12-31

### Added

- feat(counsel): Gabriel Vergnaud expert profile for TypeScript type-level programming
  - Based on Type-Level TypeScript course (12 chapters)
  - Philosophy: types as sets, type system as real programming language
  - Focus: conditional types, infer, mapped types, recursive types, TS-Pattern
  - Trigger keywords: type-level, generics, conditional types, infer, mapped types, TS-Pattern

### Fixed

- fix(product): Replaced broken Pareto reference with Impact-Effort in SKILL.md
- fix(wordsmith): Replaced broken Six Hats reference with Productive Thinking in SKILL.md
- fix(hope): Removed broken Pareto and Sunk Cost references from opportunity-cost.md
- fix(hope): Version mismatch in SKILL.md (0.4.5 → 0.4.6)

### Changed

- docs(CLAUDE.md): Clarified "nested references" rule - subdirectories allowed, chains forbidden
- **design**: New plugin for design exploration workflows
  - Router skill with 8 workflows for design thinking
  - `/design:constraints` - Surface technical, brand, and accessibility limits
  - `/design:journey` - Map user journey with stages, emotions, touchpoints
  - `/design:ia` - Information architecture with structure options and labeling
  - `/design:directions` - Generate 3 distinct visual directions (conceptual)
  - `/design:system` - Establish design system principles (conceptual)
  - `/design:copy` - Explore microcopy in 3 brand tones
  - `/design:compare` - Competitive UX flow teardown (Trigger-Action-Reward)
  - `/design:critique` - Structured design feedback giving/receiving
  - Philosophy: Exploration mode, anti-convergence, accessibility-first
  - No visual execution (conceptual output only)

### Changed

- **design**: Revised all 8 workflows based on counsel panel audit
  - Shortened workflows to 60-80 lines (principle-based, not template-heavy)
  - Added global "never assume" rule to SKILL.md router
  - Added Source/Confidence tracking for all required inputs
  - Added Evidence Check table to journey.md
  - Added explicit Reasoning Step to directions.md, journey.md, ia.md
  - Added Commitment Readiness with handoff artifacts to all workflows
  - Added cross-workflow references (Before/After/Complements)
  - Lowered confidence threshold from 50% to 30% in journey.md (per panel recommendation)
  - Added Usage Modes to copy.md (standard vs exploratory)

---

## [0.5.0] - 2025-12-20

### Added

- **counsel**: New plugin for expert simulation
  - Channels documented expert perspectives (Addy Osmani, Rich Hickey, Adam Wathan, Kyle Simpson)
  - `/counsel:summon` - Single-expert invocation with explicit confidence
  - `/counsel:panel` - Multi-expert debates for design decisions
  - `/counsel:calibrate` - Correct simulation errors with persistent calibrations
  - Hybrid expert source: curated profiles (high confidence) + dynamic inference (lower confidence)
  - Project-local calibration logs (`.claude/logs/counsel-*.jsonl`)
- **docs**: Power user reference for counsel plugin (`docs/plugins/counsel.md`)
- **eval**: Skill evaluation framework with git pre-push hook
  - Pre-push hook runs evals only for changed plugins
  - Local testing via `./eval/run.sh --simple`
  - 5 test cases for skill auto-triggering (hope:gate, hope:soul, hope:trace, product, wordsmith)

### Removed

- **ci**: Removed all GitHub Actions workflows (eval, claude-code-review, claude)
  - Replaced with local git hooks (zero dependencies, faster feedback)

---

## [0.4.5] - 2025-12-15

### Added

- **hope**: New Quality Footer format with verdict box (🟢 SHIP / 🟡 MONITOR / 🔴 RESEARCH)
- **hope**: Single source of truth reference file `references/quality-footer.md`

### Changed

- **hope**: All commands now reference Quality Footer instead of inline duplication
  - Updated: interrogate, reframe, mirror, plan, postmortem, future, debug
- **docs**: Plugin docs moved to `docs/plugins/`
- **docs**: Internal docs (audit, research, adrs) moved to `docs/dev/`
- **docs**: Added `docs/index.md` navigation hub
- **docs**: Fixed hope.md: "Three skills" → "Four skills", added Thinking Tools section
- **CLAUDE.md**: Updated structure comment, added DRY anti-pattern for docs
- hope plugin version 0.4.4 → 0.4.5

---

## [0.4.4] - 2025-12-14

### Added

- **hope**: SessionStart hook now injects today's date (e.g., "Today's date is 14 December 2025") into Claude's context

---

## [0.4.3] - 2025-12-14

### Added

- **6 thinking tools** (Farnam Street research):
  - `incentives.md` - Munger's "show me the incentive" for predicting/explaining behavior
  - `bottlenecks.md` - Goldratt's Theory of Constraints for finding binding limits
  - `steel-man.md` - Argue against strongest version of opposing positions (Dennett/Rapoport)
  - `deliberate-practice.md` - Expert skill development at edge of competence (Ericsson)
  - `grey-thinking.md` - Avoid binary thinking, dose makes the poison (Paracelsus)
  - `systems-over-goals.md` - Habits compound, goals have endpoints (Clear/Adams)

### Changed

- hope plugin version 0.4.2 → 0.4.3
- Thinking tools count 28 → 34
- Systems category now includes Incentives and Bottlenecks
- Decision category now includes Grey Thinking
- Prioritization category now includes Systems Over Goals
- Communication category now includes Steel Man
- Creative category now includes Deliberate Practice
- PHILOSOPHY.md: Added "Foundation" section (decision-making as learnable skill)
- `pre-mortem.md`: Added "Practice Failure" section - simulate, don't just anticipate
- `circle-of-competence.md`: Added "Evaluating Others' Expertise" section
- `bayesian-thinking.md`: Added "Grey Thinking Integration" section

---

## [0.4.2] - 2025-12-13

### Removed

- **7 redundant thinking tools** (bloat reduction per Anthropic guidelines):
  - `hanlons-razor.md` - Too niche (5% use cases)
  - `occams-razor.md` - First Principles is more actionable
  - `mece.md` - Principle is embedded in Issue Trees
  - `pareto.md` - Covered by Impact-Effort matrix
  - `sunk-cost.md` - Single-concept, merged note into Opportunity Cost
  - `lindy-effect.md` - Bayesian heuristic, not standalone tool
  - `six-hats.md` - 70% overlap with Productive Thinking

### Added

- **Default Tools section** in hope SKILL.md - 6 go-to tools for common situations
  - Follows Anthropic's "default with escape hatch" pattern
  - Reduces decision paralysis from 27+ tool options

### Changed

- hope plugin version 0.4.1 → 0.4.2
- Thinking tools count 35 → 28
- Tools table now has "Default Tools" + "All Tools" structure

---

## [0.4.1] - 2025-12-13

### Added

- **Munger's 25 Cognitive Biases** checklist in `hope/skills/soul/references/tools/munger-biases.md`
  - Pre-decision bias check for high-stakes decisions
  - Quick checklist for scanning common misjudgments
  - Lollapalooza effect warning (multiple biases combining)

### Changed

- hope plugin version 0.4.0 → 0.4.1
- Thinking tools count 34 → 35

---

## [0.4.0] - 2025-12-13

### Added

- **5 Strategic Frameworks** (meta-level thinking frameworks):
  - `hope/skills/soul/references/handshake.md` - Align/Build/Commit for driving action
  - `hope/skills/soul/references/scope.md` - SCOPE pre-analysis right-sizing
  - `hope/skills/soul/references/leverage-points.md` - Donella Meadows' 12 intervention points
  - `hope/skills/soul/references/spot.md` - SPOT pattern recognition → action
  - `wordsmith/skills/writing/references/open-loop.md` - Zeigarnik retention framework
- **4 new thinking tools**:
  - `hope/skills/soul/references/tools/bayesian-thinking.md`
  - `hope/skills/soul/references/tools/lindy-effect.md`
  - `hope/skills/soul/references/tools/map-territory.md`
  - `hope/skills/soul/references/tools/opportunity-cost.md`
- **2 product references**:
  - `product/skills/product/references/jobs-to-be-done.md`
  - `product/skills/product/references/systems-archetypes.md`
- **1 career reference**:
  - `career/skills/career/references/10-10-10.md`
- Strategic Frameworks section in hope SKILL.md
- Open Loop reference in wordsmith SKILL.md
- Content audit in `docs/audit/`

### Changed

- hope plugin version 0.3.0 → 0.4.0 (strategic frameworks + 4 tools)
- wordsmith plugin version 0.0.3 → 0.0.4 (Open Loop framework)
- product plugin version 0.0.2 → 0.0.3 (JTBD, Systems Archetypes references)
- career plugin version 0.0.2 → 0.0.3 (10/10/10, Feynman references)
- founder plugin version 0.0.2 → 0.0.3 (Regret Minimization reference)
- Thinking tools count 30 → 34
- Frameworks now separate from tactical tools (strategic vs tactical)

---

## [0.3.0] - 2025-12

### Added

- **8 new thinking tools** in `hope/skills/soul/references/tools/`:
  - Razors: Occam's Razor, Hanlon's Razor
  - Fallacies: Sunk Cost Fallacy
  - Prioritization: Pareto Principle (80/20)
  - Risk: Pre-Mortem Analysis (Gary Klein)
  - Boundaries: Circle of Competence, Chesterton's Fence
  - Problem Structure: MECE Principle (McKinsey)
- **Regret Minimization Framework** in `founder/skills/founder/references/`
- **Feynman Technique** in `career/skills/career/references/`
- 4 new tool categories in SKILL.md (Razors, Fallacies, Risk, Boundaries)

### Changed

- hope plugin version 0.2.0 → 0.3.0 (8 new tools)
- Tools count 22 → 30

---

## [0.2.0] - 2025-12

### Added

- **22 Thinking Tools** in `hope/skills/soul/references/tools/`:
  - Root Cause: Ishikawa (fishbone), Iceberg Model
  - Domain: Cynefin Framework
  - Decision: OODA Loop, Ladder of Inference, Decision Matrix, Hard Choice Model
  - Prioritization: Eisenhower Matrix, Impact-Effort Matrix
  - Systems: Second-Order Thinking, Feedback Loops, Connection Circles, Concept Map
  - Creative: Six Thinking Hats, Zwicky Box, Abstraction Ladder, Productive Thinking
  - Communication: Minto Pyramid (SCQA), SBI Feedback, Conflict Resolution
  - Problem Structure: Issue Trees (MECE), First Principles
- Tools index table in `hope/skills/soul/SKILL.md`
- Cross-references to thinking tools in trace, product, founder, career, wordsmith skills
- PHILOSOPHY.md with core principles
- CHANGELOG.md with version history
- Career plugin to README plugin list
- Changelog section to CLAUDE.md with commit guidelines
- Install section to docs/hope.md (consistency with other plugins)
- Version field to product, founder, career skill frontmatter

### Changed

- Categories now use `core` (hope) and `domain` (satellites)
- CLAUDE.md structure diagram reflects all 5 plugins
- Quality footer now includes "Key Assumption" field (CLAUDE.md)
- Reference file rule clarified: intra-plugin sharing allowed
- Plugin.json structure documented with marketplace.json note
- hope plugin version 0.1.2 → 0.2.0 (thinking tools)
- career plugin version 0.0.1 → 0.0.2 (tool references)
- founder plugin version 0.0.1 → 0.0.2 (tool references)
- product plugin version 0.0.1 → 0.0.2 (tool references)
- wordsmith plugin version 0.0.2 → 0.0.3 (tool references)

### Fixed

- Version mismatch in hope/skills/soul/SKILL.md (0.0.1 → 0.1.2)
- "cVoice" typo in marketplace.json
- Missing version field in product/founder/career SKILL.md frontmatter

---

## [0.1.2] - 2025-12

### Added

- `/hope:intent` command for clarification protocol

---

## [0.1.1] - 2025-12

### Added

- Career plugin with 10 commands (assess, simulate, star, gap, drill, eval-comm, stakeholder, reframe, focus, osint)
- Founder plugin with 8 commands (validate, market-size, compete, pitch, investor-prep, financials, launch, board)
- Founder power user reference docs
- Career power user reference docs

### Fixed

- Missing hookEventName in UserPromptSubmit hook
- Career plugin.json name, description, and keywords

---

## [0.1.0] - 2025-12

### Added

- Learnings recall skill with auto-triggering
- Learnings compaction command
- Smart gating for learnings
- User documentation for all plugins
- `/document` command for repo maintenance

### Changed

- Documentation rewritten with progressive disclosure
- Keyword-first approach in docs
- Simplified update instructions
- Cut journey tutorials, consolidated navigation (-54% docs)

---

## [0.0.2] - 2025-11

### Added

- Hope plugin (soul, gate, trace, recall skills)
- Product plugin (prd, compete, research, metrics, cohort, prd-eval, debt)
- Wordsmith plugin (edit, voice, narrative, copy, blog-eval)
- Session lifecycle hooks
- Learnings system (`~/.claude/learnings/`)

### Changed

- Initial public structure

---

## Notes

- **hope** is the core plugin (category: `core`)
- **product**, **wordsmith**, **founder**, **career**, **counsel**, **design** are domain plugins (category: `domain`)
- Domain plugins recommend but don't require hope
- Versioning applies to the marketplace; individual plugins have their own versions in plugin.json
