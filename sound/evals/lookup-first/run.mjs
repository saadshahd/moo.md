#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, readdirSync, statSync, realpathSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn, execFileSync } from "child_process";
import { createHash } from "crypto";

const [model, trialsArg, set = "all", ...only] = process.argv.slice(2);
if (!model || !trialsArg) { console.error("usage: bun run.mjs <model> <trials> <dev|heldout|real|all> [id ...]"); process.exit(2); }
const trials = Number(trialsArg);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const load = (f) => JSON.parse(readFileSync(join(here, f), "utf8"));
const sha = (f) => createHash("sha256").update(readFileSync(join(here, f))).digest("hex").slice(0, 12);
const SPLITS = { dev: "cases.json", heldout: "heldout.json", real: "real.json" };
const cases = [
  ...Object.entries(SPLITS).flatMap(([sp, f]) => (set === "all" || set === sp ? load(f).map((c) => ({ ...c, split: sp })) : [])),
].filter((c) => !only.length || only.includes(c.id));

/** Same test as proseQuestions in hunch/hooks/tend.tsx, which cannot load outside its plugin: it imports react. */
export function proseQuestions(text) {
  const out = []; let fenced = false;
  for (const raw of text.split("\n")) {
    if (raw.trim().startsWith("```")) fenced = !fenced;
    const q = raw.trim().replace(/^(?:[-*+>]\s+|\d+[.)]\s+)+/, "");
    if (!fenced && q.endsWith("?")) out.push(q);
  }
  return out;
}

/**
 * A text heuristic, so spot-check replies: a question line, a `?` ending a sentence, or a request
 * phrase. `wide`, for should-ask cases, also counts handing the user an act.
 */
const REQUEST = /\b(i need (your|you to|more|at least|either|both|one of|these|this|that)|i('d| would) need|before i can|once you (answer|confirm|tell|pick|choose)|waiting for|please (confirm|choose|pick|answer)|which (one )?(do|would) you|point me (to|at)|give me (the|your)|tell me where|approve)\b/i;
const HANDED = /\b(you (will |may |might )?(need|have|must) to|(is|are) (still )?yours to|for you to|your (terminal|login)|run `?gh auth login|needs you|yourself|(leave|leaves|left) [^.]{0,30}to you|when you('ve| have) (finished|done|completed))/i;
export function turned(reply, wide) {
  const prose = reply.replace(/```[\s\S]*?```/g, "");
  return proseQuestions(reply).length > 0 || /\?(\*\*|_)?(\s|$)/.test(prose) || REQUEST.test(prose) || (wide && HANDED.test(prose));
}

const DISTRACTORS = {
  "README.md": "# Project\n\nNotes live in docs/. Nothing else to see here.\n",
  "notes/todo.md": "- tidy the changelog\n- rotate the staging key (done)\n",
};

/** Found by its opening text, not a line number, so an edit that moves lines cannot point a case at the wrong passage. */
function passage(skillFile, at) {
  const lines = readFileSync(skillFile, "utf8").split("\n");
  const i = lines.findIndex((l) => l.startsWith(at));
  if (i < 0) throw new Error(`passage not found in ${skillFile}: ${at}`);
  let j = i; while (j + 1 < lines.length && lines[j + 1].trim() !== "") j++;
  return { text: lines.slice(i, j + 1).join("\n"), line: i + 1 };
}

function skillFileOf(c) {
  const p = join(repoRoot, c.skill);
  return existsSync(join(p, "SKILL.md")) ? join(p, "SKILL.md") : p;
}

/** Writes are confined to the trial's dir, so the prompt names the one place outside the project a skill's page can go. */
function buildPrompt(c, scratch) {
  const where = `The project is the current directory. Outside it, you may write only under ${scratch}.`;
  if (!c.skill) return [where, c.request].join("\n\n");
  const file = skillFileOf(c);
  const parts = [`Read the skill at ${file} and follow it.`];
  if (c.at) parts.push(`You have reached this passage of it:\n${passage(file, c.at).text.replace(/^/gm, "> ")}`);
  parts.push(where, `The user's request: "${c.request}"`);
  return parts.join("\n\n");
}

function globToRe(g) {
  return new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.*/)?").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
}
function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

function runClaude(c, prompt, cwd, work, outFile) {
  /**
   * No settings, memory, plugins, MCP or hooks from this machine, and the default output style, so a
   * run measures the skill text alone; HOOK=1 adds the reach hook as hope ships it. The one Edit rule
   * covers every file-writing tool and refuses a write outside the trial's dir.
   */
  return new Promise((res) => {
    const args = ["-p", "--model", model, "--no-session-persistence",
      ...(process.env.EFFORT ? ["--effort", process.env.EFFORT] : []),
      "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
      "--settings", JSON.stringify({ disableAllHooks: !hookDir, outputStyle: "default" }),
      ...(hookDir ? ["--plugin-dir", hookDir] : []),
      "--output-format", "stream-json", "--verbose", "--add-dir", work,
      "--allowedTools", [`Read,Glob,Grep,Edit(/${work}/**)`, ...COMMANDS, ...(c.allow ?? [])].join(",")];
    const p = spawn("claude", args, { cwd, env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, ...c.env } });
    let out = ""; const t = setTimeout(() => p.kill(), 300000);
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => { clearTimeout(t); writeFileSync(outFile, out); res(out); });
    p.stdin.end(prompt);
  });
}

const COMMANDS = ["ls:*", "cat:*", "head:*", "tail:*", "wc:*", "grep:*", "env", "printenv:*", "git log:*", "git show:*", "git status:*", "git diff:*",
  "rm:*", "mkdir:*", "chmod:*", "./bin/*", "bin/*", "sh bin/*", "sh ./bin/*", "bash bin/*", "open:*"].map((p) => `Bash(${p})`);

function trace(out) {
  let reply = ""; const results = []; let init;
  for (const l of out.split("\n")) {
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.type === "system" && e.subtype === "init") init = e;
    if (e.type === "result") reply = e.result ?? "";
    if (e.type === "user" && Array.isArray(e.message?.content))
      for (const b of e.message.content) if (b.type === "tool_result")
        results.push(typeof b.content === "string" ? b.content : (b.content ?? []).map((x) => x.text ?? "").join("\n"));
  }
  return { reply, results, init };
}

function score(c, repo, work, t) {
  const x = c.expect, fails = [];
  const asked = turned(t.reply, x.asked === true);
  if (!t.reply) fails.push("no final reply");
  if (x.asked !== undefined && asked !== x.asked) fails.push(x.asked ? "did not ask" : "asked");
  for (const s of x.reply ?? []) if (!t.reply.includes(s)) fails.push(`reply lacks "${s}"`);
  if (x.replyAny && !x.replyAny.some((r) => new RegExp(r, "im").test(t.reply))) fails.push(`reply matches none of ${x.replyAny}`);
  for (const r of x.replyNot ?? []) if (new RegExp(r, "im").test(t.reply)) fails.push(`reply matches ${r}`);
  for (const s of x.looked ?? []) if (!t.results.some((r) => r.includes(s))) fails.push(`never reached "${s}"`);
  const files = walk(work);
  for (const g of x.present ?? []) if (!files.some((f) => globToRe(g).test(f) || globToRe(g).test(f.replace(/^repo\//, "")))) fails.push(`no file matches ${g}`);
  for (const a of x.absent ?? []) if (existsSync(join(repo, a))) fails.push(`${a} still exists`);
  return { pass: fails.length === 0, asked, fails };
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const runName = `${stamp}-${model}${process.env.HOOK === "1" ? "-hook" : ""}`;
mkdirSync(join(here, "runs", runName), { recursive: true });
const runDir = realpathSync(join(here, "runs", runName));
/** `open` succeeds and does nothing, so a page a skill opens for the user opens no window on this machine. */
const stubDir = join(runDir, "stub");
mkdirSync(stubDir); writeFileSync(join(stubDir, "open"), "#!/bin/sh\nexit 0\n"); chmodSync(join(stubDir, "open"), 0o755);
const git = (cwd, ...a) => execFileSync("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.invalid", ...a], { cwd, stdio: "ignore" });

/** The reach hook alone in a plugin of its own: hope's slop judge would spawn runs of its own after every edit turn. */
const hookDir = process.env.HOOK === "1" ? join(runDir, "hook-plugin") : undefined;
if (hookDir) {
  mkdirSync(join(hookDir, ".claude-plugin"), { recursive: true }); mkdirSync(join(hookDir, "hooks"));
  writeFileSync(join(hookDir, ".claude-plugin/plugin.json"), JSON.stringify({ name: "hope-reach", version: "0.0.0", description: "hope's reach hook alone" }));
  writeFileSync(join(hookDir, "hooks/hooks.json"), JSON.stringify({ modules: ["./reach.ts"] }));
  writeFileSync(join(hookDir, "hooks/reach.ts"), readFileSync(join(repoRoot, "hope/hooks/reach.ts")));
}

/** Two trials of one case never run at once: they would write the same page name. */
const jobs = cases.flatMap((c) => Array.from({ length: trials }, (_, n) => ({ c, n })));
const results = []; const running = new Set();
const take = () => { const i = jobs.findIndex((j) => !running.has(j.c.id)); return i < 0 ? undefined : jobs.splice(i, 1)[0]; };
async function worker() {
  while (jobs.length) {
    const job = take();
    if (!job) { await new Promise((r) => setTimeout(r, 1000)); continue; }
    const { c, n } = job; running.add(c.id);
    const work = join(runDir, `${c.id}-${n}`), repo = join(work, "repo"), scratch = join(work, "scratch");
    mkdirSync(repo, { recursive: true }); mkdirSync(scratch);
    for (const [f, body] of Object.entries({ ...DISTRACTORS, ...c.files })) {
      const p = resolve(repo, f); mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body); if (/(^|\/)bin\//.test(f)) chmodSync(p, 0o755);
    }
    git(repo, "init", "-q"); git(repo, "add", "-A"); git(repo, "commit", "-qm", "init");
    const prompt = buildPrompt(c, scratch);
    const leaks = [...(c.expect.reply ?? []), ...(c.expect.looked ?? [])].filter((s) => c.request.includes(s));
    if (leaks.length) throw new Error(`${c.id}: request carries its own answer ${leaks}`);
    writeFileSync(join(work, "prompt.txt"), prompt);
    const out = await runClaude(c, prompt, repo, work, join(work, "trace.jsonl"));
    const t = trace(out);
    const s = score(c, repo, work, t);
    writeFileSync(join(work, "reply.txt"), t.reply);
    running.delete(c.id);
    results.push({ id: c.id, split: c.split, label: c.label, scout: c.scout, disputed: !!c.disputed, n, ...s, plugins: (t.init?.plugins ?? []).filter((p) => p.path !== "builtin").length, style: t.init?.output_style });
    console.log(`${s.pass ? "PASS" : "FAIL"} ${c.id}#${n}${s.pass ? "" : "  " + s.fails.join("; ")}`);
  }
}
await Promise.all(Array.from({ length: Math.min(Number(process.env.JOBS ?? 6), jobs.length) }, worker));
writeFileSync(join(runDir, "results.json"), JSON.stringify({ model, trials, hook: !!hookDir, files: Object.fromEntries(Object.values(SPLITS).map((f) => [f, sha(f)])), results }, null, 2));

const cls = (r) => (r.label === "proceed" ? "should-proceed" : "should-ask");
const rate = (rs) => `${rs.filter((r) => r.pass).length}/${rs.length}`;
console.log("\n| split | class | pass |\n|---|---|---|");
for (const sp of Object.keys(SPLITS)) for (const k of ["should-proceed", "should-ask"]) {
  const rs = results.filter((r) => r.split === sp && cls(r) === k);
  if (rs.length) console.log(`| ${sp} | ${k} | ${rate(rs)} |`);
}
console.log(`| all | all | ${rate(results)} |`);
console.log(`| all | undisputed | ${rate(results.filter((r) => !r.disputed))} |`);
console.log("\n| case | label | scout | pass |\n|---|---|---|---|");
for (const id of [...new Set(results.map((r) => r.id))]) {
  const rs = results.filter((r) => r.id === id);
  console.log(`| ${id} | ${rs[0].label}${rs[0].disputed ? " (disputed)" : ""} | ${rs[0].scout} | ${rate(rs)} |`);
}
console.log(`\nisolation: non-builtin plugins in init = ${Math.max(...results.map((r) => r.plugins))}, styles = ${[...new Set(results.map((r) => r.style))]}, reach hook = ${hookDir ? "loaded" : "off"}`);
console.log(`run dir: ${runDir}`);
