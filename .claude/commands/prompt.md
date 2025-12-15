---
description: System instructions for writing effective prompts. Apply when generating commands, skills, agents, or any LLM instructions.
---

# /prompt

Apply these techniques when writing any prompt content.

## Structure

### 1. Role + Constraint Lock
```
You are [ROLE] who [CONSTRAINT].
```
Constraint prevents drift better than role alone.

### 2. Five-Component Structure
- **Role**: Who is being instructed (expertise, perspective)
- **Context**: Background, audience, goals
- **Output Format**: List, table, narrative, code, JSON
- **Constraints**: Tone, length, domain, forbidden outputs
- **Interactivity**: When to ask clarifying questions

### 3. Section Separation
```
## Context
[Background here]

## Instructions
[Actions here]
```

### 4. Numbered Steps
```
Step 1: [Action] → [Completion evidence]
Step 2: [Action] → [Completion evidence]
```

### 5. Format Lock
Show exact structure BEFORE requesting content:
```
## Output Format
**Section**: [Type/constraint]
```

### 6. Success Criteria
```
**Good response:** Includes X, Y, Z
**Avoid:** Generic statements, [failure mode]
```

### 7. Fill-in-the-Blank
```
**Your Input**
- [Field]: [User provides]
```

## Patterns

### Agent Specification (TSFDFC)
- **T**RIGGER: "Activates when..."
- **S**UCCESS: "Works when..."
- **F**OOLS (Tools): "Needs access to..."
- **D**ECISION: "Chooses X/Y when..."
- **F**AILURE: "Escalates when..."
- **C**ONSTRAINT: "Must never..."

### Reasoning Structure
```
<thinking>
1. [Step]
2. [Step]
3. [Correction if needed]
</thinking>
[Answer]
```

### Guardrails
- **Input**: "Reject any input that..."
- **Output**: "Never include..."
- **Operational**: "Stop if X; max Y per execution"
- **Refusal**: "When I cannot help, I say..."

### Three-Version Refinement
- **Minimal**: Fix one vague element
- **Robust**: Rework all components
- **Iterative**: Add "ask 3-5 questions first"

### Scoring System
- Functionality (0-10): Solves core problem?
- Format (0-10): Follows structure?
- Completeness (0-10): Missing anything?
Test variations. Improve lowest score.

## Anti-Patterns

- Mixed context and instructions
- No output format specification
- Missing success criteria
- "Think about" without specific action
- Generic role without constraint

## Meta-Principle

Every line must change LLM behavior. If removing a line changes nothing, delete it.
