# Evaluation Dimensions

8 dimensions for skill quality assessment. Total: 120 points.

## 1. Problem Definition (15 points)

Is the problem clear and bounded?

| Score | Criteria |
| ----- | -------- |
| 13-15 | Problem crystal clear, well-bounded, single responsibility |
| 10-12 | Clear problem, minor boundary ambiguity |
| 7-9 | Problem stated but scope creep evident |
| 4-6 | Vague problem, tries to solve too much |
| 0-3 | No clear problem or unbounded scope |

### Scoring Questions

- Can you state the problem in one sentence?
- Does the skill try to solve exactly one thing?
- Are the boundaries explicit?
- Would removing any section break the skill?

### Examples

**15/15**: "Root cause analysis for complex bugs" - clear, bounded, specific
**8/15**: "Help with debugging" - too vague, unbounded
**3/15**: "General development assistance" - no real problem defined

## 2. Knowledge Delta (20 points)

Does the skill add value beyond Claude's base capabilities?

| Score | Criteria |
| ----- | -------- |
| 18-20 | [E]xpert knowledge Claude lacks, deeply specialized |
| 14-17 | Strong [E]xpert or exceptional [A]ctivation value |
| 10-13 | Solid [A]ctivation: frameworks Claude knows but needs prompting |
| 5-9 | Weak [A]ctivation: minimal prompting benefit |
| 0-4 | [R]edundant: Claude already does this well |

### Scoring Questions

- Would Claude do this well without the skill?
- Does the skill contain specialized domain knowledge?
- Is there a structured framework Claude wouldn't naturally apply?
- Could a 3-line prompt achieve the same result?

### Examples

**20/20**: Security threat modeling with industry-specific rationalizations
**15/20**: Structured postmortem framework with blameless protocol
**8/20**: General code review guidelines
**2/20**: "Write clean code" instructions

## 3. Description Quality (15 points)

Does the description enable automatic triggering?

| Score | Criteria |
| ----- | -------- |
| 13-15 | WHAT + WHEN + KEYWORDS all present and precise |
| 10-12 | All three present but could be sharper |
| 7-9 | Missing one element or vague elements |
| 4-6 | Missing two elements |
| 0-3 | Description fails to enable triggering |

### Scoring Questions

- Is WHAT clear in a single sentence?
- Are WHEN triggers explicit and realistic?
- Are KEYWORDS phrases users actually say?
- Is it under 1024 characters?
- Does it avoid multi-line YAML blocks?

### Examples

**15/15**: "Evaluate skill quality using 8-dimension framework. Use when reviewing skills, before publishing, or auditing. Triggers on 'evaluate skill', 'review skill', 'skill quality'."

**7/15**: "Helps evaluate skills" - no WHEN, no KEYWORDS

**3/15**: "A comprehensive skill for skill evaluation" - nothing actionable

## 4. Progressive Disclosure (15 points)

Is information revealed at the right level?

| Score | Criteria |
| ----- | -------- |
| 13-15 | Clear hierarchy, details in references, SKILL.md scannable |
| 10-12 | Good structure, minor disclosure issues |
| 7-9 | Some sections too dense or too sparse |
| 4-6 | Information dumped without structure |
| 0-3 | No progressive disclosure, wall of text |

### Scoring Questions

- Can you understand the skill from headings alone?
- Is SKILL.md under 300 lines?
- Are deep details in references?
- Do tables replace paragraphs where appropriate?
- Is there a clear path from overview to details?

### Examples

**15/15**: SKILL.md has tables, references for depth, under 200 lines
**8/15**: 500 lines in SKILL.md, some structure
**2/15**: 1000 lines, no tables, prose paragraphs throughout

## 5. Freedom Calibration (15 points)

Do constraints match the task nature?

| Score | Criteria |
| ----- | -------- |
| 13-15 | Perfect match: creative tasks free, precise tasks constrained |
| 10-12 | Good match with minor misalignment |
| 7-9 | Noticeable freedom mismatch in some sections |
| 4-6 | Significant mismatch: over/under-constrained |
| 0-3 | Complete mismatch, skill fights its purpose |

### Scoring Questions

- Is this a creative task that needs freedom?
- Is this a precise task that needs constraints?
- Are there unnecessary restrictions on judgment?
- Are there missing constraints where precision matters?
- Does the skill allow appropriate deviation?

### Pattern Guidance

| Task Type | Freedom Level | Constraint Level |
| --------- | ------------- | ---------------- |
| Creative/Taste | High | Low |
| Analysis/Judgment | Medium | Medium |
| Process/Workflow | Low | High |
| Tool/Operation | Very Low | Very High |

## 6. Output Format (10 points)

Is the expected output clear?

| Score | Criteria |
| ----- | -------- |
| 9-10 | Clear template, easy to verify, consistent structure |
| 7-8 | Output format present but could be clearer |
| 5-6 | Partial format guidance, ambiguous sections |
| 3-4 | Minimal format guidance |
| 0-2 | No output format defined |

### Scoring Questions

- Is there an explicit output template?
- Can you verify output correctness at a glance?
- Are all sections of output defined?
- Is the format consistent with skill purpose?

### Examples

**10/10**: Explicit code block template with all fields labeled
**6/10**: Some guidance but "varies by context"
**2/10**: "Provide appropriate output"

## 7. Anti-Pattern Coverage (15 points)

Are common mistakes addressed?

| Score | Criteria |
| ----- | -------- |
| 13-15 | Comprehensive anti-patterns with specific fixes |
| 10-12 | Good coverage, minor gaps |
| 7-9 | Some anti-patterns covered |
| 4-6 | Minimal anti-pattern guidance |
| 0-3 | No anti-patterns addressed |

### Scoring Questions

- Does the skill anticipate failure modes?
- Are anti-patterns specific (not "be careful")?
- Does each anti-pattern have a fix?
- Are common rationalizations addressed?
- Is there a "forbidden" or "avoid" section?

### Examples

**15/15**: Table of anti-patterns with "Don't" | "Do Instead" format
**8/15**: General warnings without specifics
**2/15**: "Avoid common mistakes"

## 8. Testability (15 points)

Can we verify the skill works?

| Score | Criteria |
| ----- | -------- |
| 13-15 | Clear success criteria, verifiable outputs, test cases defined |
| 10-12 | Testable but criteria could be sharper |
| 7-9 | Partially testable, some ambiguity |
| 4-6 | Difficult to test objectively |
| 0-3 | No way to verify skill effectiveness |

### Scoring Questions

- Can you write an eval case for this skill?
- Is success/failure clearly defined?
- Are outputs verifiable?
- Can you distinguish good from bad skill application?
- Are there examples to compare against?

### Examples

**15/15**: Explicit success criteria, example inputs/outputs, eval cases
**8/15**: General success definition, no examples
**2/15**: "Use your judgment to determine success"

## Dimension Weight Rationale

| Dimension | Points | Why This Weight |
| --------- | ------ | --------------- |
| Knowledge Delta | 20 | Most important: no delta = no skill |
| Problem Definition | 15 | Foundation: unclear problem = unclear skill |
| Description Quality | 15 | Discoverability: invisible skill = useless skill |
| Progressive Disclosure | 15 | Usability: dump = overwhelm |
| Freedom Calibration | 15 | Effectiveness: wrong freedom = wrong output |
| Anti-Pattern Coverage | 15 | Robustness: anticipate failure |
| Testability | 15 | Accountability: can't verify = can't improve |
| Output Format | 10 | Clarity: less critical than others |
