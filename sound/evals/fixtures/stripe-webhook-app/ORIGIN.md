# Origin

- Source: https://github.com/vercel/nextjs-subscription-payments (Vercel's official Next.js + Stripe + Supabase SaaS starter)
- Branch: `main` (repo's default branch)
- Commit: `bdd0813206e47e6b218d42f15a7976c8a0d3c3eb`
- License: MIT
- Stars at time of snapshot: 7722. Description: "Clone, deploy, and fully customize a SaaS subscription application with Next.js." Note: repo is archived by Vercel (no longer actively maintained) but remains a canonical, widely-forked (1752 forks) reference implementation of the Stripe-webhook + Supabase pattern.
- Snapshot date: 2026-07-09.

## Files included (11, 52KB total)

- `package.json` — verbatim. Declares `stripe@^14.25.0`, `@stripe/stripe-js@2.4.0`, `@supabase/supabase-js@^2.43.4`, `@supabase/ssr@^0.1.0`, `next@14.2.3`, `react@^18.3.1`. `scripts` includes `stripe:listen` (`stripe listen --forward-to=localhost:3000/api/webhooks`) confirming the webhook route is the intended local dev target for real Stripe CLI event forwarding.
- `tree.txt` — `find . -type f -not -path '*/node_modules/*'` equivalent, generated from `git/trees/main?recursive=1`, verbatim (90 lines, under 400 cap).
- `app/api/webhooks/route.ts` — verbatim, 96 lines. The canonical webhook handler: reads the raw body, verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent`, then dispatches `product.*`/`price.*`/`customer.subscription.*`/`checkout.session.completed` events into Supabase writes (`upsertProductRecord`, `manageSubscriptionStatusChange`, etc., imported from `utils/supabase/admin` — not included verbatim here as its own file, but its call sites are visible in this route).
- `utils/stripe/server.ts` — truncated to 100 lines + `// [trimmed]` (original 181 lines). Contains `checkoutWithStripe` (calls `stripe.checkout.sessions.create(...)` — creates a real Stripe Checkout session, a side-effectful remote write) and the start of `createStripePortal` (calls `stripe.billingPortal.sessions.create(...)`); both are server actions (`'use server'`) invoked directly from client components.
- `utils/stripe/client.ts` — verbatim, 15 lines. Client-side Stripe.js loader (`loadStripe`), used to redirect the browser into the Checkout session created above.
- `utils/stripe/config.ts` — verbatim, 18 lines. Instantiates the server-side `Stripe` SDK client with the secret key and API version.
- `utils/supabase/server.ts` — verbatim, 43 lines. Server-side Supabase client factory using `@supabase/ssr`'s `createServerClient`, cookie-backed — owned database/auth access, not a third-party hosted-API call.
- `utils/supabase/queries.ts` — verbatim, 39 lines. Direct Supabase Postgres queries (`.from('subscriptions').select(...)`, `.from('products').select(...)`) — unambiguous db-ownership evidence.
- `schema.sql` — verbatim, 144 lines. Full Postgres schema (users, customers, products, prices, subscriptions tables, RLS policies) — corroborates `db` tag independent of the query files.
- `components/ui/AccountForms/CustomerPortalForm.tsx` — verbatim, 77 lines. Representative `.tsx` client component: `'use client'`, `useState`/`useRouter`, calls the `createStripePortal` server action from `utils/stripe/server.ts` on click — ties the React UI layer directly to the distributed Stripe boundary.
- `app/account/page.tsx` — verbatim, 43 lines. Server component that calls the `getUser`/`getSubscription`/`getUserDetails` query functions and renders `CustomerPortalForm`, showing the full db-read → react-render path.
- `tsconfig.json` — verbatim, 29 lines. Standard Next.js App Router config (`jsx: preserve`, path alias `@/*`).

## Trimming notes

- `utils/stripe/server.ts` exceeded 150 lines (181 total); trimmed to the first 100 lines (covers all of `checkoutWithStripe` plus the start of `createStripePortal`'s Supabase-user lookup) with a `// [trimmed]` tail marker. The full `createStripePortal` body (which calls `stripe.billingPortal.sessions.create`) is described in this ORIGIN.md and in `expected.json` notes since it was cut, but the tail of that function was verified read in full before trimming — not fabricated, just not copied past the line cap.
- `pnpm-lock.yaml` excluded (lockfile, no tagging evidence, exceeds size guidance).
- `utils/supabase/admin.ts` (contains `createOrRetrieveCustomer`, the `upsert*Record` functions called from the webhook route) was NOT included verbatim to stay under the file-count/size targets — its call sites are fully visible in `app/api/webhooks/route.ts` and `utils/stripe/server.ts`, which carry the load-bearing evidence.
- `fixtures/stripe-fixtures.json` (Stripe CLI test-fixture data, not source) and image/PNG assets excluded — no tagging evidence.
