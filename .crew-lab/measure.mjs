#!/usr/bin/env node
// Deterministic metrics for one finished trial directory. Reads final state only;
// trusts no agent's self-report. Output is one JSON line for the results log.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED = ['users', 'orders', 'products', 'carts', 'reviews', 'payments'];
const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.error('usage: measure.mjs <trialDir>'); process.exit(2); }

// 1. Correctness: run the oracle once, capture output pass-or-throw, parse once.
let out = '';
try {
  out = execFileSync('node', ['--test', 'tests/contract.test.js'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  out = (e.stdout || '') + (e.stderr || '');
}
const pass = Number((out.match(/# pass (\d+)/) || [])[1] || 0);
const fail = Number((out.match(/# fail (\d+)/) || [])[1] || 0);
const testError = (!pass && !fail) ? (out.split('\n').find(l => /Error|Cannot/.test(l)) || 'unknown test error').trim() : null;

// 2. Structural coordination signals — measured at runtime, not by parsing prose.
let routes = 0, manifest = 0, probeError = null;
try {
  const probe = `import('./src/index.js').then(async()=>{const r=await import('./src/registry.js');const m=await import('./src/manifest.js');console.log(JSON.stringify({routes:Object.keys(r.routes).length,manifest:m.resources.length}))}).catch(e=>{console.log(JSON.stringify({err:String(e.message||e)}))})`;
  const out = execFileSync('node', ['--input-type=module', '-e', probe], { cwd: dir, encoding: 'utf8' }).trim();
  const j = JSON.parse(out.split('\n').pop());
  if (j.err) probeError = j.err; else { routes = j.routes; manifest = j.manifest; }
} catch (e) { probeError = String(e.message || e); }

// 3. Lost work: a handler file that exists but never made it into routes/manifest = a dropped hot-file edit.
const handlerDir = join(dir, 'src', 'handlers');
const handlerFiles = existsSync(handlerDir) ? readdirSync(handlerDir).filter(f => f.endsWith('.js')).map(f => f.replace('.js', '')) : [];
const handlersBuilt = handlerFiles.filter(n => EXPECTED.includes(n)).length;
const lostImports = handlersBuilt - routes; // handlers built but not routed = a dropped barrel edit
const missingFeatures = EXPECTED.filter(n => !handlerFiles.includes(n));

console.log(JSON.stringify({
  correct: fail === 0 && pass > 0 && !testError,
  tests: { pass, fail, error: testError },
  routes, manifest,
  handlersBuilt,
  lostHotFileEdits: Math.max(0, lostImports) + Math.max(0, handlersBuilt - manifest),
  missingFeatures,
  probeError,
}));
