# Thinking Discipline

The discipline of clarifying WHAT, deciding HOW, and grounding both in a philosophy that prioritizes understanding over output. Covers intent clarification, implementation shaping, and the belief system that drives them.

## Requirements

### Requirement: Intent clarifies WHAT before building
Intent SHALL ask the fewest questions that make every criterion testable by a stranger. Clarity over completeness — a partial spec with boolean criteria beats a thorough spec with vague ones. Maximum 8 rounds of clarification. After each round, intent lists remaining unknowns; rounds continue until the list is empty or the cap is reached.

#### Scenario: Vague request
- **WHEN** a request is ambiguous or underspecified
- **THEN** intent asks clarifying questions before any implementation begins

#### Scenario: Structured input fast-path
- **WHEN** a request arrives with structured input (proposal, design, specs, task list)
- **THEN** intent extracts and validates rather than re-clarifying from scratch

#### Scenario: User overrides
- **WHEN** user says "I know what I want"
- **THEN** intent proceeds without clarification rounds

#### Scenario: Echo confirmation
- **WHEN** clarification rounds complete
- **THEN** intent compresses understanding to one sentence (≤35 words) and confirms with the user before proceeding to brief generation

### Requirement: Intent emits a grounded brief
Intent SHALL produce a brief scaled to task stakes. Every acceptance criterion SHALL trace to a user answer, an approved assumption, or a promoted practice — no invented criteria. A shorter honest list beats a padded one. At least one clarification question SHALL be "what should this NOT do?"

Brief sections: OBJECTIVE (1 line), NON-GOALS, CONSTRAINTS, ACCEPTANCE, STOP CONDITIONS (3-5 observable failures), RECOMMENDED PRACTICES (unselected suggestions for reference). Section depth scales to task stakes — a small fix does not need 5 non-goals.

#### Scenario: Grounded acceptance criteria
- **WHEN** brief is emitted
- **THEN** every acceptance criterion traces to a user answer, approved assumption, or promoted practice

#### Scenario: Assumption transparency
- **WHEN** intent would need to invent details for the brief (numbers, thresholds, scope boundaries, tech choices)
- **THEN** each assumption is presented to the user with concrete alternatives before inclusion

#### Scenario: Recommended practices
- **WHEN** task is non-trivial with no clear precedent
- **THEN** intent presents best practices the user can cherry-pick into acceptance criteria; unselected items stay in a Recommended Practices section as suggestions

#### Scenario: Proportional scaling
- **WHEN** task is small or straightforward
- **THEN** brief sections scale down proportionally and recommended practices step is skipped

### Requirement: Shape works dimension by dimension
Shape SHALL decompose HOW decisions into independent dimensions (architecture, data model, API design, testing, deployment, etc.). Each dimension gets expert-informed choices the user selects from. Collapsing multi-faceted decisions into a single recommendation is prohibited. For tasks with one dimension and an obvious approach, shape collapses to extract and emit.

#### Scenario: Codebase and prior art grounding
- **WHEN** intent is clear but approach is not
- **THEN** shape searches the codebase for existing patterns, then searches beyond (GitHub, docs, web) for how others solved it — two distinct research steps

#### Scenario: User owns scope
- **WHEN** task has multiple HOW aspects
- **THEN** shape presents dimensions and user selects which to shape; not every task needs every dimension

#### Scenario: Domain-aware depth
- **WHEN** domain is high-stakes or a dimension is irreversible (Type 1)
- **THEN** shape applies deeper analysis for that dimension
- **WHEN** domain is exploratory or a dimension is reversible (Type 2)
- **THEN** shape applies lighter treatment

#### Scenario: Cross-dimension integration
- **WHEN** all dimensions are resolved
- **THEN** shape checks for tensions between choices, runs pre-mortem (adoption, timing, integration failures), and surfaces second-order effects (what this prevents in 6-12 months) before emitting

#### Scenario: Dichotomy of control
- **WHEN** task involves work outside user's control (other teams, external approvals, infrastructure)
- **THEN** those aspects are documented as externalities, not shaped as decisions

#### Scenario: Trivial task shortcut
- **WHEN** task has one dimension with an obvious approach
- **THEN** shape collapses to extract and emit, skipping scoping and dimension loop

### Requirement: Shape presents choices, not analysis
Shape SHALL present conclusions first — recommendation as label, tradeoff as one-line description, supporting evidence in detail panels. Reasoning techniques SHALL remain internal; never name frameworks in user-facing output. Shape SHALL infer classifications (domain type, reversibility, expert selection) and state them; only prompt the user when genuinely ambiguous.

#### Scenario: Conclusion-first presentation
- **WHEN** shape presents a dimension's choices
- **THEN** the recommendation leads, tradeoff is one line, and supporting evidence is in expandable detail

#### Scenario: Internal techniques
- **WHEN** shape applies reasoning frameworks
- **THEN** insights appear in plain language without naming the technique

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
