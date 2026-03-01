## ADDED Requirements

### Requirement: Manifesto tone

hope PHILOSOPHY.md SHALL use mentor's notes voice — beliefs as 1-2 sentences of wisdom, principles as short stances. No academic paragraphs, no multi-sentence justifications per belief.

#### Scenario: Belief brevity

- **WHEN** any belief in PHILOSOPHY.md is measured
- **THEN** it is ≤ 2 sentences

#### Scenario: Voice consistency

- **WHEN** PHILOSOPHY.md is read aloud
- **THEN** it sounds like a senior dev talking, not a paper being presented

### Requirement: Prior art first principle

hope SHALL include a core principle: search before creating, reframe over replicate. This encodes the habit of checking what exists before building something new.

#### Scenario: Principle presence

- **WHEN** PHILOSOPHY.md principles are listed
- **THEN** "prior art first" or equivalent phrasing appears

#### Scenario: Behavioral effect

- **WHEN** a user asks to build something that likely exists
- **THEN** hope's priming encourages searching for existing solutions before creating from scratch

### Requirement: Humble-master integration

hope SHALL fold humble-master learnings into philosophy: correction reception (human correction > self-assessment), cost asymmetry awareness (cost of mistakes falls on human), and advises/discloses/teaches posture. These MUST be encoded as infrastructure, not persona.

#### Scenario: Correction reception

- **WHEN** philosophy is reviewed for correction handling
- **THEN** it encodes that human corrections take priority over self-assessment

#### Scenario: Cost asymmetry

- **WHEN** philosophy is reviewed for risk framing
- **THEN** it acknowledges that the cost of AI mistakes falls on the human

#### Scenario: No persona

- **WHEN** humble-master learnings are reviewed
- **THEN** they read as principles and mechanisms, not character traits or personality

### Requirement: Compressed constraints

Hard constraints SHALL be fewer and sharper than v3's 13 constraints. Each constraint MUST fit in one sentence.

#### Scenario: Constraint count

- **WHEN** hard constraints are listed
- **THEN** there are fewer than 13

#### Scenario: Constraint brevity

- **WHEN** any constraint is measured
- **THEN** it fits in one sentence

### Requirement: Philosophy line budget

hope PHILOSOPHY.md MUST NOT exceed 100 lines (down from v3's 275 lines).

#### Scenario: Line count

- **WHEN** PHILOSOPHY.md lines are counted
- **THEN** total is ≤ 100

### Requirement: Recovered v0.0.1 values

Philosophy SHALL recover the original hope spirit: the file is the philosophy, not a specification of the philosophy. Beliefs should feel discovered, not engineered.

#### Scenario: Directness

- **WHEN** a belief is read in isolation
- **THEN** it communicates its point without requiring context from other beliefs

## REMOVED Requirements

### Requirement: Academic belief format

**Reason**: Multi-paragraph beliefs with "this includes..." elaborations bury the insight under explanation. v4 beliefs are sharp enough to stand alone.
**Migration**: Compress each belief to its essential insight. Supporting arguments become implicit.

### Requirement: Belief-to-principle traceability

**Reason**: "From belief N: ..." headers add structure that serves auditors, not practitioners. If a principle is good, its parent belief is obvious.
**Migration**: Group principles by theme, not by parent belief.

### Requirement: Skill author constraints section

**Reason**: With 5 simple skills and a 200-line budget, a separate "skill author constraints" section is overhead. The constraints are the budget.
**Migration**: Essential constraints fold into the manifesto. The rest are implicit in the simplicity.
