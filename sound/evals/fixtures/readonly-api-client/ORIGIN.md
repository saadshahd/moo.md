# Origin

- Source: https://github.com/insin/react-hn (author: Jonny Buchanan)
- Branch: `classic` (repo's default branch)
- Commit: `7c5a7802109b1d2bae5c8493dd1fecf5bfe823a9`
- License: MIT (`LICENSE.md` in repo root; note GitHub's license-detector API mislabels it `other`/`NOASSERTION` because it's a non-standard filename — `package.json` declares `"license": "MIT"` and `LICENSE.md` contains the verbatim MIT text, verified directly).
- Stars at time of snapshot: 2212. Description: "React-powered frontend for Hacker News using its Firebase API."
- Snapshot date: 2026-07-09.

## Files included (8, 32KB total)

- `package.json` — verbatim. Declares `react@15.3.2`, `react-dom@15.3.2`, `react-router@2.8.1`, `firebase@3.4.1`, `reactfire@1.0.0` (a React-binding library for Firebase's Realtime Database live-query API). No test runner or test-related dependency anywhere in the file.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*'` equivalent, generated from `git/trees/classic?recursive=1`, verbatim (76 lines, under 400 cap). No file anywhere in the tree matches a `*.test.*` / `*.spec.*` / `__tests__/` convention.
- `src/services/HNService.js` — verbatim, 55 lines. The entire remote-data boundary: initializes a Firebase app pointed at `https://hacker-news.firebaseio.com` and exposes `fetchItem`/`fetchItems`/`storiesRef`/`itemRef`/`userRef`/`updatesRef`. Every one of these is a Firebase Realtime Database *read* (`.once('value', ...)` or handing back a `ref` for live-binding) — no `.set(`, `.push(`, `.update(`, or `.remove(` call anywhere in the file or repo (verified via GitHub code search scoped to this repo).
- `src/StoryListItem.js` — verbatim, 125 lines. Representative component: uses `reactfire`'s `bindAsObject(HNService.itemRef(props.id), 'item')` to live-subscribe to a single HN item — a read-only binding, not a write.
- `src/Stories.js` — verbatim, 122 lines. Top-level list component driving pagination/story-listing over the same read-only `HNService` surface.
- `src/App.js` — verbatim, 72 lines. Router root; wires routes, no additional remote calls beyond `HNService`.
- `src/stores/ItemStore.js` — verbatim, 96 lines. Client-side in-memory cache/store layer sitting on top of `HNService`'s reads — no remote writes.
- `src/utils/storage.js` — verbatim, 9 lines. Included specifically to show the ONLY "write" in the codebase: `window.localStorage[key] = value`, i.e. purely client-local persistence (settings like list spacing), never a remote call. This is the file that would trip a naive "any `.set(`/write-looking call = distributed" heuristic; it's local-only.

## Trimming notes

- No file exceeded 150 lines, so no `// [trimmed]` truncation was needed.
- No `tsconfig.json` — repo is plain JavaScript (`nwb.config.js` build tool, no TypeScript dependency in `package.json`), so none exists to include.
- No test config file exists (no Jest/Mocha/Karma config in the tree or `package.json` devDependencies) — the repo genuinely has zero tests; noted in `expected.json`.
- Did not include `nwb.config.js` (build tool config, not evidence for react/db/distributed tagging) or the icon/image assets under `public/img/` (60 binary files, zero evidence value).
