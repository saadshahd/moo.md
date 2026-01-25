# Variant Analysis

Given a known bug, find similar bugs in the same codebase.

Premise: If a bug pattern appeared once, it likely appears elsewhere.

## When to Use

| Trigger | Use This Framework |
|---------|-------------------|
| Security vulnerability discovered | Hunt for similar instances |
| Bug class identified in code review | Sweep codebase for variants |
| CVE affects your dependencies | Check for same pattern internally |

## The 5-Step Methodology

```
    +---------------------------------------------------------+
    |                  VARIANT ANALYSIS                        |
    |      Known Bug -> Pattern -> Search -> Triage            |
    +---------------------------------------------------------+

    +---------------+
    | 1. UNDERSTAND |  What's the vulnerable pattern?
    |               |
    | Root cause    |  --> Not the symptom, the pattern
    +-------+-------+
            |
            v
    +---------------+
    | 2. EXACT      |  Search for identical code
    |    MATCH      |
    | Low effort    |  --> Same functions, same structure
    +-------+-------+
            |
            v
    +---------------+
    | 3. ABSTRACT   |  Where could the pattern vary?
    |    POINTS     |
    | Identify      |  --> Functions, variables, structure
    +-------+-------+
            |
            v
    +---------------+
    | 4. GENERALIZE |  Progressively broader searches
    |               |
    | Widen net     |  --> Level 0 -> 1 -> 2 -> 3
    +-------+-------+
            |
            v
    +---------------+
    | 5. TRIAGE     |  Verify exploitability
    |               |
    | Confirm       |  --> Not all matches are bugs
    +---------------+
```

## Step 1: Understand the Bug

Before hunting variants, deeply understand the original:
- What's the vulnerable code pattern?
- What makes it exploitable?
- What's the root cause (not just the symptom)?

Write a **root cause statement**:

```
"Functions that [PATTERN] without [PROTECTION] are vulnerable to [ATTACK]."
```

| Good Statement | Bad Statement |
|----------------|---------------|
| "User input flows to SQL without parameterization" | "SQL injection" (too vague) |
| "File paths from request data without canonicalization" | "Security issue" (not actionable) |
| "Deserialization of untrusted data without type restrictions" | "Bug in auth" (which pattern?) |

## Step 2: Find Exact Matches

Search for identical patterns first:
- Same function calls
- Same variable patterns
- Same code structure

Low effort, high confidence. Start here always.

## Step 3: Identify Abstraction Points

Where could the pattern vary?

| Abstraction | Original | Variants |
|-------------|----------|----------|
| Function names | `Model.find()` | `Model.where()`, `Model.query()` |
| Variable names | `user_input` | `params`, `request_data`, `body` |
| Code structure | Inline query | Query in helper function |
| Data flow | Direct use | Passed through intermediaries |

## Step 4: Generalize the Pattern

Create progressively broader searches:

```
LEVEL 0: EXACT MATCH
----------------------------------------
user_input = request.params[:id]
Model.find(user_input)

LEVEL 1: SAME FUNCTIONS, ANY VARIABLE
----------------------------------------
*.params[:*]  -->  *.find(*)

LEVEL 2: SAME PATTERN CLASS
----------------------------------------
untrusted_input --> database_query

LEVEL 3: SAME VULNERABILITY CLASS
----------------------------------------
taint_source --> sensitive_sink
```

## The Abstraction Ladder

| Level | Abstraction | Tool | False Positive Rate |
|-------|-------------|------|---------------------|
| 0 | Exact text | grep/ripgrep | Very low |
| 1 | Pattern match | semgrep | Low |
| 2 | Data flow | CodeQL | Medium |
| 3 | Semantic | Manual review | High |

**Start at Level 0, move up only as needed.**

## Step 5: Triage Results

Not all matches are vulnerabilities. Check for existing sanitization, different trust contexts, actual exploitability.

| Result | Status | Action |
|--------|--------|--------|
| Same pattern, exploitable | Confirmed | Fix |
| Same pattern, sanitized | False positive | Document why safe |
| Similar pattern, unclear | Investigate | Add test case |

## Tool Selection

| Scenario | Tool |
|----------|------|
| Quick scan, small codebase | ripgrep |
| Syntax-aware patterns | semgrep |
| Data flow analysis | CodeQL |
| Complex semantic | Manual review |

## Report Template

```markdown
## Original: [CVE/ID]
Root Cause: [Pattern statement]

## Search: Level 0 [N results] -> Level 1 [N results] -> Level 2 [N results]

## Variants
1. [file:line] - [exploitable/mitigated/false positive]

## Fix: [Systematic fix that addresses all variants]
```

## Anti-Patterns

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Skip Level 0 | Miss obvious matches | Always start exact |
| Jump to Level 3 | Drown in false positives | Ascend ladder gradually |
| Pattern without root cause | Can't generalize correctly | Write statement first |
| Fix without sweep | Leave variants unfixed | Complete search before fix |

## Key Insight

The first bug is information, not just a problem. Use it to find its siblings. A systematic sweep after any security bug often finds more vulnerabilities than the original report.

---

*Source: Trail of Bits patterns*
