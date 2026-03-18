## MODIFIED Requirements

### Requirement: Intent clarifies WHAT before building
Intent SHALL ask the fewest questions that make every criterion testable by a stranger. Clarity over completeness — a partial spec with boolean criteria beats a thorough spec with vague ones. Maximum 8 rounds of clarification. After each round, intent lists remaining unknowns; rounds continue until the list is empty or the cap is reached.

Hope's thinking discipline now spans pre-implementation (intent, shape, consult, bond) and post-implementation (distill). The pipeline is not sequential — each stage is independently invocable when the context calls for it.

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

#### Scenario: Post-implementation audit available
- **WHEN** implementation is complete and user wants principled review
- **THEN** distill is available as a post-implementation audit stage in the hope discipline
