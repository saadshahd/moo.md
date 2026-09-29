import type { Register } from "claude-code";
import { update } from "claude-code";
import type { Chosen, Finding, Mark, Slop } from "../slop.d.ts";

// After a main-thread turn that edited repo-bound files, judge.sh judges them off the turn.
// A `slop N` button waits above the prompt. It opens a pane showing one finding at a time as the
// diff that fixes it, and the row turns into the accept, edit or reject choice for that finding: the
// row already holds the keys, which a pane opened from it would not get. Nothing here starts a turn.

const SLOP = { plugin: "hope", key: "slop" } as const;
const PANE = "slop";

const EMPTY: Slop = {
  findings: [],
  cursor: 0,
  marks: [],
  reviewing: false,
  editing: false,
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
 * change, a bare "-" or "+" being a blank line of it. Every other line after a header, a code fence
 * say, belongs to that finding and is dropped; before any header, a line is a finding of its text alone. */
export function parseFindings(stdout: string): Finding[] {
  const lines = stdout.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0 || lines[0].trim() === "CLEAN") return [];
  const found: Finding[] = [];
  for (const l of lines) {
    const last = found.at(-1);
    const m = HEADER.exec(l.trim());
    const d = /^\s*([-+])( |$)/.exec(l);
    if (m)
      found.push({
        file: m[1],
        line: Number(m[2]),
        rule: m[3],
        claim: m[4],
        before: [],
        after: [],
      });
    else if (!last?.file)
      found.push({ rule: "", claim: l.trim(), before: [], after: [] });
    else if (d)
      (d[1] === "-" ? last.before : last.after).push(l.slice(d[0].length));
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

/** A finding carries a change when it names a file and lines to take out or put in. */
export function hasChange(f: Finding): boolean {
  return !!f.file && f.before.length + f.after.length > 0;
}

/** `text` with the finding's change made: its "-" lines, found at its line or else in one place
 * anywhere, swapped for its "+" lines. Throws when they are in no place, or in several but its line. */
export function applyChange(text: string, f: Finding): string {
  const lines = text.split("\n");
  const at = (f.line ?? 1) - 1;
  const matches = (i: number) => f.before.every((b, j) => lines[i + j] === b);
  const starts = matches(at) ? [at] : lines.map((_, i) => i).filter(matches);
  if (starts.length !== 1)
    throw new Error(
      `${f.file}:${f.line}: the lines to replace are ${starts.length ? `in ${starts.length} places` : "not in the file"}`,
    );
  lines.splice(starts[0]!, f.before.length, ...f.after);
  return lines.join("\n");
}

/** The finding's change as one unified-diff hunk. */
export function hunk(f: Finding): string {
  const line = f.line ?? 1;
  return [
    `@@ -${line},${f.before.length} +${line},${f.after.length} @@`,
    ...f.before.map((l) => `-${l}`),
    ...f.after.map((l) => `+${l}`),
  ].join("\n");
}

/** The state after deciding the finding under the cursor. Past the last one, the review ends:
 * the findings for Claude wait for the hand-off and decided findings leave. An accepted or edited
 * finding's key is forgotten, so the same rule broken there again shows again; a rejected one
 * stays quiet. An accepted finding goes to Claude only when it carries no change to write. */
export function decide(s: Slop, mark: Mark): Slop {
  if (!s.findings[s.cursor]) return s;
  const marks = [...s.marks, mark];
  const cursor = s.cursor + 1;
  if (cursor < s.findings.length)
    return { ...s, cursor, marks, editing: false };
  const decided = marks.map((m, i) => ({ m, finding: s.findings[i]! }));
  const taken = decided.filter(({ m }) => m.kind !== "reject");
  const forget = new Set(taken.map(({ finding }) => findingKey(finding)));
  const chosen = decided.flatMap(({ m, finding }): Chosen[] => {
    if (m.kind === "edit") return [{ finding, note: m.note }];
    if (m.kind === "accept" && !hasChange(finding)) return [{ finding }];
    return [];
  });
  return {
    ...s,
    findings: [],
    cursor: 0,
    marks: [],
    reviewing: false,
    editing: false,
    chosen: [...s.chosen, ...chosen],
    seen: s.seen.filter((k) => !forget.has(k)),
  };
}

/** How the chosen findings read to Claude: each located, with the change the judge suggested and
 * the person's words over it when they edited it. */
export function handoff(chosen: Chosen[]): string {
  return [
    "Slop findings to fix:",
    ...chosen.flatMap(({ finding: f, note }) => [
      ...(f.file
        ? [
            `${f.file}:${f.line} — ${f.claim} (${f.rule})`,
            ...f.before.map((l) => `- ${l}`),
            ...f.after.map((l) => `+ ${l}`),
          ]
        : [f.claim]),
      ...(note
        ? [`The person's edit, which wins over the change above: ${note}`]
        : []),
    ]),
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

// The last decision ends the review: the pane closes, and when any finding waits for Claude the
// stem goes in the prompt box for the person to finish.
async function choose($: any, mark: Mark): Promise<void> {
  await change($, (s) => decide(s, mark));
  const s = await readSlop($);
  if (s.reviewing) return;
  await $.ui.close({ id: PANE });
  if (s.chosen.length) await $.prompt.fill({ text: FIX_STEM });
}

// A change the file no longer holds throws, and the finding stays under the cursor.
async function accept($: any): Promise<void> {
  const { findings, cursor } = await readSlop($);
  const f = findings[cursor];
  if (f && hasChange(f)) {
    const path = f.file!.startsWith("/")
      ? f.file!
      : `${await $.session.root()}/${f.file}`;
    await $.fs.write(path, applyChange(await $.fs.read(path), f));
  }
  await choose($, { kind: "accept" });
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
    const els = $.ui.resolve(e);
    const { Box, Text, Button } = els;
    // The mobile app draws no field, so there a finding offers no edit.
    const Input = "Input" in els ? els.Input : undefined;
    const count = (
      <Text dimColor>{`slop ${s.cursor + 1} of ${s.findings.length}`}</Text>
    );
    return (
      <Box flexDirection="column">
        {s.reviewing && s.editing && Input ? (
          <Box gap={1}>
            {count}
            <Input
              key="slop-note"
              label="edit ›"
              placeholder="what Claude should do instead; empty goes back"
              submitLabel="keep for Claude"
              autoFocus
              onSubmit={(v: string) =>
                loud(
                  $,
                  v.trim()
                    ? choose($, { kind: "edit", note: v.trim() })
                    : change($, (t) => ({ ...t, editing: false })),
                )
              }
            />
          </Box>
        ) : s.reviewing ? (
          <Box gap={1}>
            {count}
            <Button
              key="slop-accept"
              label="accept"
              autoFocus
              onPress={() => loud($, accept($))}
            />
            {Input ? (
              <Button
                key="slop-edit"
                label="edit"
                onPress={() =>
                  loud(
                    $,
                    change($, (t) => ({ ...t, editing: true })),
                  )
                }
              />
            ) : null}
            <Button
              key="slop-reject"
              label="reject"
              onPress={() => loud($, choose($, { kind: "reject" }))}
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
    if (e.id === PANE)
      await change($, (s) => ({ ...s, reviewing: false, editing: false }));
    return r;
  });

  // The finding under the cursor, whole: where it is, what is wrong, and the diff that fixes it.
  on("ui.render", { component: "Pane" }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const s = await readSlop($);
    const f = s.findings[s.cursor];
    const { Box, Text, Code } = $.ui.resolve(e);
    if (!f) return <Text dimColor>no findings left</Text>;
    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        <Text bold wrap="wrap">
          {f.file ? `${f.file}:${f.line}` : f.claim}
        </Text>
        {f.file ? <Text wrap="wrap">{f.claim}</Text> : null}
        {hasChange(f) ? (
          <Code key="slop-diff" format="diff" path={f.file} source={hunk(f)} />
        ) : null}
        {f.rule ? <Text dimColor>{f.rule}</Text> : null}
      </Box>
    );
  });
};
