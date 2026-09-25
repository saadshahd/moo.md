import type { Register } from "claude-code";
import { update } from "claude-code";
import type { Finding, Slop } from "../slop.d.ts";

// After a main-thread turn that edited repo-bound files, judge.sh judges them off the turn.
// A `slop N` button waits above the prompt. It opens a pane listing every finding as the change
// that fixes it, and the row turns into the fix-or-skip choice for one finding at a time: the row
// already holds the keys, which a pane opened from it would not get. Nothing here starts a turn.

const SLOP = { plugin: "hope", key: "slop" } as const;
const PANE = "slop";

const EMPTY: Slop = {
  findings: [],
  cursor: 0,
  marks: [],
  reviewing: false,
  chosen: [],
  seen: [],
  offset: 0,
};

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export const FIX_STEM = "Fix the slop findings ";

// ---- pure ----

type Message = {
  role: string;
  toolUses?: {
    tool: string;
    input: Record<string, unknown>;
    isError?: true;
  }[];
};

/** The files the messages from `offset` on edited, each once. A refused or failed edit
 * changed nothing, so it names no file. */
export function touchedFiles(messages: Message[], offset: number): string[] {
  const paths = messages.slice(offset).flatMap((m) =>
    m.role === "assistant"
      ? (m.toolUses ?? []).flatMap((u) => {
          const p = u.input.file_path ?? u.input.notebook_path;
          return EDIT_TOOLS.has(u.tool) && !u.isError && typeof p === "string"
            ? [p]
            : [];
        })
      : [],
  );
  return [...new Set(paths)];
}

const HEADER = /^(.+?):(\d+) \| (.+?) \| (.+)$/;

/** judge.sh's output as findings: none when it printed nothing or CLEAN first. A header
 * "<file>:<line> | <rule> | <claim>" starts a finding and the "- " / "+ " lines after it are its
 * change; any other line is a finding of its own text alone. */
export function parseFindings(stdout: string): Finding[] {
  const lines = stdout.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0 || lines[0].trim() === "CLEAN") return [];
  const found: Finding[] = [];
  for (const l of lines) {
    const last = found.at(-1);
    const m = HEADER.exec(l.trim());
    if (m)
      found.push({
        file: m[1],
        line: Number(m[2]),
        rule: m[3],
        claim: m[4],
        before: [],
        after: [],
      });
    else if (last?.file && /^[-+] /.test(l))
      (l[0] === "-" ? last.before : last.after).push(l.slice(2));
    else found.push({ rule: "", claim: l.trim(), before: [], after: [] });
  }
  return found;
}

/** One key per rule on a file, so the judge rewording a rule between turns keys it the same:
 * lowercased, parentheticals and a leading "no " dropped. A finding with no file has no key. */
export function findingKey(f: Finding): string | undefined {
  if (!f.file) return undefined;
  return `${f.file}|${f.rule}`
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\|no /, "|")
    .replace(/[^a-z0-9|/._-]/g, "");
}

/** The findings not shown before, and the seen keys with theirs added. A keyless one always shows. */
export function freshFindings(
  found: Finding[],
  seen: string[],
): { fresh: Finding[]; seen: string[] } {
  const known = new Set(seen);
  const fresh = found.filter((f) => {
    const k = findingKey(f);
    if (k === undefined) return true;
    if (known.has(k)) return false;
    known.add(k);
    return true;
  });
  return { fresh, seen: [...known] };
}

/** A git status line keeps a file when it is tracked: not untracked (??), not ignored (!!). */
export function isRepoBound(status: string): boolean {
  return !status.startsWith("??") && !status.startsWith("!!");
}

/** The state after deciding the finding under the cursor. Past the last one, the review ends:
 * the fixes chosen wait for the hand-off and decided findings leave. A fixed finding's key is
 * forgotten, so the same rule broken there again shows again; a skipped one stays quiet. */
export function decide(s: Slop, mark: "fix" | "skip"): Slop {
  if (!s.findings[s.cursor]) return s;
  const marks = [...s.marks, mark];
  const cursor = s.cursor + 1;
  if (cursor < s.findings.length) return { ...s, cursor, marks };
  const fixed = s.findings.filter((_, i) => marks[i] === "fix");
  const forget = new Set(fixed.map(findingKey));
  return {
    ...s,
    findings: [],
    cursor: 0,
    marks: [],
    reviewing: false,
    chosen: [...s.chosen, ...fixed],
    seen: s.seen.filter((k) => !forget.has(k)),
  };
}

/** How the chosen findings read to Claude: each located, with the change the judge suggested. */
export function handoff(chosen: Finding[]): string {
  return [
    "Slop findings to fix:",
    ...chosen.flatMap((f) =>
      f.file
        ? [
            `${f.file}:${f.line} — ${f.claim} (${f.rule})`,
            ...f.before.map((l) => `- ${l}`),
            ...f.after.map((l) => `+ ${l}`),
          ]
        : [f.claim],
    ),
  ].join("\n");
}

// ---- effects ----

async function readSlop($: any): Promise<Slop> {
  const { value } = await $.state.get(SLOP);
  return { ...EMPTY, ...value };
}

function change($: any, fn: (s: Slop) => Slop): Promise<unknown> {
  return update($, SLOP, (s: Slop | undefined) => fn({ ...EMPTY, ...s }));
}

async function repoBound($: any, files: string[]): Promise<string[]> {
  const kept = await Promise.all(
    files.map(async (f) => {
      const dir = f.slice(0, f.lastIndexOf("/")) || "/";
      const r = await $.process
        .run([
          "git",
          "-C",
          dir,
          "status",
          "--porcelain",
          "--ignored=matching",
          "--",
          f,
        ])
        .catch(() => undefined);
      // No git, or no worktree holds the file: out.
      return r && r.exitCode === 0 && isRepoBound(r.stdout) ? f : undefined;
    }),
  );
  return kept.filter((f): f is string => f !== undefined);
}

async function judge($: any, files: string[]): Promise<void> {
  const r = await $.process.run([`${$.plugin.root}/hooks/judge.sh`], {
    cwd: await $.session.root(),
    stdin: files.join("\n") + "\n",
    timeoutMs: 600_000,
  });
  if (r.exitCode !== 0) {
    const why = `judge.sh exited ${r.exitCode}: ${r.stderr.trim().split("\n")[0].slice(0, 200)}`;
    // The same failure shows once a session, not on every edit turn.
    const { seen } = await readSlop($);
    if (seen.includes(`error|${why}`)) return;
    await change($, (s) => ({ ...s, seen: [...s.seen, `error|${why}`] }));
    throw new Error(why);
  }
  const found = parseFindings(r.stdout);
  if (found.length === 0) return;
  await change($, (s) => {
    const { fresh, seen } = freshFindings(found, s.seen);
    return { ...s, seen, findings: [...s.findings, ...fresh] };
  });
}

export async function afterTurn($: any): Promise<void> {
  const messages = await $.session.messages();
  const { offset } = await readSlop($);
  await change($, (s) => ({ ...s, offset: messages.length }));
  const files = await repoBound($, touchedFiles(messages, offset));
  if (files.length) await judge($, files);
}

async function openReview($: any): Promise<void> {
  await change($, (s) => ({ ...s, reviewing: true }));
  const r = await $.ui.open({ id: PANE, title: "slop", closeOnEscape: true });
  if (!r.isPlaced) {
    await change($, (s) => ({ ...s, reviewing: false }));
    $.ui.toast(`hope slop: ${r.reason}`);
  }
}

// The last decision ends the review: the pane closes, and when any fix was chosen the stem goes
// in the prompt box for the person to finish.
async function choose($: any, mark: "fix" | "skip"): Promise<void> {
  await change($, (s) => decide(s, mark));
  const s = await readSlop($);
  if (s.reviewing) return;
  await $.ui.close({ id: PANE });
  if (s.chosen.length) await $.prompt.fill({ text: FIX_STEM });
}

// A failure shows as a toast; the session goes on (hooks fail open).
function loud($: any, work: Promise<unknown>): void {
  work.catch((err) => $.ui.toast(`hope slop: ${err?.message ?? err}`));
}

// ---- hooks ----

export const register: Register = (on) => {
  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    // The judge runs past this dispatch, so the turn's end is never held.
    if (!e.agentId) loud($, afterTurn($));
    return r;
  });

  // The chosen findings reach Claude only with the person's own sentence, on their Enter.
  on("prompt.submit", async ($, e, next) => {
    const s = await readSlop($);
    if (!s.chosen.length || !e.text.startsWith(FIX_STEM.trim())) return next(e);
    await change($, (t) => ({ ...t, chosen: [] }));
    return next({ ...e, context: [...(e.context ?? []), handoff(s.chosen)] });
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const below = await next(e);
    if (e.props.hasSurvey) return below;
    const s = await readSlop($);
    if (s.findings.length === 0) return below;
    const { Box, Text, Button } = $.ui.resolve(e);
    return (
      <Box flexDirection="column">
        {s.reviewing ? (
          <Box gap={1}>
            <Text
              dimColor
            >{`slop ${s.cursor + 1} of ${s.findings.length}`}</Text>
            <Button
              key="slop-fix"
              label="fix"
              autoFocus
              onPress={() => loud($, choose($, "fix"))}
            />
            <Button
              key="slop-skip"
              label="skip"
              onPress={() => loud($, choose($, "skip"))}
            />
          </Box>
        ) : (
          <Button
            key="slop-open"
            label={`slop ${s.findings.length}`}
            onPress={() => loud($, openReview($))}
          />
        )}
        {below}
      </Box>
    );
  });

  // Closing the pane ends the review; the undecided findings wait for the next one.
  on("ui.close", async ($, e, next) => {
    const r = await next(e);
    if (e.id === PANE) await change($, (s) => ({ ...s, reviewing: false }));
    return r;
  });

  // Every finding as the change that fixes it: the one asked about is marked, decided ones say how.
  on("ui.render", { component: "Pane" }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const s = await readSlop($);
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        {s.findings.map((f, i) => {
          const mark = s.marks[i];
          const here = i === s.cursor;
          return (
            <Box key={`slop-${i}`} flexDirection="column">
              <Text bold={here} dimColor={!here}>
                {`${here ? "›" : mark === "fix" ? "✓" : mark === "skip" ? "–" : " "} ${f.file ? `${f.file}:${f.line}` : f.claim}`}
              </Text>
              {f.file ? (
                <Text dimColor wrap="wrap">{`  ${f.claim}`}</Text>
              ) : null}
              {f.before.map((l, j) => (
                <Text
                  key={`slop-${i}-b${j}`}
                  color="red"
                  wrap="truncate-end"
                >{`  - ${l}`}</Text>
              ))}
              {f.after.map((l, j) => (
                <Text
                  key={`slop-${i}-a${j}`}
                  color="green"
                  wrap="truncate-end"
                >{`  + ${l}`}</Text>
              ))}
              {f.rule ? <Text dimColor>{`  ${f.rule}`}</Text> : null}
            </Box>
          );
        })}
      </Box>
    );
  });
};
