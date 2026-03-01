# Thinking Discipline

The discipline of clarifying WHAT, deciding HOW, and grounding both in a philosophy that prioritizes understanding over output. Covers intent clarification, implementation shaping, and the belief system that drives them.

## Requirements

### Requirement: Intent clarifies WHAT before building
Intent SHALL ask the fewest questions that make every criterion testable by a stranger. Clarity over completeness — a partial spec with boolean criteria beats a thorough spec with vague ones. Maximum 8 rounds of clarification; after that, proceed and mark gaps as `[ASSUMPTION]`.

#### Scenario: Vague request
- **WHEN** a request is ambiguous or underspecified
- **THEN** intent asks clarifying questions before any implementation begins

#### Scenario: Structured input fast-path
- **WHEN** a request arrives with structured input (proposal, design, specs, task list)
- **THEN** intent extracts and validates rather than re-clarifying from scratch

#### Scenario: User overrides
- **WHEN** user says "I know what I want"
- **THEN** intent proceeds without clarification rounds

### Requirement: Intent emits a structured brief
Intent SHALL produce a brief containing: OBJECTIVE (1 line), NON-GOALS (3-5), CONSTRAINTS, ACCEPTANCE (7-12 testable bullets), STOP CONDITIONS (3-5 observable failures). At least one clarification question SHALL be "what should this NOT do?"

#### Scenario: Brief completeness
- **WHEN** intent completes clarification
- **THEN** brief contains all five sections with testable, boolean-checkable criteria

### Requirement: Shape bridges WHAT to HOW
Shape SHALL search the codebase for existing patterns and conventions before recommending an approach. For non-trivial tasks, shape SHALL consult expert perspectives. For trivial tasks (single obvious change, clear precedent, low risk), consultation is skipped.

#### Scenario: Approach with codebase grounding
- **WHEN** intent is clear but approach is not
- **THEN** shape searches the codebase first, then recommends approach with rationale, key findings, tensions, risks, and a first atomic step

### Requirement: Philosophy uses mentor's notes voice
Philosophy SHALL express beliefs as 1-2 sentences of wisdom and principles as short stances. No academic paragraphs, no multi-sentence justifications. Each belief SHALL communicate its point without requiring context from other beliefs.

#### Scenario: Belief brevity and independence
- **WHEN** any belief in PHILOSOPHY.md is read in isolation
- **THEN** it is 1-2 sentences and communicates its point without needing surrounding context

### Requirement: Humble-master integration
Philosophy SHALL encode correction reception (human corrections take priority over self-assessment), cost asymmetry (mistakes cost the human, not the AI), and advise/disclose/teach posture as infrastructure — principles and mechanisms, not character traits or persona.

#### Scenario: Infrastructure over persona
- **WHEN** humble-master learnings are reviewed
- **THEN** they read as principles, not personality
