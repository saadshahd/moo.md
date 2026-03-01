# Team Composition

Assess whether a task benefits from parallel agents. Design roles and boundaries. Create the team. Prevent merge conflicts over maximizing parallelism.

## Requirements

### Requirement: Fitness assessment before design
Bond SHALL assess whether a task benefits from a team by asking: Can workers operate without each other's output? Do they touch different files? Is scope multi-module (8+ story points)? If file ownership overlaps or scope is 3 or fewer story points, bond SHALL recommend solo execution.

#### Scenario: Team warranted
- **WHEN** a task has independent modules across different files with 8+ story points
- **THEN** bond designs a team

#### Scenario: Solo recommended
- **WHEN** scope is 3 or fewer story points or proposed roles would touch the same files
- **THEN** bond recommends solo execution with rationale

### Requirement: Role design with distinct ownership
Bond SHALL design 2-5 teammates, one per independent workstream. Each role SHALL own distinct files with no overlap. Role names SHALL describe responsibility ("auth-impl", "api-reviewer"), never generic. Coupling check: for each role pair, "if A changes X, does B break?" — if yes, merge roles.

#### Scenario: Coupling detected
- **WHEN** coupling check reveals one role's changes would break another
- **THEN** those roles are merged into one

### Requirement: User approval before creation
Bond SHALL present a blueprint and get user approval before creating any team. On approval, bond creates with TeamCreate and spawns each role as an Agent. On rejection, bond suggests solo or subagent alternative.

#### Scenario: Blueprint approval flow
- **WHEN** team blueprint is presented
- **THEN** no TeamCreate or Agent calls happen until user explicitly approves
