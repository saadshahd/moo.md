// Replays a Claude Code session file into what focus mode's activity line and
// tool line show over time, by Claude Code 2.1.316's own rules where known:
// each assistant message offers its last tool's label (question, gerund
// description, or activity description), or the counted summary when that tool
// has none; a label offered under HOLD seconds after the shown one is dropped.
// The tool line follows every tool at once. Edit lines are
// split('\n') counts of new and old strings, failed calls too (gives +320 -29).
// Usage: node replay.mjs <session.jsonl> <cwd> [hold]
import { readFileSync } from "node:fs";
import { relative } from "node:path";
// gerund.mjs is Claude Code's own rule for turning a description into its
// activity line, copied from its bundle; it stays out of git (.gitignore).
import { l0s } from "./gerund.mjs";

const [file, cwd, holdArg] = process.argv.slice(2);
const HOLD = Number(holdArg ?? 5);
const recs = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const t = (r) => Date.parse(r.timestamp) / 1000;
const rel = (p) => (p.startsWith(cwd + "/") ? relative(cwd, p) : p);

const counts = { edit: 0, added: 0, removed: 0, search: 0, read: 0, other: 0, bash: 0 };
const kindOf = new Map();
let label = null; // { text, at } or { summary: true, at }
let detail = "";
const out = [];

// Claude Code writes each block of a message as its own record: a tool_use is
// the message's last when no later record of the same message holds one.
const toolMsgs = recs.filter((r) => r.type === "assistant" && r.message?.content?.some?.((c) => c.type === "tool_use"));
const laterInMessage = (r) => {
  const i = toolMsgs.indexOf(r);
  return i >= 0 && toolMsgs.slice(i + 1).some((x) => x.message.id === r.message.id);
};
const isCat = (cmd) => /^cat \S+$/.test(cmd.trim());
function summary(running) {
  const parts = [];
  const add = (verb, obj) => parts.push(parts.length ? `${verb} ${obj}` : `${verb[0].toUpperCase()}${verb.slice(1)} ${obj}`);
  const n = (k, one, many) => `**${counts[k]}** ${counts[k] === 1 ? one : many}`;
  if (counts.edit) add(running ? "editing" : "edited", `${n("edit", "file", "files")} +${counts.added} -${counts.removed}`);
  if (counts.search) add(running ? "searching for" : "searched for", n("search", "pattern", "patterns"));
  if (counts.read) add(running ? "reading" : "read", n("read", "file", "files"));
  if (counts.other) add(running ? "calling" : "called", n("other", "tool", "tools"));
  if (counts.bash) add(running ? "running" : "ran", `**${counts.bash}** shell ${counts.bash === 1 ? "command" : "commands"}`);
  return parts.join(", ") + (running ? "…" : "");
}
let move;
const emit = (at, why) =>
  out.push({ at, why, line: label?.summary ? summary(true) : label?.text ?? "", detail, ...(label?.summary && move ? { move } : {}) });

for (const r of recs) {
  if (!r.timestamp) continue;
  const at = t(r);
  const content = r.message?.content;
  if (!Array.isArray(content)) continue;
  for (const c of content) {
    if (r.type === "assistant" && c.type === "tool_use") {
      const i = c.input ?? {};
      let kind, cand, det;
      switch (c.name) {
        case "Bash":
          kind = isCat(i.command) ? "read" : "bash";
          cand = l0s(i.description ?? "")?.running ?? i.description ?? "";
          det = `$ ${i.command}`;
          break;
        case "Read":
          kind = "read"; cand = `Reading ${rel(i.file_path)}`; det = rel(i.file_path); break;
        case "Edit": case "MultiEdit":
          kind = "edit"; cand = `Editing ${rel(i.file_path)}`;
          counts.added += (i.new_string ?? "").split("\n").length;
          counts.removed += (i.old_string ?? "").split("\n").length;
          break;
        case "Write":
          kind = "edit"; cand = `Writing ${rel(i.file_path)}`;
          counts.added += (i.content ?? "").split("\n").length;
          break;
        case "Grep": case "Glob":
          kind = "search"; cand = `Searching for ${i.pattern}`; det = `"${i.pattern}"`; break;
        case "AskUserQuestion":
          kind = "other"; cand = i.questions?.[0]?.question ?? ""; break;
        case "Skill":
          kind = "other"; cand = ""; move = i.skill; break;
        default:
          kind = "other"; cand = "";
      }
      kindOf.set(c.id, kind);
      counts[kind]++;
      if (det !== undefined) detail = det;
      const last = content.filter((x) => x.type === "tool_use").at(-1) === c &&
        !laterInMessage(r);
      if (last) {
        if (!cand) label = { summary: true, at };
        else if (!label || label.summary || at - label.at >= HOLD) label = { text: cand, at };
      }
      emit(at, `${c.name} ${c.id.slice(-6)}`);
    }
  }
}
const sent = t(recs.find((r) => r.type === "user" && typeof r.message?.content === "string"));
console.log(JSON.stringify({ sent, final: summary(false).replace(/\*\*/g, ""), states: out }, null, 1));
