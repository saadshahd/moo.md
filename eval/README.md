# moo.md Evaluation Framework

Multi-agent evaluation system for testing moo.md plugins across model releases.

## Quick Start

```bash
# Run all tests
/eval

# Run specific category
/eval skill-triggers

# Run spike validation
./eval/scripts/run-spike.sh
```

## Structure

```
eval/
├── agents/                    # Evaluator agents
│   ├── orchestrator.md        # Coordinates evaluation runs
│   └── trigger-evaluator.md   # Tests skill auto-triggering
├── cases/                     # Test case definitions (YAML)
│   ├── spike/                 # Architecture validation tests
│   └── skill-triggers/        # Skill triggering tests
├── baselines/                 # Golden outputs per model version
├── results/                   # Run outputs (gitignored)
└── scripts/
    └── run-spike.sh           # Spike validation script
```

## Test Case Format

```yaml
name: test-identifier
description: What this test validates
category: skill-trigger | workflow-compliance | output-quality

prompt: "The input to send to Claude"
model_tier: haiku | sonnet | opus

evaluators:
  - trigger-evaluator:
      expected_skill: "plugin:skill"
      pass_threshold: 0.70

tags: [core, regression]
```

## Evaluator Agents

| Agent | Purpose |
|-------|---------|
| `trigger-evaluator` | Validates skill auto-triggering |
| `compliance-evaluator` | Validates workflow step compliance (Phase 2) |
| `quality-evaluator` | LLM-graded output quality (Phase 2) |
| `regression-evaluator` | Compares against baselines (Phase 3) |

## Adding Tests

1. Create YAML file in `eval/cases/<category>/`
2. Define prompt and expected skill
3. Run `/eval <category>` to validate

## CI/CD

Weekly automated runs via GitHub Actions (Phase 4).
