# Origin

- Source: local path `/Users/saad.shahd/repos/adaptive-ui-ecosystem`, git commit `4048c9b0f578d9a38482d65fbff6eb3e8a508b3e` (2025-09-29).
- License: private/unpublished project, not applicable.
- pnpm monorepo with `pnpm-workspace.yaml` declaring `frontend/*`, `services/*`, `infrastructure/*`, `scripts`. Only `frontend/` (React + Vite) and `services/api/` (Fastify) were mined per task scope. `services/graph-analyzer/` (a Python FastAPI/analysis service — requirements.txt, pyproject.toml, app/) and `infrastructure/` (ClickHouse SQL, GrowthBook/PostHog config) exist in the real repo and appear in `tree.txt` for evidence completeness, but no files from them are copied into `repo/`.

## Files included (9, ~40KB total)

- `pnpm-workspace.yaml` — verbatim. Workspace marker proving the monorepo split.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' | head -400` run from repo root, verbatim (107 lines).
- `frontend/package.json` — verbatim. React 18, react-router-dom, xstate, recharts, socket.io-client, react-hook-form, zod, vitest devDep.
- `frontend/tsconfig.json` — verbatim. `jsx: react-jsx`, path aliases under `src/`.
- `frontend/src/components/Layout.tsx` — verbatim, 48 lines. Representative JSX: react-router-dom's `Link`/`useLocation`.
- `services/api/package.json` — verbatim. Fastify 4, @fastify/websocket, @clickhouse/client, ioredis, posthog-node, @growthbook/growthbook, vitest devDep.
- `services/api/tsconfig.json` — verbatim.
- `services/api/src/config/database.ts` — verbatim, 121 lines. `@clickhouse/client`'s `createClient(...)` — owned analytics DB evidence.
- `services/api/src/config/redis.ts` — verbatim, 140 lines. ioredis client + a `RedisService` wrapper (get/set/del/incr/hset) — included to show this is plain-cache-shaped on its own; the pub/sub evidence lives in event.service.ts, not here.
- `services/api/src/services/event.service.ts` — first 150 lines of 604 PLUS two verbatim excerpts (source lines 392–398 `publishRealtimeEvent` and 531–539 `publishEvent`, both calling `this.redis.publish(...)`), each gap marked with `// [trimmed]`. Shows ClickHouse insert + the actual Redis pub/sub fan-out — this is the file that justifies the `distributed` tag. (Excerpts added 2026-07-09 after an eval run proved the original trim left the tag's evidence as narration in a comment rather than code — the model correctly refused to fire on it.)

## Trimming notes

- `event.service.ts` exceeded the 150-line cap (604 lines); truncated per spec with an inline marker naming the omitted content (the `publishEvent`/`publishRealtimeEvent` bodies and the websocket-consuming route, which were grepped but not copied to stay under the file-count cap — cited verbatim by line number in `expected.json` notes instead of fabricated).
- Did not include `services/api/src/routes/events.ts` (511 lines, the `@fastify/websocket` route) or `frontend/src/services/websocket.service.ts` (frontend consumer) — both real and grepped for the notes, but omitted to keep the fixture under the ~30-file / 100KB targets since `event.service.ts` already carries the load-bearing evidence.
- `pnpm-lock.yaml` does not exist at this repo's root (no lockfile was found via `ls`) — nothing to exclude there.
