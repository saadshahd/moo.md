# Origin

- Source: local path `/Users/saad.shahd/repos/moltbot`, git commit `109ac1c54932511b36dc51fb0d18fbcddd7766d1` (2026-01-28).
- License: see the repo's own `LICENSE` file (not reproduced here; not copied into the fixture).
- Single-package repo at root plus a `ui/` control-panel package and `packages/*`/`extensions/*` workspace members (`pnpm-workspace.yaml`: `. / ui / packages/* / extensions/*`). Only root `src/` was mined — `ui/` was inspected only to verify it is Lit, not React (see notes below), no `ui/` files copied.

## Files included (9, ~64KB total)

- `package.json` — verbatim, 10.6KB. Declares `grammy`, `@grammyjs/runner`, `@line/bot-sdk`, `@aws-sdk/client-bedrock`, `sqlite-vec`, `@slack/bolt`, `@whiskeysockets/baileys`, and more bot-gateway/provider SDKs.
- `pnpm-workspace.yaml` — verbatim. Workspace marker.
- `tsconfig.json` — verbatim. No `jsx` compiler option; excludes `src/**/*.test.ts` and `src/**/*.test.tsx`.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' -not -path '*/vendor/*' | head -400` run from repo root, verbatim (400 lines, hit the cap — repo is large).
- `src/telegram/send.ts` — TRUNCATED to first 150 of 724 lines, `// [trimmed]` tail marker naming what continues past the cut (grammy `bot.api.sendMessage`-family calls). Grammy message-sending evidence.
- `src/line/send.ts` — TRUNCATED to first 150 of 629 lines, `// [trimmed]` tail marker. Includes the full `sendMessageLine()` function body (lines 106-153) calling `@line/bot-sdk`'s `messagingApi.MessagingApiClient.replyMessage`/`.pushMessage` — the load-bearing distributed-tag evidence for LINE.
- `src/agents/bedrock-discovery.ts` — TRUNCATED to first 150 of 200 lines, `// [trimmed]` tail marker. `@aws-sdk/client-bedrock`'s `ListFoundationModelsCommand` usage — a read-only model-catalog call, included per task instruction but explicitly flagged in `expected.json` as NOT itself distributed-tag-qualifying (read-only consumption).
- `src/memory/memory-schema.ts` — verbatim, 94 lines. `CREATE TABLE`/`CREATE VIRTUAL TABLE ... USING fts5` DDL against a `node:sqlite` `DatabaseSync` handle — owned embedded-db evidence.
- `src/memory/sqlite.ts` — verbatim, 10 lines. `requireNodeSqlite()` — confirms the db is Node's built-in `node:sqlite`, not a third-party driver.

## Verification performed (not fabricated, all grepped against the real repo)

- `find . -iname "*.tsx" -not -path "*/node_modules/*"` → 0 hits repo-wide. Confirmed via `ui/package.json` that the control-panel package uses `lit`, not React. `react` tag correctly absent.
- `find src -iname "*.test.ts" | wc -l` → 885. `find src -iname "*.spec.ts" | wc -l` → 0. Test glob narrowed to `**/*.test.ts` only.
- `grep -rl "sqlite-vec\|better-sqlite3\|node:sqlite" src` and `grep -n "CREATE TABLE\|DatabaseSync" src/memory/memory-schema.ts` both confirm the db evidence before labeling.

## Trimming notes

- Three files exceeded 150 lines (`send.ts` x2, `bedrock-discovery.ts`) and were truncated per spec with inline markers naming the omitted content.
- Did not include `src/line/bot.ts`, `src/telegram/bot.ts`, or the `*.test.ts` delivery-mock files (e.g. `auto-reply-delivery.test.ts`) that also reference `pushMessage`/`replyMessage` — the truncated `send.ts` files already carry the load-bearing evidence; adding more would exceed the "3-8 representative files" guidance without adding new evidence classes.
- Did not copy `pnpm-lock.yaml` (378.1KB, well over the 10KB lockfile exclusion threshold).
