import type { ElementTable, EngineInterface, Register, RenderChildren } from "claude-code";
import { APPROVE, parseApprovalQuestion } from "../lib/formats.ts";
import { comments, must, post, repoOf, type Run } from "../lib/github.ts";
import { RULES_PATH } from "../lib/rules.ts";
import { answerTo } from "../lib/wait.ts";
import {
  QUERY,
  STUCK_LABEL,
  UNDO_LABEL,
  perPr,
  rows,
  tokens,
  undoIssue,
  undone,
  type CallRow,
  type Rows,
  type Snapshot,
  type StuckRow,
  type WaitRow,
} from "./rows.ts";

// /factory: what a run needs from you, read from GitHub alone. Nothing reads GitHub until the
// pane opens, since every factory run loads this module too; while open it reads once a minute.

const PANE = "factory";
const PANE_COLUMNS = 72;
const READ_EVERY_MS = 60_000;

type Tab = "questions" | "plans" | "stuck" | "calls" | "cost";

type Read =
  | { kind: "unread" }
  | { kind: "none"; why: string }
  | { kind: "failed"; why: string }
  | { kind: "read"; repo: string; rows: Rows };

let read: Read = { kind: "unread" };
let tab: Tab = "questions";
const noting = new Set<number>();

// Picks for a wait with several questions, by wait id, until the last one is picked.
const picks = new Map<number, (string | undefined)[]>();

// The questions whose "my own" field is open, as `<wait id>:<question index>`.
const owning = new Set<string>();
const planOpen = new Set<number>();
let ticking: { cancel: () => void } | null = null;

const runner =
  ($: EngineInterface): Run =>
  (argv, opts) =>
    $.process.run(argv, {
      cwd: opts?.cwd,
      stdin: opts?.stdin,
      timeoutMs: 60_000,
    });

async function refresh($: EngineInterface): Promise<void> {
  try {
    read = await readRows($);
  } catch (err) {
    read = { kind: "failed", why: err instanceof Error ? err.message : String(err) };
  }

  $.ui.invalidate("ui.render");
}

async function readRows($: EngineInterface): Promise<Read> {
  const run = runner($);
  const cwd = await $.session.cwd();

  if ((await run(["test", "-f", RULES_PATH], { cwd })).exitCode !== 0)
    return {
      kind: "none",
      why: `no ${RULES_PATH} here; /factory:setup writes it`,
    };
  const repo = await repoOf(run, cwd);
  const [owner, name] = repo.split("/");

  const out = await must(run, [
    "gh",
    "api",
    "graphql",
    "-f",
    `query=${QUERY}`,
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
  ]);

  // SAFETY: gh prints GitHub's answer to QUERY, whose shape Snapshot spells out.
  return { kind: "read", repo, rows: rows(JSON.parse(out) as Snapshot) };
}

/** Runs a press's GitHub write, says what failed, and reads again so the rows show the change. */
async function act(
  $: EngineInterface,
  write: (run: Run, repo: string) => Promise<void>,
) {
  if (read.kind !== "read") return;

  try {
    await write(runner($), read.repo);
  } catch (err) {
    $.ui.toast(`factory: ${err instanceof Error ? err.message : String(err)}`);
  }

  await refresh($);
}

async function undoCall($: EngineInterface, call: CallRow) {
  await act($, async (run, repo) => {
    // Safe to repeat, and first: listing by a label that does not exist yet fails.
    await must(run, [
      "gh",
      "label",
      "create",
      UNDO_LABEL,
      "--repo",
      repo,
      "--force",
      "--color",
      "5319E7",
      "--description",
      "Reverses a call a factory run made",
    ]);

    // A second press, or another machine's, finds the first undo issue and opens none.
    const out = await must(run, [
      "gh",
      "issue",
      "list",
      "--repo",
      repo,
      "--label",
      UNDO_LABEL,
      "--state",
      "all",
      "--limit",
      "200",
      "--json",
      "body",
      "--jq",
      ".[].body",
    ]);

    if (undone(out.split("\n")).has(call.id)) return;
    const { title, body } = undoIssue(call);

    await must(run, [
      "gh",
      "issue",
      "create",
      "--repo",
      repo,
      "--title",
      title,
      "--body",
      body,
      "--label",
      UNDO_LABEL,
    ]);
    $.ui.toast(`factory: opened an issue to undo "${call.choice}"`);
  });
}

async function note($: EngineInterface, row: StuckRow, text: string) {
  noting.delete(row.issue);

  if (text.trim() === "") return;
  await act($, async (run, repo) => {
    await must(run, [
      "gh",
      "issue",
      "comment",
      String(row.issue),
      "--repo",
      repo,
      "--body",
      text,
    ]);
  });
}

/** Takes one question's answer; the answer comment goes up once every question has one. */
async function answer($: EngineInterface, w: WaitRow, qi: number, value: string) {
  owning.delete(`${w.id}:${qi}`);

  if (value.trim() === "") return redraw($, () => {});
  const got = picks.get(w.id) ?? w.questions.map(() => undefined);

  got[qi] = value.trim();
  picks.set(w.id, got);
  const answers = got.flatMap((a) => (a === undefined ? [] : [a]));

  if (answers.length < w.questions.length) return redraw($, () => {});
  picks.delete(w.id);
  await act($, async (run, repo) => {
    // An answer from another machine, or github.com, may have landed since the last read.
    if (answerTo(await comments(run, repo, w.issue), w.id, w.questions.length, () => true)) {
      $.ui.toast(`factory: #${w.issue} was already answered`);

      return;
    }

    await post(run, repo, w.issue, { kind: "answer", issue: w.issue, wait: w.id, answers });
  });
}

async function retry($: EngineInterface, row: StuckRow) {
  await act($, async (run, repo) => {
    await must(run, [
      "gh", "issue", "edit", String(row.issue), "--repo", repo, "--remove-label", STUCK_LABEL,
    ]);
  });
}

async function openUrl($: EngineInterface, url: string) {
  const r = await $.process.run(["open", url]);

  if (r.exitCode !== 0) $.ui.toast(`factory: can't open ${url}`);
}

function redraw($: EngineInterface, change: () => void) {
  change();
  $.ui.invalidate("ui.render");
}

async function show($: EngineInterface) {
  void refresh($);
  ticking?.cancel();
  ticking = $.clock.every(READ_EVERY_MS, () => void refresh($));

  try {
    const r = await $.ui.open({
      id: PANE,
      title: "factory",
      closeOnEscape: true,
      columns: PANE_COLUMNS,
    });

    if (!r.isPlaced) $.ui.toast(`factory: ${r.reason}`);
  } catch (err) {
    $.ui.toast(`factory: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const registerPane: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "factory",
      description:
        "What the factory needs from you: questions, plans, stuck runs, calls, cost per merged PR",
      immediate: true,
    });

    return next(e);
  });

  on("command.run", { command: "factory" }, async ($) => {
    await show($);

    return { text: "" };
  });

  on("ui.close", { id: PANE }, async ($, e, next) => {
    ticking?.cancel();
    ticking = null;

    return next(e);
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e);
    const { Box, Text } = ui;
    const width = Math.max(PANE_COLUMNS - 2, (e.viewport?.columns ?? 80) - 2);

    if (read.kind !== "read")
      return (
        <Box flexDirection="column" width={width} paddingX={1}>
          <Text
            dimColor={read.kind !== "failed"}
            color={read.kind === "failed" ? "error" : undefined}
          >
            {read.kind === "unread" ? "reading GitHub…" : read.why}
          </Text>
        </Box>
      );
    const r = read.rows;

    return (
      <Box flexDirection="column" width={width} paddingX={1}>
        {tabBar($, ui, r)}
        <Text dimColor>{"─".repeat(width - 2)}</Text>
        {tab === "questions" && waitCards($, ui, r.questions, "no question waits for you")}
        {tab === "plans" && waitCards($, ui, r.plans, "no plan waits for you")}
        {tab === "stuck" && stuckCards($, ui, r.stuck)}
        {tab === "calls" && callCards($, ui, r.calls)}
        {tab === "cost" && costCard(ui, r)}
      </Box>
    );
  });
};

const TABS = [
  { name: "questions", color: "claude" },
  { name: "plans", color: "warning" },
  { name: "stuck", color: "error" },
  { name: "calls", color: "suggestion" },
] as const;

function tabBar($: EngineInterface, ui: ElementTable, r: Rows) {
  const { Box, Text, Button } = ui;
  const avg = perPr(r.costs);

  const tabButton = (name: Tab, color: string, unit: string, value: string) => {
    const isOn = tab === name;

    return (
      <Button
        plain
        key={`tab-${name}`}
        label={name}
        onPress={() => redraw($, () => (tab = name))}
      >
        <Text bold={isOn} color={isOn ? color : undefined} dimColor={!isOn}>
          {`${unit}(${value})`}
        </Text>
      </Button>
    );
  };

  return (
    <Box flexDirection="row" justifyContent="space-between" gap={4}>
      <Box flexDirection="row" gap={3}>
        {TABS.map((t) =>
          tabButton(t.name, t.color, t.name, String(r[t.name].length)),
        )}
      </Box>
      {tabButton(
        "cost",
        "success",
        "tokens/PR",
        avg === null ? "–" : tokens(avg),
      )}
    </Box>
  );
}

function card(
  ui: ElementTable,
  color: string,
  children: RenderChildren[],
  hoverKey?: string,
) {
  const { Box } = ui;

  return (
    <Box
      key={hoverKey}
      hover={hoverKey ? { borderColor: "suggestion" } : undefined}
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={2}
    >
      {children}
    </Box>
  );
}

function head(ui: ElementTable, title: string, color: string) {
  const { Text } = ui;

  return (
    <Text bold color={color} wrap="truncate-end">
      {title}
    </Text>
  );
}

/** A button drawn as a word in colour, never in brackets; the main one filled. */
function pill(
  ui: ElementTable,
  key: string,
  label: string,
  onPress: () => void,
  isMain = false,
) {
  const { Button, Text } = ui;

  return (
    <Button plain key={key} label={label} onPress={onPress}>
      <Text
        bold
        color={isMain ? "inverseText" : "suggestion"}
        backgroundColor={isMain ? "suggestion" : undefined}
      >{` ${label} `}</Text>
    </Button>
  );
}

/** A card's buttons, on the right, one row below what they act on. */
function foot(ui: ElementTable, buttons: RenderChildren[]) {
  const { Box } = ui;

  return (
    <Box flexDirection="row" justifyContent="flex-end" gap={1} marginTop={1}>
      {buttons}
    </Box>
  );
}

function empty(ui: ElementTable, text: string) {
  const { Text } = ui;

  return card(ui, "inactive", [<Text dimColor>{text}</Text>]);
}

function stuckCards($: EngineInterface, ui: ElementTable, stuck: StuckRow[]) {
  const { Text } = ui;
  // A surface with no text field gets no note button: the note goes on the issue on github.com.
  const Input = "Input" in ui ? ui.Input : null;

  if (stuck.length === 0) return empty(ui, "no run is stuck");

  return stuck.map((s) => {
    const isNoting = noting.has(s.issue);

    return card(ui, "error", [
      head(ui, `#${s.issue}  ${s.title}`, "error"),
      <Text>{s.reason}</Text>,
      foot(ui, [
        pill(ui, `open-${s.issue}`, "open", () => void openUrl($, s.url)),
        Input &&
          pill(ui, `note-${s.issue}`, isNoting ? "cancel" : "note", () =>
          redraw($, () =>
            isNoting ? noting.delete(s.issue) : noting.add(s.issue),
          ),
        ),
        pill(ui, `retry-${s.issue}`, "retry", () => void retry($, s), true),
      ]),
      Input && isNoting && (
        <Input
          key={`note-text-${s.issue}`}
          placeholder="what the next run should do"
          submitLabel="send"
          autoFocus
          onSubmit={(v: string) => void note($, s, v)}
        />
      ),
    ]);
  });
}

function waitCards($: EngineInterface, ui: ElementTable, waits: WaitRow[], none: string) {
  if (waits.length === 0) return empty(ui, none);

  return waits.map((w) => {
    const color = w.plan === null ? "claude" : "warning";

    return card(ui, color, w.questions.map((q, qi) => questionBlock($, ui, w, qi, color)));
  });
}

/** One question of a wait: what it asks, why, a button per choice, and room for your own words. */
function questionBlock($: EngineInterface, ui: ElementTable, w: WaitRow, qi: number, color: string) {
  const { Box, Text, Markdown } = ui;
  const Input = "Input" in ui ? ui.Input : null;
  const q = w.questions[qi]!;
  const isApproval = parseApprovalQuestion(q.question) !== null;
  const picked = picks.get(w.id)?.[qi];
  const own = `${w.id}:${qi}`;
  const isOwning = owning.has(own);
  const isOpen = isApproval && planOpen.has(w.id);

  return (
    <Box flexDirection="column" marginTop={qi === 0 ? 0 : 1}>
      {head(ui, isApproval ? `#${w.issue}  ${w.title}` : qi === 0 ? `#${w.issue}  ${q.question}` : q.question, color)}
      <Text dimColor>{q.why}</Text>
      {foot(ui, [
        isApproval &&
          pill(ui, `plan-${w.id}`, isOpen ? "▾ fold" : "▸ plan", () =>
            redraw($, () => (isOpen ? planOpen.delete(w.id) : planOpen.add(w.id))),
          ),
        ...q.options.map((o, oi) =>
          pill(
            ui,
            `opt-${w.id}-${qi}-${oi}`,
            o,
            () => void answer($, w, qi, o),
            picked === undefined ? isApproval && o === APPROVE : picked === o,
          ),
        ),
        Input &&
          pill(ui, `own-${w.id}-${qi}`, isOwning ? "cancel" : "my own", () =>
            redraw($, () => (isOwning ? owning.delete(own) : owning.add(own))),
          ),
      ])}
      {isOpen && (
        <Box marginTop={1}>
          <Markdown text={w.plan ?? ""} />
        </Box>
      )}
      {Input && isOwning && (
        <Input
          key={`own-text-${w.id}-${qi}`}
          placeholder="your answer"
          submitLabel="send"
          autoFocus
          onSubmit={(v: string) => void answer($, w, qi, v)}
        />
      )}
    </Box>
  );
}

function callCards($: EngineInterface, ui: ElementTable, calls: CallRow[]) {
  const { Text } = ui;

  if (calls.length === 0) return empty(ui, "no call to review");

  return calls.map((c) =>
    card(
      ui,
      "inactive",
      [
        head(ui, `#${c.issue}  ${c.choice}`, "suggestion"),
        <Text>{c.picked}</Text>,
        foot(ui, [pill(ui, `undo-${c.id}`, "undo", () => void undoCall($, c))]),
      ],
      `call-${c.id}`,
    ),
  );
}

function costCard(ui: ElementTable, r: Rows) {
  const { Box, Text } = ui;
  const avg = perPr(r.costs);

  if (avg === null) return empty(ui, "no factory PR has merged yet");
  const top = Math.max(...r.costs.map((c) => c.tokens));
  const room = 24;

  return card(ui, "success", [
    <Box marginBottom={1}>{head(ui, "tokens per merged PR", "success")}</Box>,
    <Box flexDirection="column">
      {r.costs.map((c) => (
        <Box flexDirection="row" gap={2}>
          <Text dimColor>{`#${c.pr}`.padEnd(6)}</Text>
          <Text color="success">
            {"█"
              .repeat(Math.max(1, Math.round((c.tokens / top) * room)))
              .padEnd(room)}
          </Text>
          <Text tabular>{c.tokens.toLocaleString("en-US").padStart(11)}</Text>
        </Box>
      ))}
    </Box>,
    <Box marginTop={1}>
      <Text
        dimColor
      >{`${r.costs.length} PRs · avg ${tokens(avg)} tokens`}</Text>
    </Box>,
  ]);
}
