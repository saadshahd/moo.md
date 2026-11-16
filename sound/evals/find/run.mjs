#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync, realpathSync, copyFileSync, chmodSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import { tmpdir } from "os";

const run = promisify(execFile);
const [model, trialsArg, ...only] = process.argv.slice(2);
if (!model || !trialsArg) { console.error("usage: bun run.mjs <model> <trials> [case-id ...]"); process.exit(2); }
const trials = Number(trialsArg);
const here = dirname(fileURLToPath(import.meta.url));
const soundDir = resolve(here, "../..");
const casesFile = readFileSync(join(here, "cases.json"), "utf8");
const cases = JSON.parse(casesFile).filter((c) => !only.length || only.includes(c.id));

const READ_ONLY_COMMANDS = ["gh api:*", "gh repo view:*", "gh search:*", "curl:*", "npm view:*", "npx skills find:*", "jq:*", "ls:*", "cat:*", "head:*", "tail:*", "grep:*", "wc:*", "date:*", "echo:*", "base64:*", "sort:*", "uniq:*", "cut:*", "tr:*", "cd:*", "which:*"];
const ALLOWED_TOOLS = ["Read", "Glob", "Grep", "Skill", "Agent", "WebSearch", "WebFetch", ...READ_ONLY_COMMANDS.map((c) => `Bash(${c})`)];
const FETCH_TOOLS = /^(WebSearch|WebFetch)$/;
const FETCH_COMMANDS = /\b(gh (api|repo view|search)|curl|npm view|npx skills find)\b/;

const REGISTRY_URL = {
  npm: (n) => `https://registry.npmjs.org/${n.replace("/", "%2F")}`,
  pypi: (n) => `https://pypi.org/pypi/${n}/json`,
  crates: (n) => `https://crates.io/api/v1/crates/${n}`,
};
const PICK_LINE = /^\s*\d+\.\s+`([^`]+)`/gm;
const PACKAGE_LINE = /^\s*Package:\s*(npm|pypi|crates):(@[\w.-]+\/[\w.-]+|[\w.-]+)/gm;
const MEMORY_LINE = /^Memory pick:\s*`([^`]+)`\s*[—-]\s*(kept|rejected)\s*(?:\(([^)]*)\))?/im;
const SKILL_FIND = /(^|:)find$/;
const DENIED = /requires approval|permission to use|was denied|has been denied/i;
const SHIM_REFUSED = /read-only shim:|^Exit code 126\b/m;
const TOOLS_LINE = /^\s*(?:[-*]\s+)?(.+?):\s+use\s+`?([\w.-]+\/[\w.-]+)`?;\s+run\s+(.+?)\s+first\s*$/;
const UNATTENDED_UNSAFE = /\b(npx|curl|wget|sh|bash)\b|\|/;
const AUTHOR_VERDICT = /rule 4:\s*(pass|fail)/i;

const memo = (fn) => { const seen = new Map(); return (k) => (seen.has(k) ? seen.get(k) : (seen.set(k, fn(k)), seen.get(k))); };
const CHECK_ATTEMPTS = 4;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A name fails its check only on a 404. Any other answer (a rate limit, a network error) is retried and then
 * reported as unchecked, so a flaky check never reads as a missing name.
 */
async function check(attempt) {
  for (let i = 1; i <= CHECK_ATTEMPTS; i++) {
    const status = await attempt();
    if (status === "exists" || status === "missing") return status;
    await pause(2000 * i);
  }
  return "unchecked";
}
const repoStatus = memo((repo) => check(() => run("gh", ["api", `repos/${repo}`]).then(() => "exists", (e) => (/HTTP 404/.test(`${e.stderr}${e.stdout}`) ? "missing" : "error"))));
const packageStatus = memo((key) => {
  const [registry, name] = key.split(/:(.*)/s);
  return check(() => fetch(REGISTRY_URL[registry](name), { headers: { "User-Agent": "sound-find-eval" } }).then((r) => (r.ok ? "exists" : r.status === 404 ? "missing" : "error"), () => "error"));
});

function parse(reply) {
  const text = reply.replace(/\*\*/g, "");
  return {
    picks: [...text.matchAll(PICK_LINE)].map((m) => m[1]),
    packages: [...text.matchAll(PACKAGE_LINE)].map((m) => `${m[1]}:${m[2]}`),
    memory: text.match(MEMORY_LINE),
  };
}

async function registryChecks({ picks, packages }) {
  const lookups = [...picks.filter((p) => /^[\w.-]+\/[\w.-]+$/.test(p)).map((r) => [r, repoStatus(r)]), ...packages.map((p) => [p, packageStatus(p)])];
  const checked = await Promise.all(lookups.map(async ([name, status]) => [name, await status]));
  const namesWith = (wanted) => checked.filter(([, s]) => s === wanted).map(([name]) => name);
  return { failures: namesWith("missing"), unchecked: namesWith("unchecked") };
}

function trace(out) {
  const t = { reply: "", cost: 0, turns: 0, calls: [], results: [], init: undefined };
  for (const line of out.split("\n")) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "system" && e.subtype === "init") t.init = e;
    if (e.type === "result") { t.reply = e.result ?? ""; t.cost = e.total_cost_usd ?? 0; t.turns = e.num_turns ?? 0; }
    const blocks = Array.isArray(e.message?.content) ? e.message.content : [];
    if (e.type === "assistant") t.calls.push(...blocks.filter((b) => b.type === "tool_use"));
    if (e.type === "user") t.results.push(...blocks.filter((b) => b.type === "tool_result").map((b) => (typeof b.content === "string" ? b.content : (b.content ?? []).map((x) => x.text ?? "").join("\n"))));
  }
  return t;
}

const firedFind = (t) => t.calls.some((c) => c.name === "Skill" && SKILL_FIND.test(c.input?.skill ?? ""));
const fetchedAnything = (t) => t.calls.some((c) => FETCH_TOOLS.test(c.name) || (c.name === "Bash" && FETCH_COMMANDS.test(c.input?.command ?? "")));
const fetchedTarget = (t, target) => [...t.calls.map((c) => JSON.stringify(c.input)), ...t.results].some((s) => s.toLowerCase().includes(target.toLowerCase()));
const pickedTarget = (picks, target) => picks.some((p) => p.toLowerCase() === target.toLowerCase());

const SCORERS = {
  stack: async (c, t, p, repo) => {
    const lines = await toolsBlock(repo);
    const parsedLines = lines.map((l) => l.match(TOOLS_LINE));
    const changed = await changedPaths(repo);
    const wellFormed = parsedLines.length >= c.expect.minLines && parsedLines.every(Boolean);
    const gapLines = parsedLines.filter(Boolean).length;
    const unattendedSafe = parsedLines.filter(Boolean).every((m) => !UNATTENDED_UNSAFE.test(m[3]));
    const onlyClaudeMd = changed.length > 0 && changed.every((f) => f === "CLAUDE.md");
    const toolNames = parsedLines.filter(Boolean).map((m) => m[2]);
    return { pass: wellFormed && unattendedSafe && onlyClaudeMd, wellFormed, unattendedSafe, onlyClaudeMd, toolNames, gapLines };
  },
  pick: (c, t) => {
    const surfaced = c.expect.surfaced.every((s) => t.reply.toLowerCase().includes(s.toLowerCase()));
    return { pass: surfaced, fired: firedFind(t), viaFind: firedFind(t) && surfaced };
  },
  quiet: (c, t) => ({ pass: !firedFind(t) && !fetchedAnything(t), fired: firedFind(t), fetched: fetchedAnything(t) }),
  gate: (c, t, p) => {
    const verdict = p.memory?.[2];
    const kept = verdict?.toLowerCase() === "kept";
    const picked = pickedTarget(p.picks, c.expect.target) || kept;
    const author = t.reply.match(AUTHOR_VERDICT)?.[1].toLowerCase();
    const authorPassed = author ? author === "pass" : null;
    return { pass: picked === c.expect.picked, picked, memoryLineParsed: p.memory !== null, fetchedTarget: fetchedTarget(t, c.expect.target), authorPassed, authorAsExpected: authorPassed === null ? null : authorPassed === (c.expect.author === "pass") };
  },
};

async function toolsBlock(repo) {
  const text = await Bun.file(join(repo, "CLAUDE.md")).text().catch(() => "");
  const block = text.split(/^## Tools\s*$/m)[1] ?? "";
  return block.split(/^## /m)[0].split("\n").filter((l) => l.trim());
}
const changedPaths = async (repo) => (await git(repo, "status", "--porcelain")).stdout.split("\n").filter(Boolean).map((l) => l.slice(3));

const PROMPTS = {
  stack: () => "/sound:stack",
  pick: (c) => c.need,
  quiet: (c) => c.need,
  gate: (c) => `Use the sound:find skill.\n\nNeed: ${c.need}\nMemory pick: ${c.memoryPick}\n\nJudge rule 4 for the memory pick even when another rule fails, and end the Memory pick line with "rule 4: pass" or "rule 4: fail".`,
};

function runClaude(prompt, cwd, outFile) {
  /**
   * The sound plugin loads as shipped, skills on, so the run shows whether find's description fires on its own.
   * Nothing from this machine reaches the run: no user settings, memory, MCP or hooks. The project source stays
   * so a fixture's CLAUDE.md loads as it would in a real repo. Network tools are read-only commands plus web
   * search and fetch; installs and shell pipes into interpreters are refused by omission. gh and curl resolve to
   * the read-only shim: the run holds this machine's GitHub login and reads text it did not write.
   */
  return new Promise((res) => {
    const args = ["-p", "--model", model, "--no-session-persistence", "--max-budget-usd", process.env.BUDGET ?? "2",
      ...(process.env.EFFORT ? ["--effort", process.env.EFFORT] : []),
      "--setting-sources", "project", "--strict-mcp-config",
      "--settings", JSON.stringify({ disableAllHooks: true, outputStyle: "default" }),
      "--plugin-dir", soundDir,
      "--output-format", "stream-json", "--verbose",
      "--allowedTools", [...ALLOWED_TOOLS, `Edit(/${cwd}/**)`].join(",")];
    const p = spawn("claude", args, { cwd, env: { ...process.env, REAL_PATH: process.env.PATH, PATH: `${shimDir}:${process.env.PATH}` } });
    let out = ""; const timer = setTimeout(() => p.kill(), 600000);
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => { clearTimeout(timer); writeFileSync(outFile, out); res(out); });
    p.stdin.end(prompt);
  });
}

const git = (cwd, ...a) => run("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.invalid", ...a], { cwd });
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const runName = `${stamp}-${model}`;
const runDir = (() => { const d = join(here, "runs", runName); mkdirSync(d, { recursive: true }); return realpathSync(d); })();

/**
 * Trial projects live outside this repo: a project directory inside it would load this repo's CLAUDE.md
 * files, walking up from the working directory.
 */
const workRoot = (() => { const d = join(tmpdir(), "sound-find-eval", runName); mkdirSync(d, { recursive: true }); return realpathSync(d); })();

const isolation = (init) => ({
  foreignPlugins: (init?.plugins ?? []).map((p) => p.name).filter((n) => n !== "sound" && !n.startsWith("cc-plugin-")),
  foreignPluginSkills: (init?.skills ?? []).filter((s) => s.includes(":") && !s.startsWith("sound:")),
});

const shimDir = join(runDir, "shim");
mkdirSync(shimDir);
for (const tool of ["gh", "curl"]) { copyFileSync(join(here, "readonly-shim.sh"), join(shimDir, tool)); chmodSync(join(shimDir, tool), 0o755); }

const jobs = cases.flatMap((c) => Array.from({ length: trials }, (_, n) => ({ c, n })));
const results = [];
async function worker() {
  while (jobs.length) {
    const { c, n } = jobs.shift();
    const out = join(runDir, `${c.id}-${n}`);
    const repo = join(workRoot, `${c.id}-${n}`);
    mkdirSync(out, { recursive: true }); mkdirSync(repo, { recursive: true });
    for (const [f, body] of Object.entries(c.files)) { const p = resolve(repo, f); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); }
    await git(repo, "init", "-q"); await git(repo, "add", "-A"); await git(repo, "commit", "-qm", "init");
    const prompt = PROMPTS[c.kind](c);
    writeFileSync(join(out, "prompt.txt"), prompt);
    const t = trace(await runClaude(prompt, repo, join(out, "trace.jsonl")));
    const parsed = parse(t.reply);
    const scored = await SCORERS[c.kind](c, t, parsed, repo);
    const isFindOutput = scored.fired || c.kind === "gate" || c.kind === "stack";
    const { failures, unchecked } = isFindOutput ? await registryChecks({ ...parsed, picks: scored.toolNames ?? parsed.picks }) : { failures: [], unchecked: [] };
    writeFileSync(join(out, "reply.txt"), t.reply);
    results.push({ id: c.id, kind: c.kind, n, ...scored, registryFailures: failures, registryUnchecked: unchecked, names: scored.toolNames ?? parsed.picks, cost: t.cost, turns: t.turns, denied: t.results.filter((r) => DENIED.test(r)).length, shimRefused: t.results.filter((r) => SHIM_REFUSED.test(r)).length, ...isolation(t.init) });
    console.log(`${scored.pass ? "PASS" : "FAIL"} ${c.id}#${n} fired=${scored.fired ?? "-"} names=${parsed.picks.join(",") || "-"} regfail=${failures.join(",") || "-"} $${t.cost.toFixed(2)}`);
  }
}
await Promise.all(Array.from({ length: Math.min(Number(process.env.JOBS ?? 4), jobs.length) }, worker));
writeFileSync(join(runDir, "results.json"), JSON.stringify({ model, trials, cases: createHash("sha256").update(casesFile).digest("hex").slice(0, 12), results }, null, 2));

const count = (rs, f) => `${rs.filter(f).length}/${rs.length}`;
const byCase = (id) => results.filter((r) => r.id === id);
const ids = [...new Set(results.map((r) => r.id))];
console.log("\n| case | kind | pass | fired | registry fails | cost |\n|---|---|---|---|---|---|");
for (const id of ids) {
  const rs = byCase(id);
  console.log(`| ${id} | ${rs[0].kind} | ${count(rs, (r) => r.pass)} | ${rs[0].fired === undefined ? "-" : count(rs, (r) => r.fired)} | ${rs.flatMap((r) => r.registryFailures).length} | $${rs.reduce((s, r) => s + r.cost, 0).toFixed(2)} |`);
}
const ofKind = (k) => results.filter((r) => r.kind === k);
console.log(`\npick: surfaced ${count(ofKind("pick"), (r) => r.pass)}, fired ${count(ofKind("pick"), (r) => r.fired)}, surfaced via find ${count(ofKind("pick"), (r) => r.viaFind)}`);
console.log(`quiet: no find call and no fetch ${count(ofKind("quiet"), (r) => r.pass)}, no find call ${count(ofKind("quiet"), (r) => !r.fired)}`);
const gates = ofKind("gate");
const forAuthor = (verdict) => gates.filter((r) => cases.find((c) => c.id === r.id).expect.author === verdict);
console.log(`gate: expected verdict ${count(gates, (r) => r.pass)}; evidence fetched for the target ${count(gates, (r) => r.fetchedTarget)}; memory pick line in the template ${count(gates, (r) => r.memoryLineParsed)}`);
console.log(`author gate: passes where it should ${count(forAuthor("pass"), (r) => r.authorAsExpected)}, fails where it should ${count(forAuthor("fail"), (r) => r.authorAsExpected)}; line missing ${gates.filter((r) => r.authorPassed === null).length} of ${gates.length}`);
console.log(`stack: lines well formed ${count(ofKind("stack"), (r) => r.wellFormed)}, first commands safe to run unasked ${count(ofKind("stack"), (r) => r.unattendedSafe)}, only CLAUDE.md changed ${count(ofKind("stack"), (r) => r.onlyClaudeMd)}, lines written per run ${ofKind("stack").map((r) => r.gapLines)}`);
console.log(`harness: tool calls denied by the permission list ${results.reduce((s, r) => s + r.denied, 0)}, refused by the read-only shim ${results.reduce((s, r) => s + r.shimRefused, 0)}, across ${results.length} runs`);
console.log(`registry: names failing their registry check ${results.flatMap((r) => r.registryFailures).length}, checks that errored ${results.flatMap((r) => r.registryUnchecked).length}, across ${results.length} runs`);
console.log(`isolation: plugins besides sound and the built-in cc-plugin set = [${[...new Set(results.flatMap((r) => r.foreignPlugins))]}], skills from other plugins = [${[...new Set(results.flatMap((r) => r.foreignPluginSkills))]}]`);
console.log(`run dir: ${runDir}\ntrial projects: ${workRoot}`);
