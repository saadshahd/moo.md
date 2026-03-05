## Why

Consult was rewritten in `dc6b3f2` — from passive text synthesis to interactive expert guidance with invisible attribution. The existing expert-consultation spec requires visible source attribution ("names the documented source and acknowledges where the expert's coverage ends"), directly contradicting the new behavior where expert names never appear in output. The spec also has no requirements for the interactive AskUserQuestion workflow, Minto pyramid presentation, or the 4-step Route/Reason/Present/Land cycle that now defines consult's behavior.

## What Changes

**Modified capabilities:**

- `expert-consultation`: 3 requirements rewritten, 4 requirements added, 1 scenario removed

**Spec-level changes:**

- **Grounded expert reasoning** — flip from visible attribution to internal-only discipline
- **Four consultation modes** — add domain diversity constraint (max 2/row), inferred mode detection
- **Productive disagreement** — interactive concern selection replaces passive text organization
- **Remove** "Source attribution" scenario (contradicts invisible experts)
- **Add** invisible expert attribution — hard prohibition on expert names in output
- **Add** interactive Minto presentation — AskUserQuestion structure, detail panel constraints
- **Add** minimal text discipline — one bold sentence before/after prompts
- **Add** four-step workflow cycle — Route/Reason/Present/Land with loop-back

## Capabilities

### Modified Capabilities

- `expert-consultation`: Updated from 4 requirements to 8. Reflects interactive, invisible-attribution consult behavior.

### New Capabilities

(None — all changes modify the existing expert-consultation spec.)

## Impact

- **openspec/specs/expert-consultation/spec.md**: Full rewrite — 4 requirements → 8 requirements
- **v4-skill-pipeline spec**: No changes needed. Its consult requirement ("panel debates preserved, no severity machinery") remains compatible.
- **Version**: No plugin version bump — spec sync only, no code changes.
