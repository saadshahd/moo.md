# Origin — dead-dep-react

- **Source**: https://github.com/0xatrilla/Apple-AI-CLI
- **Commit**: `d15fd1c6f6f2a70327318e69d36ac9fed99bca43` (HEAD of `main`, fetched 2026-07-09)
- **License**: MIT (repo `LICENSE` file; also `"license": "MIT"` in package.json)
- **Stars at capture**: 34

## Why this repo

Genuine dead-dep specimen: `ink@^4.4.1` and `react@^18.2.0` (plus `blessed`, `blessed-contrib`, `terminal-kit` — the classic tried-every-TUI-library accretion) sit in `dependencies`, while the shipped UI is plain readline/chalk/boxen (`src/ui/simple-terminal-ui.ts`). Verified at the commit above: zero `.tsx`/`.jsx` files in the tree, zero `react`/`ink` imports or `createElement` calls across all 16 `src/**/*.ts` files and `demo-ui.js`. The only `react` strings in source are template literals (demo code-gen output in `foundation-client.ts`) and a content-sniffing predicate (`language-detector.ts`) — discriminating trap material, not usage.

**Fame bar deliberately relaxed** (coordinator decision 2026-07-09): genuine dead-dep specimens only survive in small personal repos — popular repos get unused deps flagged and removed fast (depcheck, renovate, human review). Stars are invisible to the prober; the fixture's discriminating power is the dep-present/usage-absent gap being real. 40+ better-known repos were hunted first and every one failed either dep-present or usage-absent.

## Files included (all verbatim from the commit; truncation marked)

- `repo/package.json` — verbatim
- `repo/tsconfig.json` — verbatim
- `repo/tree.txt` — full 31-file listing derived from `git/trees/main?recursive=1` (find-style `./` prefix; repo tracks no node_modules)
- `repo/src/index.ts` — verbatim (65 lines)
- `repo/demo-ui.js` — verbatim (27 lines; the one non-TS source file)
- `repo/src/ui/simple-terminal-ui.ts` — first 150 of 438 lines, `// [trimmed]`
- `repo/src/api/foundation-client.ts` — first 150 of 663 lines, `// [trimmed]`
- `repo/src/utils/language-detector.ts` — first 150 of 168 lines, `// [trimmed]`

## What was trimmed and why

Docs (`README.md`, `docs/`), assets, shell scripts, lockfile, and the remaining 12 `src/**/*.ts` files were omitted — they carry no additional discriminating evidence. The three truncated files were cut at 150 lines per the fixture spec; the load-bearing evidence (imports at top of file, the react-in-string-literal traps at foundation-client.ts:117 and language-detector.ts:60) falls within the kept ranges.
