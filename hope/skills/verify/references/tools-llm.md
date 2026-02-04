# LLM Output Verification

Verify LLM-generated outputs for quality and correctness.

---

## When LLM Verification Applies

Only run LLM verification when:
- Task involves prompt engineering or LLM integration
- Output quality is a criterion ("response is helpful", "no hallucination")
- Building AI-powered features

**Skip for:** Traditional code, APIs without LLM, static content.

---

## Discovery: What's the LLM Stack?

```bash
# Check for LLM libraries
jq -r '.dependencies | keys[]' package.json 2>/dev/null | grep -E '^(openai|anthropic|@anthropic-ai|langchain|llamaindex)$'

# Check for eval frameworks
jq -r '.devDependencies | keys[]' package.json 2>/dev/null | grep -E '^(promptfoo|deepeval)$'

# Python
grep -l 'openai\|anthropic\|langchain' requirements.txt pyproject.toml 2>/dev/null
```

---

## Manual Verification (Always Available)

When no eval framework exists, verify manually:

### Response Quality Check

```bash
# Generate output
OUTPUT=$(your_llm_command)

# Check for basic quality signals
echo "$OUTPUT" | grep -q "I don't know" && echo "WARN: Uncertainty detected"
echo "$OUTPUT" | wc -w | awk '{if ($1 < 10) print "WARN: Very short response"}'
```

### Consistency Check

Run same prompt 3 times, check outputs are consistent:

```bash
for i in 1 2 3; do
  your_llm_command >> /tmp/outputs.txt
  echo "---" >> /tmp/outputs.txt
done
```

---

## Promptfoo (If Available)

Check with: `command -v promptfoo` or in package.json

### Basic Eval

```yaml
# promptfoo.yaml
prompts:
  - "Summarize this: {{text}}"

providers:
  - openai:gpt-4

tests:
  - vars:
      text: "Long article content..."
    assert:
      - type: contains
        value: "key point"
      - type: llm-rubric
        value: "Summary is concise and accurate"
```

```bash
promptfoo eval -c promptfoo.yaml
```

---

## DeepEval (If Available)

Check with: `pip show deepeval` or in pyproject.toml

```python
from deepeval import evaluate
from deepeval.metrics import AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

test_case = LLMTestCase(
    input="What is the capital of France?",
    actual_output=llm_response,
    expected_output="Paris"
)

metric = AnswerRelevancyMetric(threshold=0.7)
evaluate([test_case], [metric])
```

```bash
deepeval test run tests/
```

---

## Guardrails (If Available)

For structured output validation:

```python
from guardrails import Guard
from guardrails.hub import ValidJson

guard = Guard().use(ValidJson())
result = guard.validate(llm_output)
```

---

## Common Assertions

| Criterion | Verification |
|-----------|--------------|
| "No hallucination" | Cross-reference with source docs |
| "Follows format" | JSON schema validation |
| "Appropriate length" | Word/token count check |
| "No harmful content" | Content filter API or keyword check |
| "Factually correct" | Compare to known facts |

---

## Tool Selection by Tier

| Tier | Approach |
|------|----------|
| Quick | Skip (LLM eval too slow) |
| Standard | Single assertion per criterion |
| Thorough | Full eval suite with multiple metrics |

---

## No LLM Eval Tools Available

```
AskUserQuestion:
  question: "How should I verify LLM output quality?"
  header: "LLM"
  options:
    - label: "Manual review"
      description: "Show me the output, I'll verify"
    - label: "Basic checks only"
      description: "Length, format, keyword presence"
    - label: "Skip LLM verification"
      description: "Not critical for this task"
```

---

## Generating Verification Plan

For each LLM criterion, determine verification approach:

| Criterion Type | Approach |
|----------------|----------|
| Format | JSON schema, regex pattern |
| Length | Token/word count |
| Content | Keyword presence, sentiment |
| Quality | LLM-as-judge (if eval framework exists) |
| Factual | Source document comparison |
