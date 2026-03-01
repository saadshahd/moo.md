## ADDED Requirements

### Requirement: Simplified hook set
hope v4 SHALL ship with at most 3 hooks. Each hook MUST be understandable in under 30 seconds of reading.

#### Scenario: Hook count
- **WHEN** hooks.json is reviewed
- **THEN** it contains ≤ 3 hook entries

#### Scenario: Hook simplicity
- **WHEN** any hook script is read
- **THEN** its purpose is obvious without consulting documentation

### Requirement: SessionStart hook preserved
SessionStart hook SHALL continue to inject soul/full content on session start. It MUST remain synchronous.

#### Scenario: Session initialization
- **WHEN** a new session starts
- **THEN** hope's session content is available on turn 1

### Requirement: Grep deny hook preserved
PreToolUse:Bash hook SHALL continue to deny grep commands and enforce rg/sg usage. It MUST remain synchronous and deterministic.

#### Scenario: Grep denied
- **WHEN** user or agent attempts a grep command via Bash
- **THEN** hook denies with suggestion to use rg or sg

## REMOVED Requirements

### Requirement: Exit-plan-gate hook
**Reason**: The sequential deny chain (pipeline artifacts → coverage verification → self-containment) was hope's most complex hook. It required JSONL transcript parsing, assistant-text extraction with jq, and careful scoping to avoid false positives from loaded skill definitions. A clear philosophy and simple instructions in full accomplish the same goal without the machinery.
**Migration**: Full skill includes clear guidance on completion evidence. Trust Claude to follow instructions.

### Requirement: Complex PreCompact hook
**Reason**: v3 PreCompact extracted detailed state (session markers, criteria, holdout, satisfaction tuples, wave progress, failed approaches) before compaction. With factory metaphors removed, there's minimal state to preserve.
**Migration**: If PreCompact is kept, it preserves only the session engagement level and current pipeline phase — two values, not a state dump.
