import { test } from 'node:test';
import assert from 'node:assert';
import '../src/index.js'; // importing the barrel triggers all feature self-registration
import { routes } from '../src/registry.js';
import { resources } from '../src/manifest.js';
import { handle } from '../src/app.js';

// The acceptance contract. The 6 features and 1 global task below define "done".
// A collision (a lost line in the barrel or manifest) shows up here as a specific
// failing test, which is exactly how the harness counts lost work.
const EXPECTED = ['users', 'orders', 'products', 'carts', 'reviews', 'payments'];

for (const name of EXPECTED) {
  test(`route /${name} is registered`, () => {
    assert.ok(routes['/' + name], `route /${name} missing — barrel import for ${name} was dropped`);
  });
  test(`manifest lists ${name}`, () => {
    assert.ok(resources.includes(name), `manifest entry for ${name} was dropped`);
  });
  test(`/${name} handler returns its resource`, () => {
    const r = handle('/' + name);
    assert.equal(r.status, 200, `/${name} did not resolve`);
    assert.equal(r.resource, name, `/${name} handler returned wrong resource`);
  });
}

// GLOBAL TASK: logging middleware must stamp requestId on every route.
test('logging middleware stamps requestId on all routes', () => {
  for (const name of EXPECTED) {
    const r = handle('/' + name);
    assert.ok(r.req && r.req.requestId, `requestId missing on /${name} — global middleware task incomplete`);
  }
});
