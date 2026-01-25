# Prior Art

Before building, find what already exists. Every library you don't write = 1000 bugs you don't have.

## When to Use

| Trigger | Use This Framework |
|---------|-------------------|
| Building a feature | Search before implementing |
| Evaluating solutions | Compare existing options |
| Justifying custom code | Document search exhaustion |

## Ecosystem Inference

Detect the right places to search from query signals:

| Signal | Primary Source | Secondary |
|--------|----------------|-----------|
| JavaScript/Node/npm | npmjs.com | GitHub |
| Python/pip | PyPI | GitHub |
| Rust/cargo | crates.io | GitHub |
| Go | pkg.go.dev | GitHub |
| API/service integration | Official docs | GitHub |
| Design pattern | Blog posts | Academic papers |
| No clear signal | GitHub | Web search |

## Parallel Search Strategy

Run multiple searches concurrently:

1. Package registry (npm/PyPI/crates)
2. GitHub (with language filter)
3. Awesome lists (`awesome-{topic}`)
4. Official documentation

Don't search sequentially. Time is precious.

## Search Query Patterns

| Goal | Query Pattern |
|------|---------------|
| Find libraries | `{language} {problem} library` |
| Compare options | `{option1} vs {option2}` |
| Find examples | `{library} example {use-case}` |
| Check maturity | `{library} production` OR `{library} issues` |
| Find alternatives | `{library} alternative` OR `awesome-{domain}` |

## Evaluation Criteria

| Factor | What to Check |
|--------|---------------|
| Maintenance | Last commit, open issues trend |
| Adoption | Downloads, stars, dependents |
| Quality | Tests, docs, TypeScript types |
| Security | Vulnerabilities, audit history |
| Fit | Does it actually solve YOUR problem? |

## Intent Recognition

Tailor synthesis to user goals:

| User Intent | Focus On |
|-------------|----------|
| "Should I use X?" | Comparison, alternatives |
| "How do I do X?" | Tutorial, getting started |
| "What's best for X?" | Evaluation, recommendation |
| "Does X exist?" | Existence, maturity |

## Report Template

```
## Prior Art: [Topic]

### Libraries Found

| Name | Status | Fit |
|------|--------|-----|
| lib1 | Active, 10k stars | Good fit for X, missing Y |
| lib2 | Unmaintained | Not recommended |

### Key Findings

- [Most important insight]
- [Second insight]

### Recommendation

[Use X / Build custom because Y / Need more research on Z]

### Search Confidence

[HIGH: thorough search, clear winner]
[MEDIUM: found options, tradeoffs unclear]
[LOW: sparse results, uncertain landscape]
```

## Honest Sparse Reporting

When prior art is limited, say so:

- "Found 2 libraries, both unmaintained"
- "No production-ready solutions exist"
- "Only academic papers, no implementations"

Don't pad reports with irrelevant findings. Sparse results are valid findings.

## When to Stop Searching

| Condition | Action |
|-----------|--------|
| Found >=2 viable options | Compare and recommend |
| Confirmed nothing exists | Checked 3+ sources, justify custom |
| Deadline approaching | Report findings, note incomplete |
| Diminishing returns | Same results across sources |

## Integration with Build Workflow

Prior art search is Step 2 of Workflow A (Build):

```
Intent check -> Prior art -> Layer 0 implementation
```

**Building custom without search = automatic failure.**

## Anti-Patterns

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Skip search | Reinvent wheel | Mandatory before build |
| Search one source | Miss better options | Check 3+ sources |
| Pad sparse results | False confidence | Report honestly |
| Analysis paralysis | Never build | Stop at 2 viable options |

---

*Supports Library-First Protocol in soul skill*
