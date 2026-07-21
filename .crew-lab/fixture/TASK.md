# TASK — implement the API

This repo is a tiny request-dispatch API. It ships with a failing test suite
(`tests/contract.test.js`) that defines "done". Make every test pass.

## The work: 6 features + 1 global task

Each **feature** `<name>` in {users, orders, products, carts, reviews, payments} needs THREE edits:

1. **Create** `src/handlers/<name>.js` — self-register the route:
   ```js
   import { register } from '../registry.js';
   register('/<name>', () => ({ resource: '<name>', ok: true }), { id: 'string' });
   ```
2. **Add one import line** to `src/index.js` between the markers:
   `import './handlers/<name>.js';`
3. **Append the name** to `src/manifest.js` between the markers: `'<name>',`

The **global task** (do this AFTER the features exist, or it wraps nothing):

- Add a logging middleware to `src/middleware.js` that stamps a `requestId` on
  every request, e.g. `middlewares.push((req) => ({ ...req, requestId: 'req-' + Math.random().toString(36).slice(2) }));`

## Shared hot files (coordinate here)

- `src/index.js` — every feature edits it (the barrel).
- `src/manifest.js` — every feature edits it.
- `src/middleware.js` — the global task edits it, and depends on all features.

## Definition of done

`npm test` is green: all 6 routes registered, all manifest entries present,
all handlers return their resource, and requestId is stamped on every route.
