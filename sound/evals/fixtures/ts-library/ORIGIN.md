# Origin — ts-library fixture

**Source:** local path `/Users/saad.shahd/repos/sieve` (private repo, not published — no license file to record). Snapshot date: 2026-07-09. No commit SHA captured (working tree, not queried via git log for this snapshot).

**Repo shape:** pnpm workspace, `codesieve` — a model-based/state-machine testing library. Two workspace packages: `packages/core` (`@codesieve/core`, the published library — vitest + fast-check, `tests/` dir, zero `.tsx` files) and `packages/playground` (`@codesieve/playground`, a React+Vite devtool visualizer app — NOT part of this fixture's source selection, see notes below and in `expected.json`).

## Files included (12, ~88KB before truncation)

- `package.json` — repo root, verbatim.
- `pnpm-workspace.yaml` — verbatim.
- `packages/core/package.json` — verbatim (the library's manifest: vitest, fast-check, no react).
- `packages/playground/package.json` — verbatim, included ONLY because the spec mandates every workspace package.json; this is the file that carries the react/react-dom/reactflow dependency evidence for the full monorepo (see contradiction note below).
- `packages/core/tsconfig.json` — verbatim.
- `packages/core/vitest.config.ts` — verbatim; shows `esbuild.jsxImportSource: "./jsx-runtime"`, the custom (non-React) JSX runtime config.
- `packages/core/index.ts` — truncated to 150 lines + `// [trimmed]` (original 166 lines). Public API surface, shows `GraphBuilder`, `Model` class, composition operations.
- `packages/core/core/types.ts` — verbatim (122 lines). Core domain types (`TransitionType`, `StateNode`, `GraphEdge`), no react/db/network imports.
- `packages/core/jsx-runtime/createElement.ts` — verbatim (40 lines). Evidence that the JSX pragma is a hand-rolled `createElement`, not `react/jsx-runtime`.
- `packages/core/tests/composition/laws.property.test.ts` — truncated to 150 lines + marker (original 293 lines). Property-based test using fast-check, naming convention `*.property.test.ts`.
- `packages/core/tests/components/state-fragment.test.ts` — truncated to 150 lines + marker (original 397 lines). Ordinary vitest unit test, naming convention `*.test.ts`.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -400` run from the real repo root (2026-07-09). `.git` internals were excluded in addition to the spec's literal command — the raw command floods `head -400` with `.git/objects/*` plumbing that isn't evidence; this repo has full git history so `.git` alone produced 285 of 400 lines before exclusion.

## Excluded (evidence-bearing but deliberately left out)

- `packages/playground/**/*.tsx` (14 files, real JSX/React usage: `App.tsx`, `graph-visualizer.tsx`, `src/components/ui/*.tsx`, etc.) and `packages/playground/main.tsx`. See `expected.json` notes — this is the one material judgment call in this fixture and it is flagged for human review.
- `dist/`, `node_modules/`, `.claude/` agent config, `packages/core/CLAUDE.md`, `packages/core/tsconfig.performance.json`, `packages/core/test-visual-debugger.ts` (a manual debug script, not a test), coverage output — none carry discriminating tag evidence beyond what's already captured.

## Trimming

Two test files and `index.ts` exceeded 150 lines and were truncated with a `// [trimmed]` tail marker, per spec. All other included files are verbatim.
