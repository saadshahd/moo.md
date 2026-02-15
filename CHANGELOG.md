# Changelog

All notable changes to moo are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- feat(hope): argument-hint frontmatter on all 10 commands that accept arguments — autocomplete discoverability
- chore: CLAUDE.md command frontmatter convention with argument-hint documentation

### Changed
- fix(hope/soul): description rewrite — WHAT+WHEN pattern, drop catch-all trigger
- fix(hope/consult): description rewrite — lead with purpose ("Simulate expert reasoning")
- fix(hope/search): description rewrite — lead with purpose ("Pattern reference")
- fix(hope/loop): description rewrite — lead with purpose ("Execute work in verified waves")
- fix: CLAUDE.md description trap warning rewritten to WHAT+WHEN pattern (per Anthropic guide)
- fix: CLAUDE.md SubagentStart hook type corrected from "(prompt)" to "(command)"
- fix: CLAUDE.md project-level hooks table — add SessionStart, PostToolUse (roadmap-guard), Stop
- fix: CLAUDE.md remove stale `prompts/` directory from structure tree

---

## [hope@3.8.1] - 2026-02-14

### Changed
- refactor(hope/consult): Restructure panel output from per-expert monologues to concern-oriented format — enforced via prohibitions, not template suggestions
- refactor(hope/consult): Merge user-facing and pipeline-invoked panel modes into one unified format
- refactor(hope/consult): Gate full expert positions behind explicit user request ("expand"/"detail") — progressive disclosure by default

---

## [hope@3.8.0] - 2026-02-14

### Added
- feat: Belief 5 — human cognitive energy as hidden bottleneck (generation/evaluation asymmetry)
- feat: Principles "Hypothesis before artifact", "Probe before shipping" (from belief 5)
- feat: Hard constraint 10 — "Default to less. Expand on request."
- feat: Unstuck entry — "Understanding stuck"
- feat: ROADMAP.md — project roadmap with maturity tracking (raw/explored/shaped)
- chore: SessionStart hook surfaces pending roadmap item count (.claude/scripts/roadmap-surface.sh)
- chore: PostToolUse hook validates ROADMAP.md line count and line length (.claude/scripts/roadmap-guard.sh)
- chore: Stop hook nudges roadmap updates at session end (.claude/scripts/roadmap-stop.sh)
- feat(hope/intent): BLAST RADIUS field in work order brief — names what breaks if intent is wrong
- feat(hope/soul): Communication Depth table — risk-adaptive output depth (Trivial/Standard/Critical)
- feat(hope/soul): "User confused?" every-turn check — operationalizes Understanding stuck unstuck entry
- feat(hope/shape): Pre-mortem gate after Synthesize — fires for Critical risk tier only
- feat(hope/loop): Pyramid-structured final report (OUTCOME → DECISIONS → EVIDENCE → DETAILS)
- feat(hope/loop): Probe before shipping — one question targeting understanding gaps
- feat(hope/loop): Carry items now include what was tried, why it failed, what it eliminated
- feat(hope/loop): Wave reports risk-ordered (highest-impact first)
- feat(hope/consult): Progressive disclosure for user-facing panel (consensus → tension → detail on request)
- docs: Statechart annotations for pre-mortem gate, probe question, user-confused check

### Changed
- feat: "Signal over noise" principle — added output proportionality dimension
- feat: "Retrieved over recalled" principle — added ATP conservation dimension (tools > human questions)
- feat: Deepened Belief 1 with failure-as-knowledge dimension
- feat: Added "Boundaries over aspirations" principle (from belief 1)
- feat: Added "Co-located over separated" principle (cross-cutting)
- feat: Added per-step completion markers to skill author constraints
- feat: Updated unstuck strategy with failure context preservation
- chore: Synced CLAUDE.md philosophy summary and compact instructions

---

## [hope@3.7.11] - 2026-02-11

### Changed
- feat(hope): ExitPlanMode sequential deny chain replaces two-pass gate — fixes dead Pass 2 (Type: vs Pipeline: mismatch), all decisions hard deny, max 3 denials, handles both marker formats

---

## [hope@3.7.10] - 2026-02-11

### Fixed
- fix(hope): CLAUDE.md stale facts — skill count (7→8), command count (8→9), profile count (42→74), hooks list (removed ghost UserPromptSubmit, added PreToolUse entries)

### Added
- chore: project-level PostToolUse:Write/Edit hook — warns when SKILL.md exceeds 200 lines (.claude/settings.json)
- chore: project-level PreToolUse:Write hook — blocks writes to references/ directories (.claude/settings.json)
- docs(dev): git hook setup instructions in local-development.md

### Changed
- chore: marketplace.json updated to reflect 8 skills with forge/search keywords
- chore: removed Bash(cat) and Bash(find) from settings.local.json permissions — use Read/Glob instead

---

## [hope@3.7.9] - 2026-02-11

### Changed
- feat(hope): ExitPlanMode hook verifies plan covers original request (deny-then-ask two-pass gate)

---

## [hope@3.7.8] - 2026-02-11

### Added
- feat(hope): PreToolUse ExitPlanMode gate — soft-advises when exiting plan mode without completing pipeline phases (intent/shape per session type)

---

## [hope@3.7.7] - 2026-02-11

### Added
- feat(hope): Lamport expert profile — formal specification, TLA+, distributed systems consensus
- feat(hope): Kleppmann expert profile — data systems, CRDTs, distributed correctness, local-first
- feat(hope): new "Distributed Systems / Formal Verification" domain row in consult routing

---

## [hope@3.7.6] - 2026-02-11

### Removed
- refactor(hope): removed Stop hook (task completion check on session end)

---

## [hope@3.7.5] - 2026-02-11

### Added
- feat(hope): forge skill — interactive creation of persistent expert agents (.claude/agents/) with dynamic skill discovery
- feat(hope): /hope:forge command

### Changed
- feat(hope): shape skill — expert-driven consultation replaces 5-aspect scoring matrix; domain experts analyze intent brief and recommend collaboration mode with cited evidence
- refactor(hope): shape handoff — direct to loop (consultation happens within shape, no separate post-shape validation required)
- refactor(hope): full.md Stage 4 — now optional review pass for Build/Debug/Plan (shape includes consultation)

### Removed
- refactor(hope): removed hardcoded Skill() cross-reference anti-pattern from CLAUDE.md (conflicts with established explicit Skill() call pattern)

---

## [hope@3.7.4] - 2026-02-11

### Added
- feat(hope): dedicated SubagentStart hook — compact soul primer + pipeline state extraction replaces full SKILL.md injection
- feat(hope): PreToolUse deny-grep hook — blocks raw grep/rg Bash calls in favor of dedicated Grep tool
- feat(hope): Stop hook — checks task completion before session end

### Changed
- refactor(hope): SubagentStart extracts [SESSION], OBJECTIVE, criteria[], mustNot[], ACCEPTANCE, STOP CONDITIONS from transcript instead of injecting full soul skill

---

## [hope@3.7.3] - 2026-02-11

### Changed
- refactor(hope): imperative framing across all 6 skills — STRATEGIZE/CLARIFY/SIMULATE/SHAPE/EXECUTE/COMPOSE replace "You are..." identity claims
- refactor(hope): soul audit table with concrete checks (spec clear? approach shaped? facts retrieved?) replacing prose
- refactor(hope): shape entry guard routes back to intent when ACCEPTANCE criteria missing
- refactor(hope): shape citation quality requires observable evidence (file names, line counts), not adjectives
- feat(hope): loop conditional decomposer agent — spawns Explore for multi-module/unfamiliar codebase analysis
- feat(hope): bond creates team with full pipeline context after user approval, each member executes using loop mechanics
- refactor(hope): full.md routes after bond — team path skips loop, solo path runs loop
- refactor(hope): removed ensure-soul.sh per-turn hook

---

## [hope@3.7.2] - 2026-02-10

### Changed
- refactor(hope): loop consult invocations converted from natural language to explicit Skill() calls

---

## [hope@3.7.1] - 2026-02-10

### Changed
- refactor(hope): removed allowed-tools from all 5 skill frontmatters (bond, consult, loop, shape, soul)
- refactor(hope): loop model changed from sonnet to opus
- fix(hope): consistent markdown table alignment across all skills

---

## [hope@3.7.0] - 2026-02-10

### Added
- feat(hope): 30 new expert profiles across 11 cross-disciplinary domains (Psychology, Systems Thinking, Strategy, Communication, Anthropology, Economics, Philosophy, Sociology, Biology, Education, Security)
- feat(hope): kahneman profile folds Tversky's concepts (prospect theory, framing, loss aversion)
- feat(hope): goodhart profile folds Campbell's Law alongside Goodhart's Law
- feat(hope): cross-domain literature referenced within profiles (Antifragile, Mythical Man-Month, How Buildings Learn, Systemantics, Metaphors We Live By, Zen and the Art of Motorcycle Maintenance, The Reflective Practitioner)

### Changed
- feat(hope): norman.md enriched with Gulf of Execution/Evaluation, 7 stages of action, error classification, Design of Future Things
- feat(hope): consult SKILL.md domain table expanded from 14 to 25 rows, profile count 42 → 72
- refactor(hope): intent, panel, summon commands → thin routers with proper Skill() invocation
- feat(hope): consult skill absorbs Review Mode (BLOCKER/WARNING/SUGGESTION findings, interactive loop) from panel command
- feat(hope): consult panel mode uses 2-4 experts with progressive expansion (aligned with statechart)
- feat(hope): consult panel mode recognizes TRADEOFF:/CONSTRAINT: context slots
- docs: statechart consult detail adds Review path to Panel Mode + escalate→review link from Unblock

---

## [hope@3.6.1] - 2026-02-10

### Changed
- fix(hope): corrected all 6 skill-to-primitive composition mappings in composable-primitives.md — validated against actual SKILL.md step-by-step flows
- feat(hope): consult emits `[EXTRACT] Key insight` checkpoint after every response (serves Law 1: Conservation of Understanding)
- feat(hope): bond self-audit emits results before presenting blueprint (makes Verify visible)

### Added
- docs: hook-primitive mapping — how SessionStart, UserPromptSubmit, SubagentStart, PreCompact map to primitive contracts
- docs: compose parameters — circuit breaker thresholds, escape actions, mustNot enforcement as cross-cutting rules
- docs: consult mode-specific compositions — single, panel, unblock each mapped to distinct primitive sequences

---

## [hope@3.6.0] - 2026-02-10

### Added
- feat(hope): feedback loop in loop — carry items include `[VERIFY] FAIL: [reason]` in retry spawn prompt so retries transform with context, not from scratch
- feat(hope): disposability signal in shape — `Disposable: [yes/no]` emitted from aspect scores; loop treats disposable work with ≤ 3 items
- feat(hope): understanding extraction in loop — `[LEARN]` marker in wave reports captures domain insight, not just progress
- feat(hope): retrieve-vs-ask decision rule in loop — WHAT/WHY questions ask user, HOW/WHAT-EXISTS questions retrieve with tools
- docs: composable primitives — type contracts (Gate, Transform, Verify, Extract, Zoom, Compose), three laws, category theory alignment, FP parallels

---

## [hope@3.5.4] - 2026-02-10

### Added
- feat(hope): /hope:full command — explicit pipeline orchestrator that guarantees session → intent → shape → consult → loop sequence

### Changed
- feat(hope): consult promoted to pipeline stage — Build/Debug/Plan now route through consult after shape for visible expert validation before execution
- feat(hope): shape "After Shape" handoff routes through consult before loop/output
- feat(hope): all cross-skill references converted from natural language ("invoke /hope:X") to explicit Skill() tool syntax across soul, intent, shape, and full command
- feat(hope): statechart updated — §1 pipeline transitions, §5 consult invocation sources, §8 commands table
- feat(hope): shape "After Shape" handoff — routes Build/Debug to loop, Plan to output after Action Bridge
- feat(hope): ensure-soul softened from pipeline mandate to informational reminder, surfaces /hope:full as guaranteed path

---

## [hope@3.5.1] - 2026-02-10

### Fixed
- fix(hope): pipeline delivery — ensure-soul rewritten from evaluation checklist to action directives (Opus 4.6 follows explicit numbered steps, not self-evaluation checklists)
- fix(hope): SessionStart hook changed from async to sync — soul content now available on turn 1 instead of turn 2
- fix(hope): intent → shape handoff — added Skill to allowed-tools, "After Brief" section auto-invokes next pipeline stage instead of passive NEXT label
- fix(hope): soul silent audit shape gate strengthened — "SHAPE first" replaced with explicit "Invoke /hope:shape — do not write code without shaped criteria"
- fix(hope): loop wave spawn now includes intent ACCEPTANCE criteria and STOP conditions for subagent verification

### Added
- feat(hope): PreCompact hook — extracts [SESSION] marker, intent brief, shape output, and loop progress before compaction to ensure state survival
- docs: hooks architecture section in CLAUDE.md — sync/async rationale, key learnings from impact analysis

---

## [hope@3.5.0] - 2026-02-09

### Changed
- feat(hope): retrieval-first enforcement — codified "retrieved over recalled" principle across pipeline. Shape requires search evidence before scoring Novelty and reading manifests before Feasibility filtering, with strict self-audit fail on recall-only Because columns. Loop spawn prompts and post-work gate now mandate retrieval. Soul silent audit surfaces grounding status every turn. SubagentStart hook injects retrieval mandate to all spawned agents. PHILOSOPHY.md adds principle + hard constraint #9. CLAUDE.md philosophy audit gains retrieval check.

---

## [hope@3.4.0] - 2026-02-08

### Added
- feat(hope): bond skill — team composition thinking. Assesses task fitness (Team/Subagent/Solo) across 4 dimensions (Independence, File ownership, Coordination, Scope), designs team structure with role boundaries and coupling checks, emits creation spec for native agent team tools after user approval. 3-step pipeline (assess → design → confirm+handoff). Session-aware decomposition using Horizon. Anti-pattern detection for common team failures. Pipeline context scan for upstream shape/feasibility. `/hope:bond` command as entry point.
- feat(hope): statechart §6 — bond detail with Mermaid state diagram. Invocation from `/hope:bond` command or shape trigger (high Independence + large Scope). Section numbers shifted: Soul→§7, Hooks→§8, Cross-cutting→§9, Mapping→§10.
### Changed
- feat(hope): explicit mission statement — three aims (reduce decision regret, increase conceptual clarity, fewer but stronger artifacts) added to PHILOSOPHY.md and CLAUDE.md. Profile curation stance replaces "never shrink" accumulation. Philosophy Audit gains aim-alignment check.
- refactor(hope): bond audit — 8 fixes. Separated thinking from creation (bond designs, Claude orchestrates with native tools). Moved anti-patterns into assessment, self-audit inline after blueprint. Added pipeline context scan and integration section. Replaced time estimates with story points. Added deadlock prevention (max 3 adjust revisions). Updated statechart deadlock table.
- feat(hope): loop skill tightened against three aims — monitor would-reframe-if conditions during waves, sequence reversible items before irreversible, self-documenting fit score formula rationale
- feat(hope): command cleanup — removed Usage, Inputs, and Output template sections from 5 commands (panel, summon, block, unblock, blocked). Commands now use `$0` substitution directly and keep only the protocol Claude needs to execute. -111 lines total. Intent command already clean, unchanged.

### Removed
- chore: eval system — deleted `eval/` framework (runner, layers, configs), `hope/eval/` test cases (39 YAML files), `docs/dev/evaluations.md`. Pre-push hook retains structural validation (line counts, frontmatter, no references/).

---

## [hope@3.3.0] - 2026-02-08

### Changed
- feat(hope): commands as thin wrappers — intent command (148→47 lines) delegates protocol to intent skill, eliminating 8-step/5-step divergence. Panel command (158→95 lines) delegates debate/unblock to consult skill, removes stuckCount ghost reference and duplicated selection/output logic. Commands own entry point (input capture, context slots, mode routing); skills own behavior.
- feat(hope): Opus 4.6 audit evolution — shape aspects reduced from 8 to 5 (keep Interdependency, Novelty, Risk, Ambiguity, Reversibility; drop Decomposition, Domain Knowledge, Verification). Fit score simplified to `spec_score×5 + domain_familiarity` with adjusted thresholds (35+/25-34/15-24/<15). Quality footer conditional on decision type (full for Type 1, one-line for Type 2A/2B, omit for trivial). Silent audit trimmed to 4-check gate (spec, fit, shape, verification). Intent clarify dimensions aligned with 5 spec scoring dimensions. Expert consultation gated on actual uncertainty (2+ aspect disagreement or Risk-Colleague). Review & feedback lightened to 3-item journey summary. Consult hedging guardrail uses grounding tiers as calibration. Panel diversity rule: max 2 from same domain row.

### Removed
- feat(hope): Loop 1/Loop 2 framework from intent command (redundant with spec scoring protocol)
- feat(hope): Clarification Mode from panel command (redundant with intent clarification)
- feat(hope): Light Review mode from panel command (extended thinking handles inter-wave quality)
- feat(hope): Tool Discovery section from loop (native to Claude Code)
- feat(hope): File context shortcuts from consult (Opus 4.6 infers from file context natively)

### Added
- feat(hope): SessionStart hook — injects full soul SKILL.md at session start via `session-start.sh`, guaranteeing hope is active without relying on auto-trigger. UserPromptSubmit retained as per-turn reminder. Re-enables SessionStart after #16538 fix.
- feat(hope): bucket categorization with coverage flags — 5 token-neutral swaps across loop, shape, consult that prevent silent item drops in list processing. Loop: wave reports bucket items into Done/Carry/Stall with arithmetic coverage invariant; verification names each criterion in Pass/Fail/Unverified buckets; decomposition enforces bidirectional criteria[] mapping. Shape: self-audit names scored vs deferred aspects (not just count). Consult: panel self-audit merges voice coverage with least-grounded check (voiced/silent: names). Net -1 word across all swaps.
- feat(hope): evaluation table with comparative scoring — 3 token-neutral swaps integrating forced side-by-side comparison grids at decision points. Consult: panel synthesis uses scored grid (divergent approaches) or bullet synthesis (unanimous), replaces prose Consensus/Dissent. Shape: approach comparison grid when 2+ technical approaches surface, replaces redundant DOT decision graph. Intent: interpretation comparison grid at spec score 5-7 when 2+ interpretations diverge on 2+ dimensions, replaces dead-weight Step 5 (Refine Constraints). All grids enforce spread (≥1 cell ≤3, ≥1 ≥8) with anchored scale (0=clearly no, 10=clearly yes). 3 new eval cases.
- feat(hope): future-self horizon — session-level Tactical/Strategic/Existential time horizon across soul, intent, shape, loop. Soul captures horizon alongside engagement (infer from signals when clear, ask when ambiguous). Intent grounds STAKES to horizon, emits HORIZON field in brief. Shape uses horizon tiebreaker on split aspect scores. Loop tunes decomposition strategy by horizon. Infrastructure: ensure-soul.sh, hooks.json, statechart updated. Token-neutral (4 skill swaps, 0 net lines).

- feat(hope): aha moment invitations — 6 token-neutral swaps across soul, intent, consult, loop that activate evidence-gated revision at points where premature framing causes downstream waste. Soul: session type re-detection when TASK verb contradicts initial classification. Intent: TASK verb revision gate when clarification answers contradict Step 1 framing. Consult: expert pushback escalation from approach-level to problem-level reframing; panel synthesis leads with emergent insight when recommendation differs from all expert positions. Loop: plan-changing announcement replaces shape-downgrade priming; REFRAME finding type operationalizes statechart's loop→intent back-transition. Net -23 chars.

- feat(hope): structured output templates — 7 labeled-field skeletons across all 5 skills replacing prose instructions. Shape: scored aspects table with tally row. Loop: wave progress checklist + journey summary with 3 decision rows. Consult: unblock diagnosis template. Soul: audit interrupt surface. Intent: clarification round tracker + typed spec score table with inline routing.

- feat(hope): reasoning visibility — engagement-gated [BRACKET] markers ([SCORING], [GATE], [CONFIDENCE], [TALLY], [AUDIT]) at 7 evaluation points across all 5 skills. Guided engagement surfaces reasoning at spec scoring, fit calculation, post-work gate, confidence modifiers, tally detection, audit verdicts. Other engagement levels unchanged. Token-negative (net -22 words).

- feat(hope): evidence-driven self-correction — 6 token-neutral swaps across loop, consult, shape, soul. Replaces vague menus ("continue, pivot, escalate") and confirmation-seeking framing ("match evidence") with instructions that use external feedback (execution output, expert findings, verification results) to revise plans. Loop: diagnose from output before revising decomposition, classify blockers as approach-level vs item-level, diagnose verification failures from output. Consult: re-diagnose from failure output between unblock attempts. Shape: re-score only contradicted aspects. Soul: derive verdict from evidence (arrow notation). Net -12 words.

### Changed
- feat(hope): grounding tiers — replaced absolute confidence scores (X/10) with categorical provenance tiers (Documented/Inferred/Extrapolated) across consult skill, panel + summon + intent commands, and statechart. Adds relative ranking: panel synthesis surfaces least-grounded position, unblock mode names weakest diagnostic link. Aligns consult with soul's flip-scenario and shape's would-change-if patterns. Updated 7 eval cases. Fixed stale "≥ 95% confidence" in statechart and intent command. Token-neutral.
- feat(hope): multi-objective prompting — 7 tension-based instruction swaps across all 5 skills. Replaces single instructions with 3-4 parallel objectives that create productive tension between competing dimensions. Intent: clarify questions (gap-closing vs brevity vs adversarial) + brief emission (testability vs realism). Shape: aspect table (observables vs checkability). Consult: single expert (friction vs action) + panel synthesis (consensus strength vs dissent). Soul: footer verdict (evidence vs falsification). Loop: wave reports (evidence vs weakness flagging). Token-negative (net -10 lines).
- feat(hope): capability framing — 7 identity→capability swaps across soul, consult, loop skills. Replaces "Claude advises/discloses/teaches" with behavioral clauses ("surface tradeoffs, show reasoning chain, frame gaps as questions"). Consult activation shifts from "apply philosophy and voice" to "reason from documented positions to user context, filter through would-never-say, match voice density not persona." Token-neutral (net -1 lines).
- feat(hope): Self-audit blocks — replaced advisory prose with binary `SELF-AUDIT →` gates across all 5 skills. Each gate demands pass/fail with cited evidence from the model's own output. Soul: footer completeness (silent). Intent: brief structure (7-12 bullets, 2+ must-NOT). Shape: output completeness (aspects, criteria, mustNot). Loop: pre-gate (verification method + mustNot) and post-gate (no assumption-only done). Consult: panel dissent/test presence, single-expert domain boundary. Token-neutral (net -12 lines).
- feat(hope): Compression signals — density directives with protect/sacrifice priorities on 12 previously unconstrained output fields across all 5 skills. Consult: expert voice (dense: protect stance), panel positions (≤3 sentences), synthesis fields (≤10-20w each). Soul: footer Basis (≤12w) and Unverified (≤15w). Intent: acceptance criteria (≤20w/bullet). Shape: "Would change if" (≤15w). Loop: journey summary (≤10 lines). Plugin goes from 7 to 19 density controls.
- feat(hope): Numeric hard constraints across all 5 skills — replaced vague quantifiers ("some", "multiple", "key") with exact counts. Intent: 3-5 questions/round, 3-7 blueprint steps, vague-quantity MCQ detection. Loop: 5-21 work items, top 3 decisions in summary. Shape: min 5/8 aspects scored. Consult: 2-3 panel tradeoffs. Soul: 1-3 unknowns, 2+ subsystems in complexity table.

### Added
- feat(hope): Feasibility filter — bind recommendations to one real-world constraint axis (time/solo/cost/tools/access). Session-type defaults (Build→solo, Debug→time), FEASIBLE: context slot, quality footer line, shape step 5b filter, panel/unblock grounding. 1 new eval case.
- feat(hope): Falsifiability — every score shows its inputs, every assertion names its negation test
  - soul: quality footer replaces subjective percentages with verification basis + unverified call-outs
  - intent: spec score table shows evidence per dimension and what would change the score
  - shape: aspect scoring outputs "Because" evidence and "Would change if" conditions
  - consult: expert confidence shows formula modifiers; panel synthesis includes evidence basis and test line
  - loop: fit score shows full calculation; VERIFY format calls out unverified assertions
- feat(hope): Context injection slots across all 5 skills — users paste labeled blocks (TASK/CONTEXT/DONE/STAKES/CONSTRAINTS) to skip clarification rounds
- feat(hope): Scaffold template in intent — "what do you need from me" emits fillable slot template
- feat(hope): Artifact injection in intent — ARTIFACT + ARTIFACT-TYPE slots for structured extraction from error logs, specs, PRDs, test output
- feat(hope): Panel position grounding — POSITION/TRIED/TRADEOFF/CONSTRAINT slots frame expert debates around user's actual stance
- feat(hope): Shape domain slots — PATTERNS/BOUNDARIES recognized as evidence for aspect scoring
- feat(hope): Loop acceptance slots — PASS/FAIL merge into criteria/mustNot during shape generation
- feat(hope): Soul session bridging — PRIOR/REFS slots enrich session marker with cross-session context
- feat(hope): 3 new eval cases — `intent-context-slots`, `intent-scaffold`, `panel-position-slot`

## [hope@3.2.0] - 2026-02-07

### Changed
- feat(hope): Enriched `ensure-soul.sh` hook — pipeline table, trivial-task gate, state evaluation checklist, compaction rules (1027 chars payload)
- feat(hope): Fixed soul description trap — trigger-only description, removed process summary that caused Claude to skip SKILL.md body
- feat(hope): Shape DOT graph now includes conditional expert consultation node — split/competing scores route to consult, unanimous scores bypass
- feat(hope): Shape Integration section uses natural language triggers instead of hardcoded skill references
- feat(hope): Consult skill-facing triggers added — "tradeoff", "evaluate approach", "expert input on", "review approach" patterns in When This Activates
- feat(hope): Loop pipeline awareness — scans conversation for existing intent/shape artifacts before re-running spec/shape
- feat(hope): Loop Cancel & Status sections compressed into single combined section

### Added
- feat(hope): 4 new pipeline trigger eval cases — `pipeline-intent-entry`, `shape-consult-bridge`, `consult-tradeoff-trigger`, `session-reflect-pipeline`
- feat(eval): Layer D soft-blocking in `--full` mode — quality rubric FAIL verdict now blocks test passage

### Removed
- feat(hope): Removed redundant standalone Expert Consultation section from shape (covered by Protocol Step 4)
- feat(hope): Removed hardcoded `hope:consult` and `/hope:soul` references from shape Integration

## [hope@3.1.0] - 2026-02-06

### Changed
- feat(hope): Rewrite `docs/statechart.md` — DOT → Mermaid `stateDiagram-v2`, multi-diagram hierarchy (top-level + 5 detail), session-type routing, soul interrupt edges, 4 consult invocation paths, concrete back-transition criteria, engagement-level effects table, cancel/circuit breakers/stall detection in loop, hook-to-state mappings, deadlock prevention guarantees
- chore: CLAUDE.md — add Mermaid exception for statechart in DOT Notation section

### Added
- **docs**: Local development guide (`docs/dev/local-development.md`) — `--plugin-dir` workflow, duplicate avoidance, isolation testing
- feat(hope): Compaction guidance in ensure-soul.sh — PRESERVE/DISCARD lists for context compression (inspired by AutoForge's PreCompact hook pattern)
- feat(hope): Enriched SubagentStart hook with compaction guidance for loop wave subagents
- **docs/statechart.md**: Canonical full-hierarchy statechart — all states, nested sub-states per skill, parallel regions, transitions, feedback loop. Single source of truth for plugin flow.

### Changed
- **PHILOSOPHY.md**: Major evolution — added core identity (primer concept), hierarchical state machine (DOT), hard constraints ("never do"), priming & loose coupling, unstuck strategy by stage
- **CLAUDE.md**: Updated philosophy section with priming + loose coupling beliefs, expanded audit checklist, added anti-patterns for hardcoded skill refs and cargo cult process
- **CLAUDE.md**: Added statechart reference and enforcement in philosophy section
- **PHILOSOPHY.md**: State machine section now references docs/statechart.md for full diagram
- **hope/loop**: Added Step 7 (Review & Feedback) — after verification, surface full journey for user review, gather feedback, re-enter loop if new work emerges
- **hope/loop**: Removed hardcoded Skill() calls in shape generation, expert review, and unblock steps — replaced with natural language triggers
- **hope/shape**: Removed hardcoded Skill() calls to consult — replaced with natural language expert consultation
- **PHILOSOPHY.md**: State machine includes feedback loop (completed → user_need when feedback yields new work)

## [hope@3.0.0] - 2026-02-06

### BREAKING CHANGES

**Three Plugins Merged into One**
- Merged counsel (expert simulation) and loop (autonomous iteration) into hope
- 15 skills reduced to 5: soul, intent, shape, loop, consult
- 16 commands reduced to 6: intent, panel, summon, block, unblock, blocked
- All `counsel:*` references become `hope:consult` or `hope:*` commands
- All `loop:*` references become `hope:loop`

**Session Strategy Replaces Workflows A/B/C**
- Soul now auto-detects session type: Build, Debug, Plan, Reflect
- Engagement level asked once per session: Autonomous, Collaborative, Guided
- `[SESSION]` marker persists through compaction
- Workflows A/B/C removed from soul (replaced by session types)

**Skills Absorbed**
- hope:verify absorbed into hope:loop (tool discovery, tiered verification, criterion types)
- hope:gate absorbed into hope:loop (pre/post-work checklists, anti-footgun rules)
- counsel:panel absorbed into hope:consult (panel mode within single skill)
- loop:cancel and loop:status absorbed as sections within hope:loop

### Added

- **hope:consult**: New unified skill merging counsel + panel (single-expert, panel, unblock modes)
- **hope:loop**: New unified skill merging loop:start + verify + gate
- **hope/soul**: Session type detection table (Build/Debug/Plan/Reflect)
- **hope/soul**: Engagement levels (Autonomous/Collaborative/Guided) with prompt
- **hope/soul**: Session marker `[SESSION] Type: X | Engagement: Y`
- **hope/intent**: Session-type context table adapting focus per session type
- **hope/shape**: Consult-driven expert consultation (replaces hardcoded expert table)
- **hooks**: SubagentStart hook for session strategy propagation to subagents
- **hooks**: Per-turn session strategy injector (ensure-soul.sh rewritten)
- **CLAUDE.md**: Compact Instructions section for compaction guidance
- **CLAUDE.md**: Skill Pipeline section showing intent → shape → loop → consult flow

### Changed

- **marketplace.json**: 1 plugin (was 3)
- **plugin.json**: Version 3.0.0
- **.github/hooks/pre-push**: Only validates hope plugin

### Removed

- **counsel/**: Entire directory (merged into hope/skills/consult/)
- **loop/**: Entire directory (merged into hope/skills/loop/)
- **Skills**: interactive-code-review, trace, breakthrough, presence, skill-judge, verify, gate
- **Commands**: debug, future, mirror, interrogate, reframe, postmortem, prime, slides, plan
- **hope/references/**: Entire directory
- **loop/ci/**: CI templates
- **hope/scripts/session-start.sh**: Replaced by per-turn injector
- **hooks**: SessionStart hook removed (broken for plugins, #16538)
- **docs/plugins/counsel.md**, **docs/plugins/loop.md**
- **docs/dev/skill-audit-2026-01.md**

### Migration Guide

**From v2.0.0 (3 plugins):**
- Install only `hope@moo.md` (counsel and loop are included)
- `counsel:counsel` → `hope:consult`
- `counsel:panel` → `hope:consult` (panel mode) or `/hope:panel` command
- `loop:start` → `hope:loop`
- `loop:cancel` / `loop:status` → absorbed into `hope:loop`
- `/counsel:summon` → `/hope:summon`
- `/counsel:block` → `/hope:block`

---

## [hope@1.0.0, counsel@1.0.0, loop@4.0.0] - 2026-02-06 (Marketplace Reset)

### BREAKING CHANGES

**Learnings System Removed**
- Deleted: hope:learn command, hope:recall skill
- Deleted: ~/.claude/learnings/ persistence (.jsonl files)
- Deleted: SessionEnd hook (was capturing learnings)
- Deleted: learnings.schema.json
- Users now rely on conversation history for learning patterns

**State File Persistence Removed**
- Deleted: .loop/workflow-state.json, current-context.json
- Deleted: workflow-state.schema.json, workflows-context.schema.json
- Deleted: SessionStart/Stop hooks from loop
- Execution now conversation-driven; state inferred from conversation context

**Task Management Removed from loop**
- Deleted: TaskCreate/TaskList/TaskUpdate integration
- Deleted: spawnTeam (agent teams)
- Deleted: team_score calculation
- loop:start now uses simple subagent waves only

**Plugins Simplified**
- Deleted: design, founder, product, wordsmith, career plugins
- Remaining: hope (9 skills), counsel (2 skills), loop (3 skills) — 14 total
- Why: Refocus marketplace on core philosophy

### Added

- **counsel:panel**: Explicit skill for multi-expert debate (was implicit mode within counsel)
- **counsel:panel**: New eval case (panel-trigger)

### Changed

- **hope:shape**: Outputs conversation only (no .loop/ files)
- **hope:gate**: Verifies inline via hope:verify + counsel:panel (no state file read)
- **loop:start**: Uses subagent skill invocation (no TaskCreate)
- **loop:status**: Reads conversation context (no workflow-state.json)
- **loop:cancel**: Conversation-based progress report (no state file update)
- **marketplace.json**: 3 plugins (was 8), all category: core
- **CLAUDE.md**: Removed State File Schemas section, updated anti-patterns
- **PHILOSOPHY.md**: Added Execution Model section, stateless principle

### Removed

- hope:recall skill, /hope:learn command
- hope/hooks/ SessionEnd hook, Setup hook
- hope/scripts/extract-learnings.sh
- loop/hooks/ (SessionStart, Stop hooks)
- loop/hooks/scripts/ (session-resume.sh, stop-check.sh)
- design/, founder/, product/, wordsmith/, career/ plugins
- schemas/ directory (learnings, workflow-state, workflows-context)
- counsel:calibrate command and calibration-persistence eval case
- counsel calibration system (.claude/logs/counsel-calibrations.jsonl)
- hope:compact command (learnings compaction)
- Eval cases: recall-trigger, team-detection, team-execution, wave-context, plan-approval-gate, calibration-persistence

### Migration Guide

**From v0.x (hope/counsel):**
- Learnings are not carried forward (conversation history is new source)
- Domain plugins must be re-installed if needed

**From v3.x (loop):**
- TaskList-based execution no longer available
- Use subagent waves instead of agent teams
- No session-resume or state file recovery
- loop:start is simpler (no orchestration overhead)

---

## [hope@0.23.0, loop@3.2.0] - 2026-02-06

### Fixed

- **loop**: Agents losing orchestration context after compact command — now explicit loop context bridge via .loop/current-context.json (Phase 1)
- **loop + hope**: Plan mode handoff breaking (EnterPlanMode escaping skill context) — hope:shape now always returns control, loop:start Step 2.5 approval gate (Phase 2)
- **loop**: Wave progress invisible to user — added [WAVE N START/COMPLETE] logging + context file updates
- **loop**: Agents executing manually instead of staying orchestrated — task descriptions now carry explicit LOOP CONTEXT preambles + counsel:panel scope reviews (Phase 3)

### Added

- **schemas**: New `workflows-context.schema.json` for `.loop/current-context.json` state file (wave metadata, phase tracking)
- **loop/start**: Phase 1 — file-based context propagation (verified feasible, replaces unfeasible env vars)
- **loop/start**: Phase 2 — plan approval gate (Step 2.5) with [Yes/Edit/Cancel] user interaction
- **loop/start**: Phase 3 — hope:verify quick-checks + counsel:panel scope reviews for orchestration verification

### Changed

- **loop/start**: Enhanced Step 4 (Wave Execution) with context file writing, [WAVE N] logging, task description preambles, hybrid signal mode
- **loop/start**: Compressed Step 2 to add plan bridge mechanism (194 lines, under 200-line limit)
- **hope/shape**: Always writes SHAPE.md and returns (never invokes EnterPlanMode); caller decides next action

---

## [hope@0.22.0, loop@3.1.0, counsel@0.14.0, wordsmith@0.7.0] - 2026-02-05

### Changed

- **hope/soul**: Rewritten to 142 lines (was 456) — 200-line max, self-contained, all references inlined
- **hope/verify**: Rewritten to 142 lines (was 348) — self-contained, references inlined
- **hope/intent**: Rewritten to 159 lines (was 259) — compressed protocols, removed verbose templates
- **hope/shape**: Rewritten to 152 lines (was 234) — aspect discovery table + expert consultation inlined
- **hope/skill-judge**: Rewritten to 133 lines (was 236) — evaluation dimensions inlined
- **hope/breakthrough**: Rewritten to 191 lines (was 183 + 3 refs) — technique steps inlined from references
- **loop/start**: Rewritten to 187 lines (was 494) — compressed architecture, inlined wave/decomposition logic
- **counsel/counsel**: Rewritten to 187 lines (was 239) — inlined inference + confidence scoring from references
- **wordsmith/writing**: Rewritten to 151 lines (was 113 + 7 refs) — all 5 workflows inlined from references
- **counsel**: Profile data files moved from `references/profiles/` to `profiles/` (flat alongside SKILL.md)
- **wordsmith/template**: Template files moved from `references/templates/` to flat alongside SKILL.md
- **CLAUDE.md**: New 200-line limit, flat structure conventions, no references/ directories
- **.github/hooks/pre-push**: Enforces 200-line limit + references/ directory check (was 500)

### Removed

- **hope**: All `references/` directories (soul: ~71 files, verify: 7, shape: 3, skill-judge: 4, breakthrough: 3)
- **loop**: All `references/` directories (start: 7 files)
- **counsel**: Reference docs deleted (inference.md, confidence.md, 3 mode files, colleague-framework.md, profile-schema.md)
- **wordsmith**: All `references/` directories (writing: 7 files, template: references/ structure)

### Added

- **hope**: 2 new eval cases (interactive-code-review-trigger, recall-trigger)
- **wordsmith**: 2 new eval cases (voices-trigger, writing-voice)
- **counsel**: 1 new eval case (counsel-mode-panel)

### Fixed

- **hope/hooks.json**: Added `async: true` to SessionStart hook for cross-platform compatibility
- **loop/hooks.json**: Added `async: true` to SessionStart hook for cross-platform compatibility

### Added

- **loop**: Agent teams integration for complex coordination (hybrid approach)
  - Step 3.5: Team Decision — calculates team_score from cross-layer, review, and hypothesis factors
  - Subagent waves (default, team_score < 10) preserved as proven execution path
  - Agent teams mode (team_score ≥ 12) spawns specialized teammates with role-based ownership
  - Hybrid mode (team_score 10-11 with cross-layer) mixes both execution strategies
  - Teammates inherit lead's model, no plan_mode_required — counsel:panel provides plan and review gates
  - Cross-session resume falls back to subagent waves when teammates can't be restored
  - `references/agent-teams.md` — team score calculation, lifecycle, cost considerations, troubleshooting
  - `references/team-roles.md` — teammate specialization mapping, spawn patterns, delegation/shutdown protocol
  - `references/waves.md` — execution mode selection section (subagent/team/hybrid)
  - Stop hook blocks exit when active team running (checks `team.shutdown_status`)
  - `schemas/workflow-state.schema.json` — optional `team` and `plan` objects
  - 2 new eval cases: `team-detection.yaml`, `team-execution.yaml`
  - `loop-mechanics.md` — team execution section with lifecycle and state tracking
- **loop**: Plan-to-loop bridge for surviving plan mode transitions
  - Step 2.5: Plan Persistence — writes `stage: "planning"` before decomposition
  - Step 0a: Detects "planning" stage and offers to execute or start fresh
  - DOT diagram updated with plan detection path
  - Session-resume hook announces pending plans on session start
  - Stop hook blocks exit during "planning" stage (plan not yet executed)
  - `schemas/workflow-state.schema.json` — "planning" stage + optional `plan` object (file_path, approved, spec_extracted)
  - `loop-mechanics.md` — plan mode recovery section, stage-specific resume table updated
- **loop/start**: Teammate and SendMessage added to allowed-tools
- **loop/start**: Completion step includes team shutdown and cleanup for team-mode loops
- **loop/start**: References table includes agent-teams.md and team-roles.md

### Changed

- **loop**: Version bumped to 3.0.0 (major: new execution mode + plan bridge)
- **loop/start**: Architecture diagram includes Team Decision and team cleanup steps

---

## [hope@0.21.0, loop@2.5.0, counsel@0.13.0] - 2026-02-05

### Added

- **counsel**: 9 new expert profiles (33 → 42 total)
  - Kent Beck — Testing/TDD, XP, red-green-refactor
  - Steve Freeman — GOOS, mock objects, outside-in testing
  - Roy Fielding — REST, HATEOAS, HTTP semantics
  - Brendan Gregg — Systems performance, flame graphs, USE method
  - Robert C. Martin — Clean Code, Clean Architecture, SOLID
  - Eric Evans — DDD, bounded contexts, ubiquitous language
  - Vaughn Vernon — IDDD, aggregates, event sourcing, CQRS
  - Jez Humble — Continuous Delivery, DORA metrics, deployment pipelines
  - Sam Newman — Microservices, service decomposition, distributed systems
- **schemas/**: New directory with formal JSON schemas for state files
  - `workflow-state.schema.json` — Loop state file schema
  - `learnings.schema.json` — Learnings JSONL schemas
  - `README.md` — Schema usage guide
- **CLAUDE.md**: State File Schemas policy section
- **counsel/references/modes**: Progressive disclosure mode references for panel command
  - `clarify.md` — Clarification mode with dimension pools and expert selection
  - `diagnose.md` — Stuck mode with formalized retry loop (3 attempts → escalate)
  - `review.md` — Light and thorough review with interactive findings loop DOT
- **hope/anchor-experts**: Code examples for all 10 experts (gene transfer for style matching)
- **loop/decomposition**: Extended TaskCreate examples by task type (file, test, verify, refactor)
- **hope/breakthrough**: Supportive opening framing ("You're in good company")
- **hope/trace**: Learning-oriented opening ("Every incident is a learning opportunity")
- **counsel/calibrate**: Growth mindset framing ("Calibrations make you better")
- **loop/start**: Completion celebration with encouragement
- **loop/waves**: Subagent motivation with parallel wave context
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

### Fixed

- **loop/cancel**: Add `TaskList, TaskUpdate` to allowed-tools (was missing, causing permission prompts)
- **loop/cancel**: Fix schema alignment (`status` → `stage: cancelled`)
- **loop/cancel**: Fix wrong state file reference (`state.json` → `workflow-state.json`)
- **counsel/review**: Replace OWASP (framework) with Pike (expert) in security mapping
- **loop/stop-check.sh**: Add basic schema validation for state file
- **loop/status**: Remove process details from description (trigger-only)
- **counsel/counsel**: Remove process details from skill description (trigger-only per Superpowers 4.0)
- **counsel**: Confidence threshold consistency — changed "< 30%" to "< 3/10" to match other references
- **hope/gate**: Remove process details from description (trigger-only)
- **hope/intent**: Remove process details from description (trigger-only)
- **hope/shape**: Remove process details from description (trigger-only)
- **hope/trace**: Remove process details from description (trigger-only)
- **loop/start**: Remove process details from description (trigger-only)

### Changed

- **hope/gate**: Remove redundant Verification Plan section (duplicated with verify skill)
- **loop/start**: Simplify fit score to table, reference loop-mechanics.md for formula
- **counsel/vergnaud**: Trim keywords from 43 to 15 (align with other profiles)
- **counsel/panel**: Refactored to progressive disclosure — mode-specific logic extracted to references/modes/
  - Panel.md reduced from 414 → 192 lines (54% reduction)
  - Mode detection DOT diagram routes to appropriate reference
  - Same public interface preserved
- **hope/gate**: Reframe blocking language to supportive guidance ("STOP" → "Pause here", "block gate" → "resolve findings")
- **hope/soul**: Reframe blocking items to clarity checkpoints (🔴 RESEARCH → 💡 CLARIFY)
- **loop/waves**: Reframe "STUCK STATE" to "TIME FOR EXPERT HELP" (iteration is normal)
- **loop/start**: Reframe stuck handling to "tasks that need another attempt"
- **counsel/SKILL.md**: Soften core constraint from "You are NOT the expert" to "You excel at simulating"
- **counsel/SKILL.md**: Change "CRITICAL: Lazy loading only" to "Efficiency note"
- **counsel**: Switch from `model: opus` to `model: sonnet` (cost optimization - expert simulation is pattern matching, not complex reasoning)
- **loop/start**: Switch from `model: opus` to `model: sonnet` (cost optimization - orchestration, not reasoning)
- **hope/soul**: Replace 37-tool inline table with [Tools Index](hope/skills/soul/references/tools/_index.md) for selective loading
- **loop/start**: Stage-conditional reference loading (load only decomposition/waves/expert-review when needed)
- **counsel/panel**: Default to 2 experts with progressive disclosure ("expand" to add more)

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
