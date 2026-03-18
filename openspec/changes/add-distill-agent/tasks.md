## 1. Agent File

- [ ] 1.1 Verify `hope/agents/distill.md` exists with correct frontmatter (name, description, model, memory) and all 6 audit checks in the body

## 2. Plugin Configuration

- [ ] 2.1 Bump `hope/.claude-plugin/plugin.json` version from 4.0.3 to 4.1.0
- [ ] 2.2 Update plugin description to reflect agent capability (thinking discipline + principled audit)

## 3. Documentation

- [ ] 3.1 Add entry to `CHANGELOG.md` under [Unreleased]: "Added: distill agent — principled post-implementation audit with persistent memory"

## 4. Verification

- [ ] 4.1 Confirm agent appears in `/agents` interface when hope plugin is enabled
- [ ] 4.2 Confirm `@"hope:distill (agent)"` invokes the agent successfully
- [ ] 4.3 Confirm agent reads recent changes and produces per-principle findings or "Clean."
