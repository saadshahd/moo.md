---
name: template
description: Scaffold structured documents (RFC, ADR, Blog) using industry best practices. Produces draft for refinement with /wordsmith:edit.
---

# Template Skill

Scaffold structured documents using industry best practices. Produces a draft; use `/wordsmith:edit` to refine.

## When This Skill Activates

You're working on:

- Writing an RFC or design document
- Creating an Architecture Decision Record (ADR)
- Structuring a blog post or technical article
- Applying or creating custom templates

## Workflow Selection

Announce which template you're using:

| Request Pattern | Action | Reference |
|-----------------|--------|-----------|
| "RFC", "request for comments", "design doc", "proposal" | Apply RFC template | `references/templates/rfc.md` |
| "ADR", "architecture decision", "decision record" | Apply ADR template | `references/templates/adr.md` |
| "blog", "blog post", "article", "technical post" | Apply Blog template | `references/templates/blog.md` |
| "[custom name]" template | Apply user template | `~/.claude/wordsmith/templates.jsonl` |
| "list templates", "show my templates" | List all templates | See Template Management below |
| "create custom template", "save as template" | Create user template | See Template Management below |
| "delete template [name]" | Remove user template | See Template Management below |

## Usage

1. Detect template type from user request
2. Announce: "I'm using the template skill for [type] document"
3. Ask for required inputs (topic, context, audience)
4. Check for custom template in `~/.claude/wordsmith/templates.jsonl` first
5. Fall back to built-in templates if no custom match
6. Generate scaffolded document with guidance
7. Prompt: **"Draft ready. Use `/wordsmith:edit` to refine prose, or continue iterating."**

## Post-Scaffold Actions

After generating draft:

1. Offer to save modifications as custom template
2. Suggest `/wordsmith:edit` for prose refinement
3. Highlight any sections needing user input

## Template Management

User templates stored at: `~/.claude/wordsmith/templates.jsonl`

### List Templates

**Goal:** Show all available templates (built-in + user) so user can choose.

Built-in templates: `rfc`, `adr`, `blog`

### Create Template

**Goal:** Persist user's template definition for reuse.

**Required information:**
- Template name (must be unique)
- Sections with guidance (at minimum)
- Base template if extending existing

**Constraints:**
- Validate name uniqueness before saving
- Confirm with user before overwriting existing

**JSONL Schema:**

```json
{
  "ts": "ISO-8601",
  "name": "template-name",
  "base": "rfc|adr|blog|null",
  "description": "One-line description",
  "sections": [{"name": "...", "required": true, "guidance": "..."}],
  "header_fields": ["field1", "field2"],
  "quality_checks": ["Check 1", "Check 2"],
  "source": "user"
}
```

### Delete Template

**Goal:** Remove user template from storage.

**Constraints:**
- Cannot delete built-in templates
- Confirm before deleting

## Rules

- Always check for custom templates before using built-ins
- Use Ask tool for required inputs before scaffolding
- Include quality checks at end of generated document
- Prompt for `/wordsmith:edit` after scaffolding
- Preserve user's existing content if iterating on a draft
