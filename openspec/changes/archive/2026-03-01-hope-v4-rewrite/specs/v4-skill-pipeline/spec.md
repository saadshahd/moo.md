## ADDED Requirements

### Requirement: Five-skill pipeline
hope v4 SHALL consist of exactly 5 skills: intent, shape, consult, bond, full. Total lines across all SKILL.md files MUST NOT exceed 250 lines.

#### Scenario: Skill count
- **WHEN** all hope skills are listed
- **THEN** exactly 5 SKILL.md files exist under `hope/skills/`

#### Scenario: Line budget
- **WHEN** all 5 SKILL.md files are concatenated
- **THEN** total line count is ≤ 250

### Requirement: Intent skill clarifies WHAT
intent SHALL turn vague requests into clear work orders by asking before building. It MUST NOT contain structured scoring, multi-round protocols, or adversarial question frameworks.

#### Scenario: Vague request
- **WHEN** user gives an ambiguous request like "make it better"
- **THEN** intent asks clarifying questions before any implementation begins

#### Scenario: Clear request passthrough
- **WHEN** user gives a specific, well-defined request
- **THEN** intent confirms understanding and proceeds without unnecessary clarification rounds

#### Scenario: No machinery
- **WHEN** intent SKILL.md is reviewed
- **THEN** it contains no references to criteria[], holdout[], satisfaction tuples, or scoring formulas

### Requirement: Shape skill decides HOW
shape SHALL bridge intent (WHAT) to implementation (HOW) by recommending an approach. It MUST NOT contain criteria[]/holdout[]/mustNot[] arrays, mode recommendations, or feasibility scoring.

#### Scenario: Approach recommendation
- **WHEN** user has a clear intent but no implementation approach
- **THEN** shape recommends a concrete approach with rationale

#### Scenario: No factory metaphors
- **WHEN** shape SKILL.md is reviewed
- **THEN** it contains no criteria[], holdout[], mustNot[], feasibility axes, or zone references

### Requirement: Consult skill provides expert perspectives
consult SHALL simulate expert perspectives using curated profiles for non-trivial decisions. Panel debates MUST be preserved. Profile data files MAY live alongside SKILL.md. The skill itself MUST NOT contain [EXTRACT]-only modes, severity machinery, or coverage tier formulas.

#### Scenario: Expert panel
- **WHEN** user faces a design decision or architecture tradeoff
- **THEN** consult assembles relevant experts for debate and synthesis

#### Scenario: Profile data separation
- **WHEN** consult SKILL.md is reviewed
- **THEN** profiles are in separate data files, not inline in the skill

### Requirement: Bond skill designs and spawns teams
bond SHALL handle end-to-end team composition: assess whether a team is needed, design structure, AND create agent files. It absorbs forge's creation responsibility. It MUST NOT contain 4-dimension fitness scoring formulas.

#### Scenario: Team creation end-to-end
- **WHEN** user asks for a team to handle a task
- **THEN** bond assesses fitness, designs structure, and creates agent files in one flow

#### Scenario: Solo recommendation
- **WHEN** task doesn't warrant a team
- **THEN** bond recommends solo execution with rationale

### Requirement: Full skill is pipeline entrypoint
full SHALL absorb soul's session awareness (engagement level detection, pipeline phase awareness) and provide the skill sequence. It MUST NOT contain cognitive zones, per-turn audits, verification gates, or DOT flowcharts.

#### Scenario: Session setup
- **WHEN** full is invoked
- **THEN** it detects session type, sets engagement level, and sequences through the pipeline

#### Scenario: No soul machinery
- **WHEN** full SKILL.md is reviewed
- **THEN** it contains no Zone 1/2/3 references, satisfaction scoring, or per-turn audit protocols

### Requirement: Mentor's notes tone
All skills SHALL read like notes from a senior dev — direct, concise, opinionated. No academic prose, no formal specification language within the SKILL.md files themselves.

#### Scenario: Tone check
- **WHEN** any SKILL.md is read by a new contributor
- **THEN** it reads as practical guidance, not a behavioral specification

### Requirement: No factory metaphors
No skill SHALL contain criteria[], mustNot[], holdout[], satisfaction tuples, wave mechanics, zone classifications, or DOT graph notation.

#### Scenario: Factory metaphor absence
- **WHEN** all SKILL.md files are searched for factory terms
- **THEN** zero matches for: criteria\[\], mustNot\[\], holdout\[\], satisfaction:, wave, Zone [0-9], digraph

## REMOVED Requirements

### Requirement: Loop skill
**Reason**: Claude Code handles task decomposition, execution tracking, and iteration natively. Wave mechanics, satisfaction scoring, and carry semantics duplicate platform behavior.
**Migration**: Use Claude Code's native execution. For formal task tracking, use OpenSpec tasks.

### Requirement: Soul skill
**Reason**: 174 lines of session orchestration distill to ~10 lines in full. Cognitive zones, verification gates, and per-turn audits over-engineer what a few principles accomplish.
**Migration**: Session awareness folded into full. Thinking principles move to PHILOSOPHY.md.

### Requirement: Verify skill
**Reason**: Adds ceremony Claude handles natively when asked. 4 parallel specialists with SHIP/FIX/BLOCK gating is machinery for a problem the platform solves.
**Migration**: Ask Claude to review. For spec compliance, use OpenSpec verify.

### Requirement: Observe skill
**Reason**: Codebase health assessment is useful but not hope's job. On-demand health checks don't belong in a thinking pipeline.
**Migration**: Run codebase analysis directly when needed.

### Requirement: Forge skill
**Reason**: Persistent agent creation is a one-off write operation, not a pipeline skill. Absorbed by bond.
**Migration**: Bond handles team and agent creation end-to-end.

### Requirement: Search skill
**Reason**: sg/rg reference material, not a thinking skill. Reference docs belong in docs/.
**Migration**: Move content to `docs/search-reference.md`.
