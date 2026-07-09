#!/usr/bin/env bun
// score.mjs — deterministic scorer for sound:setup proposals. No LLM anywhere.
// Usage: bun score.mjs <fixture-dir> <proposal-json-file>
// Compares proposal against <fixture-dir>/expected.json:
//   tags  — exact set equality (reported per-tag)
//   globs — per expected key: exact string OR same matched file-set over repo/tree.txt
// (the pathless pair is a Phase-5 mechanical constant, deliberately NOT proposed or scored)
import { readFileSync, existsSync } from "fs";
import { join } from "path";

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

const treeFile = join(fixtureDir, "repo", "tree.txt");
const paths = existsSync(treeFile)
  ? readFileSync(treeFile, "utf8").split("\n").map((l) => l.trim().replace(/^\.\//, "")).filter(Boolean)
  : [];

const setEq = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// Glob equivalence is decided over the real tree PLUS canary paths derived from it
// (every observed dir × every observed basename-suffix). Without canaries, a scoped
// glob and an unscoped one are indistinguishable whenever the real files happen to
// all live inside the scope — the canaries make scoping load-bearing while still
// absorbing cosmetic variants (brace order, extension arms no file ever uses).
const dirs = [...new Set(paths.map((p) => p.split("/").slice(0, -1).join("/")).filter(Boolean))];
const exts = [...new Set(paths.map((p) => {
  const base = p.split("/").pop();
  const dot = base.indexOf(".");
  return dot > 0 ? base.slice(dot + 1) : "";
}).filter(Boolean))];
const universe = [...paths, ...dirs.flatMap((d) => exts.map((e) => `${d}/__canary__.${e}`))];

const matchSet = (glob) => universe.filter((p) => new Bun.Glob(glob).match(p)).sort().join("\n");
const globEq = (a, b) => a === b || (paths.length > 0 && matchSet(a) === matchSet(b));

const expTags = expected.tags ?? [];
const gotTags = proposal.tags ?? [];
const expGlobs = expected.globs ?? {};
const gotGlobs = proposal.globs ?? {};

const tagsMatch = setEq(expTags, gotTags);

const checks = [
  {
    name: "tags",
    pass: tagsMatch,
    detail: `expected [${expTags}] got [${gotTags}]` +
      (tagsMatch ? "" :
        ` | missing: [${expTags.filter((t) => !gotTags.includes(t))}] spurious: [${gotTags.filter((t) => !expTags.includes(t))}]`),
  },
  ...Object.entries(expGlobs).map(([key, expGlob]) => ({
    name: `glob:${key}`,
    pass: typeof gotGlobs[key] === "string" && globEq(expGlob, gotGlobs[key]),
    detail: `expected "${expGlob}" got "${gotGlobs[key] ?? "∅"}"`,
  })),
  ...Object.keys(gotGlobs)
    .filter((key) => !(key in expGlobs))
    .map((key) => {
      const redundant = typeof expGlobs.default === "string" && globEq(gotGlobs[key], expGlobs.default);
      return {
        name: `glob:${key}`,
        pass: redundant,
        detail: redundant
          ? `redundant key "${key}" (≡ default class) — harmless at install`
          : `spurious glob key "${key}": "${gotGlobs[key]}"`,
      };
    }),
];

const passed = checks.filter((c) => c.pass).length;
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name.padEnd(14)} ${c.detail}`);
console.log(`SCORE ${passed}/${checks.length}`);
process.exit(passed === checks.length ? 0 : 1);
