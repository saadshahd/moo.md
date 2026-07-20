#!/usr/bin/env bun
// score.mjs — deterministic scorer for sound:setup proposals. No LLM anywhere.
// Usage: bun score.mjs <fixture-dir> <proposal-json-file>
// Compares proposal against <fixture-dir>/expected.json:
//   tags  — exact set equality (reported per-tag)
//   rules — three-class labels: every must_install present, no must_not_install present,
//           all proposed names exist in the corpus, every citation path exists in tree.txt.
//           Unlabeled rules are don't-care by design (full-corpus exact labels are unlabelable).
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const [fixtureDir, proposalFile] = process.argv.slice(2);
if (!fixtureDir || !proposalFile) {
  console.error("usage: bun score.mjs <fixture-dir> <proposal-json-file>");
  process.exit(2);
}

// Extraction must survive models that ignore "output ONLY JSON": prefer a fenced
// ```json block; otherwise try every `{` start until one parses as a full object.
const parse = (raw) => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/);
  const candidates = fenced ? [fenced[1]] :
    [...raw.matchAll(/\{/g)].map((m) => raw.slice(m.index, raw.lastIndexOf("}") + 1));
  return candidates.flatMap((c) => { try { return [JSON.parse(c)]; } catch { return []; } })[0];
};

const expected = JSON.parse(readFileSync(join(fixtureDir, "expected.json"), "utf8"));
const proposal = parse(readFileSync(proposalFile, "utf8"));
if (!proposal) {
  console.log("FAIL  parse          no valid JSON object found in proposal output");
  console.log("SCORE 0/1");
  process.exit(1);
}

// Both tree paths and proposal citations must normalize identically for pathSet.has() to hold.
const relPath = (p) => p.trim().replace(/^\.\//, "");
const treeFile = join(fixtureDir, "repo", "tree.txt");
const paths = existsSync(treeFile)
  ? readFileSync(treeFile, "utf8").split("\n").map(relPath).filter(Boolean)
  : [];

const setEq = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const expTags = expected.tags ?? [];
const gotTags = proposal.tags ?? [];

const tagsMatch = setEq(expTags, gotTags);

// Rule-set checks (three-class: must_install / must_not_install / don't-care).
// Two-universe name check (#153): a name is VALID if it lives in the default
// corpus/ OR the opt-in corpus-optin/, but an opt-in rule may only be PROPOSED
// by a fixture that names it in expected.optin — the physical split IS the
// default-install gate, so the scorer enforces it (fail loud, like the canary globs).
const rulesRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const namesIn = (dir) => existsSync(dir)
  ? new Set(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)))
  : new Set();
const corpusNames = namesIn(join(rulesRoot, "corpus"));
const optinNames = namesIn(join(rulesRoot, "corpus-optin"));
const validNames = new Set([...corpusNames, ...optinNames]);
const fixtureOptin = new Set(expected.optin ?? []);
const expRules = expected.rules ?? {};
const gotRules = (proposal.rules ?? []).filter((r) => r && typeof r.name === "string");
const gotNames = new Set(gotRules.map((r) => r.name.replace(/\.md$/, "")));
// Citation universe = tree.txt ∪ files actually present under repo/ — tree.txt is
// head-400-truncated at mining time, so an included excerpt file can be absent from it.
const repoDir = join(fixtureDir, "repo");
const included = readdirSync(repoDir, { recursive: true })
  .map(String).map((p) => p.split("\\").join("/")).filter((p) => p !== "tree.txt");
const pathSet = new Set([...paths, ...included]);
const citeOk = (c) => typeof c === "string" && pathSet.has(relPath(c.replace(/:\d+.*$/, "")));

const ruleChecks = !expected.rules ? [] : [
  ...(expRules.must_install ?? []).map((name) => ({
    name: `rule:+${name}`,
    pass: gotNames.has(name),
    detail: gotNames.has(name) ? "installed" : "MISSING from install set",
  })),
  ...(expRules.must_not_install ?? []).map((name) => ({
    name: `rule:-${name}`,
    pass: !gotNames.has(name),
    detail: gotNames.has(name) ? "INSTALLED but repo shows no surface for it" : "correctly excluded",
  })),
  {
    name: "rule:names",
    pass: [...gotNames].every((n) => validNames.has(n)),
    detail: `unknown rule names: [${[...gotNames].filter((n) => !validNames.has(n))}]`,
  },
  {
    name: "rule:optin",
    pass: [...gotNames].every((n) => !optinNames.has(n) || fixtureOptin.has(n)),
    detail: `opt-in rules installed without opting in (expected.optin): [${[...gotNames].filter((n) => optinNames.has(n) && !fixtureOptin.has(n))}]`,
  },
  {
    name: "rule:cites",
    pass: paths.length === 0 || gotRules.every((r) => citeOk(r.cite)),
    detail: `citations not in tree: [${gotRules.filter((r) => !citeOk(r.cite)).map((r) => `${r.name}→${r.cite}`).slice(0, 5)}]`,
  },
];

const checks = [
  {
    name: "tags",
    pass: tagsMatch,
    detail: `expected [${expTags}] got [${gotTags}]` +
      (tagsMatch ? "" :
        ` | missing: [${expTags.filter((t) => !gotTags.includes(t))}] spurious: [${gotTags.filter((t) => !expTags.includes(t))}]`),
  },
  ...ruleChecks,
];

const passed = checks.filter((c) => c.pass).length;
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name.padEnd(14)} ${c.detail}`);
console.log(`SCORE ${passed}/${checks.length}`);
process.exit(passed === checks.length ? 0 : 1);
