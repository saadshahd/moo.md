#!/usr/bin/env bun
// score.mjs <run-dir>
// The SINGLE scoring authority. run.sh produces only raw review replies (<id>.run<N>.out); this
// reads each reply + its case label and computes EVERYTHING deterministically — non-answer
// detection, verdict prediction, keyword match, outcome — then aggregates. Keeping all scoring
// here (not in shell) is deliberate: shell mis-groups boolean guards and word-splits multi-word
// anchors (both were live bugs); JS matches a whole anchor string with .includes(), once.
//
// Outcome per (case,run):
//   ERR   — non-answer (empty reply / "session limit" / "API Error"): EXCLUDED from every rate.
//   CLEAN case:     pred CLEAN -> TN,  pred VIOLATION -> FP (false alarm)
//   VIOLATION case: pred CLEAN -> FN,  pred VIOLATION -> TP if an anchor appears, else WRONG rule.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = process.argv[2];
if (!runDir) { console.error("usage: score.mjs <run-dir>"); process.exit(1); }

const outFiles = readdirSync(runDir).filter((f) => /\.run\d+\.out$/.test(f));
if (outFiles.length === 0) { console.error(`no *.run*.out replies in ${runDir}`); process.exit(1); }

const isNonAnswer = (reply) =>
  reply.trim() === "" || /session limit/i.test(reply) || /^API Error/m.test(reply);

// Drop empty/blank anchors before matching: `"".includes` / `low.includes("")` is ALWAYS true,
// so a stray `[""]` in a label (the `printf '%s\n' "$@"`-with-no-args trap) would silently score
// every run as a match. Fail safe — an empty anchor matches nothing.
const anchors = (list) => (list ?? []).map((s) => s.toLowerCase()).filter((s) => s.trim() !== "");

const rows = outFiles.map((f) => {
  const m = f.match(/^(.+)\.run(\d+)\.out$/);
  const id = m[1];
  const reply = readFileSync(join(runDir, f), "utf8");
  const labelPath = join(here, "cases", id, "label.json");
  if (!existsSync(labelPath)) { console.error(`no label for ${id} (${labelPath})`); process.exit(1); }
  const label = JSON.parse(readFileSync(labelPath, "utf8"));
  const verdict = label.verdict;
  const rule = label.rule ?? "-";

  if (isNonAnswer(reply)) return { id, rule, verdict, pred: "ERR", outcome: "ERR", respected: null };

  const low = reply.toLowerCase();
  const pred = reply.split("\n")[0].trim() === "CLEAN" ? "CLEAN" : "VIOLATION";
  let outcome;
  // respected = the HONEST specificity: did review avoid citing the SPECIFIC forbidden look-alike
  // (the Not-when this case is a negative for)? A whole-corpus review legitimately flags a hard
  // negative's OTHER real violations — that is NOT an over-fire. Only citing a forbidden rule is.
  let respected = null;
  if (verdict === "CLEAN") {
    outcome = pred === "CLEAN" ? "TN" : "FP";
    respected = !anchors(label.forbidden_rules).some((r) => low.includes(r));
  } else if (pred === "CLEAN") {
    outcome = "FN";
  } else {
    const hit = anchors(label.must_mention).some((kw) => low.includes(kw));
    outcome = hit ? "TP" : "WRONG";
  }
  return { id, rule, verdict, pred, outcome, respected };
});

const excluded = rows.filter((r) => r.outcome === "ERR");
const scored = rows.filter((r) => r.outcome !== "ERR");
if (scored.length === 0) { console.error("no scorable replies (all excluded?)"); process.exit(1); }

const viol = scored.filter((r) => r.verdict === "VIOLATION");
const clean = scored.filter((r) => r.verdict === "CLEAN");
const n = (pred) => scored.filter(pred).length;
const tp = n((r) => r.outcome === "TP"), wrong = n((r) => r.outcome === "WRONG");
const tn = n((r) => r.outcome === "TN");
const pct = (a, b) => (b === 0 ? "  n/a" : `${((100 * a) / b).toFixed(0).padStart(3)}%`);

// Per-rule recall: a rule is caught in a run when outcome === TP (across every case sharing it).
const byRule = new Map();
for (const r of viol) {
  const e = byRule.get(r.rule) ?? { runs: 0, tp: 0 };
  e.runs++; if (r.outcome === "TP") e.tp++;
  byRule.set(r.rule, e);
}
// Per-case run-to-run stability: a case whose outcome varies across runs has no trustworthy rate.
const byCase = new Map();
for (const r of scored) {
  const e = byCase.get(r.id) ?? [];
  e.push(r.outcome); byCase.set(r.id, e);
}
const unstable = [];
for (const [id, outs] of byCase) {
  const tally = {};
  for (const o of outs) tally[o] = (tally[o] ?? 0) + 1;
  if (Math.max(...Object.values(tally)) < outs.length) unstable.push({ id, tally });
}

console.log(`scored ${scored.length} replies (${outFiles.length} found)` +
  (excluded.length ? `   EXCLUDED (non-answer): ${excluded.length}` : ""));

console.log("\n=== per-rule recall (VIOLATION cases) ===");
for (const [rule, e] of [...byRule].sort((a, b) => a[0].localeCompare(b[0])))
  console.log(`${pct(e.tp, e.runs)}  ${e.tp}/${e.runs}  ${rule}`);

const respected = clean.filter((r) => r.respected === true).length;

console.log("\n=== overall ===");
console.log(`violation-runs: ${viol.length}   clean-runs: ${clean.length}`);
console.log(`recall        (caught planted rule):        ${pct(tp, viol.length)}  ${tp}/${viol.length}`);
console.log(`wrong-flag    (fired, wrong rule):           ${wrong}/${viol.length}`);
console.log(`Not-when respect (didn't cite the forbidden  ${pct(respected, clean.length)}  ${respected}/${clean.length}`);
console.log(`                  look-alike — HONEST specificity)`);
console.log(`strict silence (said nothing at all —        ${pct(tn, clean.length)}  ${tn}/${clean.length}`);
console.log(`                crude, inflated by fixture impurity)`);

console.log("\n=== run-to-run stability ===");
if (unstable.length === 0) {
  console.log("all cases scored identically across runs (stable).");
} else {
  console.log("UNSTABLE (an averaged rate masks noise — read the per-case .out findings):");
  for (const u of unstable)
    console.log(`  ${u.id}  (${Object.entries(u.tally).map(([o, c]) => `${o}:${c}`).join(" ")})`);
}
