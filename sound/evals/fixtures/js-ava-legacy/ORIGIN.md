# Origin — js-ava-legacy fixture

**Source:** local path `/Users/saad.shahd/repos/rule-engine` (`@statsbomb/rule-engine`, GitHub `statsbomb/rule-engine`, MIT license per `package.json`). Snapshot date: 2026-07-09. No commit SHA captured (working tree, not queried via git log for this snapshot).

**Repo shape:** single-package, pre-monorepo-era JS library (a domain rule engine with a business-readable DSL, built on `ohm-js` grammar + `ramda` + `rxjs`). Rollup build, AVA test runner, `nyc` coverage, `xo`/`prettier` lint. No TypeScript anywhere. This fixture exists specifically to exercise **glob tuning**, not tag detection (tags are the uninteresting `[]` case here — see `expected.json`).

## Files included (9, ~40KB)

- `package.json` — verbatim. Carries the `ava` config block (no custom `files` glob → AVA's own default test discovery applies), `xo`/`prettier`/`nyc` config, dependencies (`ohm-js`, `ramda`, `rxjs`, `camelcase`, `decamelize`, `memoizee` — no react, no db client, no HTTP client).
- `src/index.js` — verbatim (9 lines). Barrel export, ESM `import`/`export` syntax (transpiled/bundled by Rollup for the build, but authored as ESM).
- `src/validator.js` — verbatim (120 lines). Core validator logic.
- `src/compiler.js` — verbatim (115 lines). Compiles the ohm-js grammar output into executable rules.
- `src/data/card-rules.js` — verbatim (10 lines). Sample of the `src/data/*-rules.js` convention (declarative rule tables).
- `helpers/index.js` — verbatim (7 lines). Shared test helper (`isFn`), required by test files via relative `require('../helpers')` — evidence that `helpers/` is NOT itself a test directory (AVA's default excludes don't need to special-case it since it isn't under `test/`).
- `test/validator.js` — verbatim (80 lines). Real AVA test, `require('ava')`, `require('..')`. Filename carries no `.test.`/`.spec.` suffix — this is the key glob-tuning evidence.
- `test/fields.js` — truncated to 150 lines + `// [trimmed]` (original 248 lines). Same no-suffix naming convention.
- `test/chain/start.js` — verbatim (105 lines). Shows the convention holds inside nested `test/` subdirectories too (`test/chain/`, `test/card/`, `test/location/`, `test/phase/` all follow the same no-suffix, directory-scoped pattern in the real repo).
- `tree.txt` — `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -400` run from the real repo root (2026-07-09), 93 lines total, no truncation. `.git` excluded in addition to the spec's literal command for the same reason as the other two fixtures (285 of the first 400 lines were git plumbing before exclusion). `coverage/` (a `.gitignore`'d, generated `nyc` report directory with 28 `.html`/`.js.html` files) is left IN the tree listing since the spec's find command has no coverage exclusion and its presence is itself real evidence (confirms `nyc`/coverage tooling); it lands after the real `src/`/`test/`/`helpers/` entries in this listing so nothing evidence-bearing was pushed past the 400-line cap.

## Excluded (evidence-bearing but left out)

- `src/compiled/*.js` (ohm-js-generated parser output, 4 files) and `src/grammar.ohm` — the grammar DSL itself, interesting but not tag/glob-discriminating beyond what `compiler.js` already shows.
- `test/card/`, `test/location/`, `test/phase/` and remaining `test/chain/*.js` — redundant instances of the same no-suffix test-naming convention already established by the three test files included.
- `coverage/`, `*.html` (all generated, `.gitignore`'d), `package-lock.json`-equivalent (none present; repo predates lockfiles being committed), `.remarkignore`, `.editorconfig`, `.gitattributes`, `LICENSE`, `README.md` — no tag/glob evidence.

## Trimming

`test/fields.js` exceeded 150 lines and was truncated with a `// [trimmed]` tail marker. All other included files are verbatim.
