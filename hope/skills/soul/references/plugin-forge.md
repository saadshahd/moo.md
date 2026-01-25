# Plugin Forge

Process for creating Claude Code plugins in the moo.md ecosystem.

---

## Plugin Structure

```
<plugin-name>/
├── .claude-plugin/
│   └── plugin.json         # name, version, description, keywords
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md        # Skill instructions
│       └── references/     # Supporting docs
└── agents/                 # Optional
    └── <role>.md
```

---

## plugin.json Schema

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Single line description",
  "keywords": ["keyword1", "keyword2"],
  "author": {
    "name": "Your Name",
    "url": "https://yoursite.com"
  }
}
```

---

## SKILL.md Frontmatter

```yaml
---
name: skill-name
description: WHAT it does. WHEN to use it. KEYWORDS for discovery.
---
```

**WARNING:** Never use multi-line YAML blocks (`|` or `>`). Claude Code truncates them, breaking auto-triggering.

**Max description:** 1024 characters. Single line only.

---

## Three Plugin Patterns

### Framework Plugin

Multiple related skills with shared concepts.

**Example:** hope (soul, trace, gate, recall, learn)

| Characteristic | Implementation |
|----------------|----------------|
| Central router | One skill dispatches to appropriate workflow |
| Shared concepts | Quality footer, confidence gates |
| Progressive disclosure | References loaded on demand |

### Utility Plugin

Single-purpose, atomic functionality.

**Example:** markdown-to-pdf converter

| Characteristic | Implementation |
|----------------|----------------|
| One SKILL.md | Contains complete instructions |
| Minimal references | 0-2 reference files |
| Clear contract | Input → Output well-defined |

### Domain Plugin

Specialized knowledge area with multiple workflows.

**Example:** product (PRD, compete, metrics, research)

| Characteristic | Implementation |
|----------------|----------------|
| Router skill | Dispatches based on task type |
| Domain vocabulary | Consistent terms across workflows |
| Reference per workflow | Each workflow has supporting docs |

---

## Skill Count Constraint

**CRITICAL:** Claude Code displays ALL skill descriptions in context. At 61 skills, truncation occurred.

**Hard limit:** Keep visible skills under 20 total.

**Solution:** Router pattern

| Instead of | Do this |
|------------|---------|
| New visible skill | Add as reference to existing skill |
| Multiple entry points | Single router with workflows |
| Separate utilities | Combine into one skill with modes |

---

## Version Management

Version lives in `plugin.json` ONLY (DRY principle).

**Never put version in SKILL.md frontmatter.**

When bumping versions:
1. Update `plugin.json` version field
2. Update `marketplace.json` if it has version
3. Add `CHANGELOG.md` entry

---

## Marketplace Registration

Add to `.claude-plugin/marketplace.json` at repo root:

```json
{
  "plugins": [
    {
      "name": "your-plugin",
      "source": "./your-plugin",
      "description": "What it does",
      "category": "core|domain"
    }
  ]
}
```

---

## Testing Skills

Create test cases in `<plugin>/eval/cases/`:

```yaml
- input: "help me write a PRD"
  expected_skill: "product"
  expected_workflow: "prd"
```

Run: `bun run eval/run.ts [plugin]`

---

## Line Limits

| File Type | Max Lines |
|-----------|-----------|
| SKILL.md | 500 |
| Reference file | 200 |
| Total loaded context | Minimize |

---

## Reference Rules

| Rule | Rationale |
|------|-----------|
| No reference chains (A → B → C) | Flatten to A → B, A → C |
| Place in `skills/<skill>/references/` | Discovery and organization |
| Subdirs allowed | `references/tools/`, `references/profiles/` |
| Intra-plugin sharing OK | `trace` can ref `soul/references/blameless.md` |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Multi-line YAML description | Single line, max 1024 chars |
| SKILL.md over 500 lines | Split to references |
| Nested reference chains | Flatten |
| Duplicate content across skills | Link to single source |
| Version in SKILL.md | Version only in plugin.json |
| README per skill | SKILL.md is the documentation |
| Creating new skill for everything | Use router + references |

---

## Pre-Publish Checklist

```
□ plugin.json has name, version, description, keywords
□ Description is single-line with WHAT + WHEN + KEYWORDS
□ SKILL.md under 500 lines
□ References under 200 lines each
□ No reference chains
□ Evals pass: bun run eval/run.ts [plugin]
□ Added to marketplace.json
□ CHANGELOG.md entry added
□ Total skill count still under 20
```

---

## Local Testing

From parent directory of moo.md:

```bash
/plugin marketplace add ./moo.md
/plugin install hope@moo.md
```
