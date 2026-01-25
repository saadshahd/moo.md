# Archive Directory Pattern

Standardize how skills preserve generated artifacts for later reference.

## Directory Structure

```
.hope-archive/
├── {YYYY-MM-DD}-{project-slug}/
│   ├── analysis.md
│   ├── output.md
│   └── prompts/
│       ├── 01-research.md
│       └── 02-synthesis.md
```

## Naming Conventions

### Directory naming: `{YYYY-MM-DD}-{slug}`

- Date: ISO format, when work started
- Slug: kebab-case, 2-4 words describing project
- Example: `2024-03-15-auth-system-prd`

### File naming: `{NN}-{type}.md`

- Sequential numbering: 01, 02, 03...
- Type prefix: research, draft, review, final
- Example: `01-research.md`, `02-draft.md`, `03-final.md`

## When to Use

Skills that generate:

- Multi-step outputs (PRDs, analyses)
- Research artifacts worth preserving
- Iterative drafts leading to final output

## When NOT to Use

- One-shot outputs (single generation, no iteration)
- Purely conversational responses
- Outputs that go directly to user (no preservation needed)

## .gitignore Consideration

Add to project .gitignore if archives shouldn't be committed:

```
.hope-archive/
```

Or commit if archives are valuable project history.

## Integration with Skills

Skills that use archive pattern:

1. Create archive directory at task start
2. Write intermediate artifacts as work progresses
3. Reference archive in final output
4. Clean up old archives periodically (optional)

## Archive Discovery

```bash
ls -la .hope-archive/
```

Archives sort by date naturally due to naming convention.
