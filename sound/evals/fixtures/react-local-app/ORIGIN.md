# Origin — react-local-app fixture

**Source:** local path `/Users/saad.shahd/repos/games/worldbox` (private repo, not published — no license file to record). Snapshot date: 2026-07-09. No commit SHA captured (working tree, not queried via git log for this snapshot).

**Repo shape:** single-package Vite + React 19 + Pixi.js game (a deterministic ecosystem simulation, "worldbox"). Not a monorepo (`pnpm-workspace.yaml` present but only lists the root package — kept out of this fixture as non-evidence-bearing). Purely local/client-side: no server, no database, no third-party network side effects.

## Files included (12, ~68KB)

- `package.json` — verbatim. Carries `react`, `react-dom`, `@pixi/react`, `pixi.js`, `jotai`, `neverthrow`, `valibot` dependencies; devDependencies include `vitest`, `@playwright/test`, `fast-check`.
- `tsconfig.json` — verbatim. `"jsx": "react-jsx"` is the strongest single signal of real React usage.
- `tsconfig.ui.json` — verbatim; one of several project-reference tsconfigs, this one scopes the UI slice.
- `vitest.config.ts` — verbatim. `include: ["test/**/*.test.ts"]`, `exclude: ["test/determinism-browser/**"]` — documents the repo's real test convention.
- `playwright.config.ts` — verbatim. `testMatch: "**/*.spec.ts"`, `testDir: "test"` — shows the repo runs two distinct test tools (vitest for `.test.ts`, Playwright for `.spec.ts`) inside the same `test/` tree.
- `src/main.tsx` — verbatim (25 lines). Entry point; `createRoot`, `<StrictMode>`, and the same-origin `fetch("/data/biomes.json")` call examined for the distributed-tag decision.
- `src/ui/app.tsx` — truncated to 150 lines + `// [trimmed]` (original 154 lines). Root React component.
- `src/ui/StartButton.tsx` — verbatim (55 lines). Small real component, JSX usage.
- `src/ui/use-simulation.ts` — verbatim (129 lines). Custom React hook (`.ts`, not `.tsx` — no JSX syntax inside despite being UI-adjacent).
- `src/io/mods/index.ts` — verbatim (56 lines). The other `fetch()` call site (`/data/world_params.json`, `/data/biomes.json`), used to confirm both fetches are same-origin static asset reads, not a remote API.
- `test/world/terrain.test.ts` — verbatim. Real vitest unit test, confirms `.test.ts` naming convention.
- `test/determinism-browser/hash.spec.ts` — verbatim (29 lines). Real Playwright test, confirms `.spec.ts` is a distinct, vitest-excluded convention.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -400` run from the real repo root (2026-07-09), 295 lines, no truncation (repo is small enough that the full listing fits under the 400-line cap). `.git` excluded in addition to the spec's literal command for the same reason as the `ts-library` fixture (git plumbing floods the head, adds no evidence).

## Excluded (evidence-bearing but left out to stay under the file-count target)

- `src/ui/TraitEditor.tsx`, `src/ui/SeedDisplay.tsx`, `src/viewport/canvas/index.tsx` — additional real `.tsx` files, redundant with `app.tsx`/`StartButton.tsx` as react-tag evidence; referenced by name in `expected.json` notes but not copied.
- `src/sim/*`, `src/worker/*`, `src/primitives/*` — the deterministic simulation core; no react/db/distributed evidence, out of scope for tag discrimination.
- Generated/local dev noise not evidence-bearing: `.cache/`, `test-results/`, `tsconfig.tsbuildinfo`, `pnpm-lock.yaml` (>10KB), `.claude/`, docs (`architecture.md`, `decisions.md`, etc. — narrative, not source evidence).

## Trimming

`src/ui/app.tsx` exceeded 150 lines by 4 and was truncated with a `// [trimmed]` tail marker. All other included files are verbatim.
