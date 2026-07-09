# Origin

- Source: local path `/Users/saad.shahd/repos/imaginery-friend/web` (fixture root is the `web/` subdirectory of the parent repo `imaginery-friend`, not the parent repo itself).
- Not a git repo checkout with a resolvable commit SHA in this environment; files last touched 2025-09-14 per filesystem mtimes. Snapshot date of this fixture extraction: 2026-07-09.
- License: private/unpublished project, not applicable.
- Parent repo `imaginery-friend` also contains an `api/` directory (Python service) and `infrastructure/` (Pulumi IaC) — these were deliberately excluded. Only `web/` (the Next.js app) was mined, per task scope. Mentioning them here for provenance completeness only; no files from `api/` or `infrastructure/` are included in this fixture.

## Files included (5, ~28KB total)

- `package.json` — verbatim. Declares neo4j-driver, @auth/neo4j-adapter, next-auth, nodemailer, next, react 19, react-hook-form, zod.
- `tsconfig.json` — verbatim. Standard Next.js strict config, `jsx: preserve`, path alias `@/*`.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*' -not -path '*/.next/*' | head -400` run from `web/` root, verbatim (76 lines, under 400 cap).
- `src/app/api/auth/[...nextauth]/route.ts` — verbatim. NextAuth route: instantiates a `neo4j-driver` connection directly, wires `Neo4jAdapter`, and configures next-auth's `EmailProvider` with SMTP transport settings (the nodemailer-backed magic-link email boundary).
- `src/app/api/families/settings/route.ts` — verbatim. Second API route; raw Cypher queries (`MATCH`/`MERGE`) via `neo4j-driver` session, read/write of family settings.
- `src/components/auth/SignInForm.tsx` — verbatim, 120 lines. Representative `.tsx` client component: `"use client"`, react-hook-form + zod validation, calls `next-auth/react`'s `signIn("email", ...)`.

## Trimming notes

- No file exceeded 150 lines, so no `// [trimmed]` truncation was needed.
- `tsconfig.tsbuildinfo` (395KB generated build cache) excluded — not source evidence.
- `pnpm-lock.yaml` (lives at the parent repo root, not under `web/`) excluded per spec (lockfiles over 10KB).
- Did not include a literal `nodemailer`-importing file because none exists in `web/` — verified via `grep -rn "nodemailer" --include="*.ts" --include="*.tsx" .` (excluding node_modules), zero hits. The EmailProvider config in the nextauth route.ts is the real, non-fabricated evidence for the nodemailer-backed distributed boundary; see `expected.json` notes.
