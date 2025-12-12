# Changelog

All notable changes to moo.md are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Marketplace philosophy document (`docs/philosophy.md`)
- CHANGELOG.md with version history
- Career plugin to README plugin list
- Changelog section to CLAUDE.md with commit guidelines

### Changed
- Categories now use `core` (hope) and `domain` (satellites)
- CLAUDE.md structure diagram reflects all 5 plugins

### Fixed
- Version mismatch in hope/skills/soul/SKILL.md (0.0.1 → 0.1.2)
- "cVoice" typo in marketplace.json

---

## [0.1.2] - 2025-12

### Added
- `/hope:intent` command for clarification protocol

---

## [0.1.1] - 2025-12

### Added
- Career plugin with 10 commands (assess, simulate, star, gap, drill, eval-comm, stakeholder, reframe, focus, osint)
- Founder plugin with 8 commands (validate, market-size, compete, pitch, investor-prep, financials, launch, board)
- Founder power user reference docs
- Career power user reference docs

### Fixed
- Missing hookEventName in UserPromptSubmit hook
- Career plugin.json name, description, and keywords

---

## [0.1.0] - 2025-12

### Added
- Learnings recall skill with auto-triggering
- Learnings compaction command
- Smart gating for learnings
- User documentation for all plugins
- `/document` command for repo maintenance

### Changed
- Documentation rewritten with progressive disclosure
- Keyword-first approach in docs
- Simplified update instructions
- Cut journey tutorials, consolidated navigation (-54% docs)

---

## [0.0.2] - 2025-11

### Added
- Hope plugin (soul, gate, trace, recall skills)
- Product plugin (prd, compete, research, metrics, cohort, prd-eval, debt)
- Wordsmith plugin (edit, voice, narrative, copy, blog-eval)
- Session lifecycle hooks
- Learnings system (`~/.claude/learnings/`)

### Changed
- Initial public structure

---

## Notes

- **hope** is the core plugin (category: `core`)
- **product**, **wordsmith**, **founder**, **career** are domain plugins (category: `domain`)
- Domain plugins recommend but don't require hope
- Versioning applies to the marketplace; individual plugins have their own versions in plugin.json
