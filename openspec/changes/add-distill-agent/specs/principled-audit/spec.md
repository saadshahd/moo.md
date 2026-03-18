## ADDED Requirements

### Requirement: Distill audits recent work against engineering principles
The distill agent SHALL audit recently modified work against six engineering principles: Musashi (nothing unused), library-first, fail loud, state hygiene, atomic changes, and observer (verification defined). The agent SHALL skip checks that do not apply to the artifact type.

#### Scenario: Code changes
- **WHEN** the user invokes distill after modifying code
- **THEN** all six principles are evaluated against the changed files

#### Scenario: Documentation changes
- **WHEN** the user invokes distill after modifying docs or config
- **THEN** only applicable principles are evaluated (e.g., state hygiene is skipped for prose)

#### Scenario: No changes detected
- **WHEN** the user invokes distill but no recent changes are found
- **THEN** the agent reports that no changes were detected and exits

### Requirement: Distill does not invent findings
The agent SHALL report only genuine violations. If all checks pass, the agent SHALL output "Clean." and nothing else. The agent SHALL NOT fabricate findings to justify the audit.

#### Scenario: Clean code
- **WHEN** all six principles pass for the audited changes
- **THEN** the agent outputs "Clean." with no additional commentary

#### Scenario: Mixed results
- **WHEN** some principles have findings and others pass
- **THEN** only violated principles appear in the output; passing principles are omitted

### Requirement: Distill outputs findings grouped by principle
Each finding SHALL include a file and line reference, what was found, which principle it violates, and the specific fix. Findings SHALL be grouped by principle. Principles with no findings SHALL be omitted from output.

#### Scenario: Finding format
- **WHEN** a violation is detected
- **THEN** the finding includes file:line, description, principle name, and actionable fix

#### Scenario: Grouping
- **WHEN** multiple violations exist across different principles
- **THEN** findings are grouped under principle headers, not interleaved

### Requirement: Distill scopes to recent work by default
The agent SHALL audit recently modified work unless the user specifies a different scope. The agent SHALL read changed files in full to audit changes in context.

#### Scenario: Default scope
- **WHEN** invoked without arguments
- **THEN** the agent identifies recently modified files and audits them

#### Scenario: User-specified scope
- **WHEN** invoked with file paths or directories as arguments
- **THEN** the agent audits the specified scope instead of auto-detecting

### Requirement: Distill accumulates project conventions via persistent memory
The agent SHALL use project-scoped persistent memory to record project conventions and findings the user dismisses as intentional. The agent SHALL NOT save specific findings, file paths, or severity judgments to memory.

#### Scenario: Convention discovery
- **WHEN** the agent identifies a recurring pattern across audits
- **THEN** it records the pattern as a project convention in memory

#### Scenario: Dismissed finding
- **WHEN** the user indicates a finding is intentional
- **THEN** the agent records it so the same finding is not repeated in future sessions

#### Scenario: Memory hygiene
- **WHEN** the agent writes to memory
- **THEN** it saves only conventions and dismissals, not specific findings or file paths

### Requirement: Distill does not modify code
The agent SHALL NOT add features, change behavior, or modify any files (except its own memory). The agent audits and reports — it does not fix.

#### Scenario: Finding with fix suggestion
- **WHEN** a violation is found
- **THEN** the agent describes the fix but does not apply it
