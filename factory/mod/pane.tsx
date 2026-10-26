import type {
  ElementTable,
  EngineInterface,
  Register,
  RenderChildren,
} from "claude-code";
import { STUCK_LABEL, must, post, repoOf, type Actors, type Run } from "../lib/github.ts";
import { runner } from "../hooks/session.ts";
import { messageOf } from "../lib/errors.ts";
import { RULES_PATH, actorsOf, readRules, type Rules } from "../lib/rules.ts";
import { UNDO_LABEL, comments, readSnapshot, undone } from "../lib/snapshot.ts";
import { APPROVE, answerFor, answerTo, isApproval } from "../lib/wait.ts";
import {
  perPr,
  rows,
  tokens,
  undoIssue,
  type CallRow,
  type Rows,
  type StuckRow,
  type WaitRow,
} from "./rows.ts";

const PANE = "factory";
const PANE_COLUMNS = 72;
const READ_EVERY_MS = 60_000;

type Tab = "questions" | "plans" | "stuck" | "calls" | "cost";

type Read =
  | { kind: "unread" }
  | { kind: "none"; why: string }
  | { kind: "failed"; why: string }
  | { kind: "read"; repo: string; actors: Actors; rows: Rows };

let read: Read = { kind: "unread" };
let tab: Tab = "questions";
const noting = new Set<number>();

const picks = new Map<number, (string | undefined)[]>();

type QuestionKey = `${number}:${number}`;

const owning = new Set<QuestionKey>();
const planOpen = new Set<number>();

let busy: string | null = null;
let reading: Promise<void> | null = null;
let spinner: { cancel: () => void } | null = null;
let frame = 0;
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_MS = 80;
let ticking: { cancel: () => void } | null = null;

/** Reads GitHub once; a read already running is joined, never doubled. */
function refresh($: EngineInterface): Promise<void> {
  reading ??= (async () => {
    spin($);

    try {
      read = await readRows($);
    } catch (err) {
      read = {
        kind: "failed",
        why: messageOf(err),
      };
    }
  })().finally(() => {
    reading = null;
    spin($);
    $.ui.invalidate("ui.render");
  });

  return reading;
}

function spin($: EngineInterface) {
  if (busy === null && reading === null) {
    spinner?.cancel();
    spinner = null;

    return;
  }

  spinner ??= $.clock.every(FRAME_MS, () => {
    frame = (frame + 1) % FRAMES.length;
    $.ui.invalidate("ui.render");
  });
}

/**
 * Reads start only once the pane opens, never at session start: every factory run loads this
 * module too, and a timer in each would spend the user's GitHub calls.
 */
function keepReading($: EngineInterface) {
  ticking ??= $.clock.every(READ_EVERY_MS, () => void refresh($));
}

async function readRows($: EngineInterface): Promise<Read> {
  const run = runner($);
  const cwd = await $.session.cwd();

  let rules: Rules;

  try {
    rules = await readRules(run, cwd);
  } catch (err) {
    return {
      kind: "none",
      why: `${messageOf(err)}; /factory:setup writes ${RULES_PATH}`,
    };
  }

  const repo = await repoOf(run, cwd);
  const actors = actorsOf(rules, repo);

  return {
    kind: "read",
    repo,
    actors,
    rows: rows(await readSnapshot(run, repo, []), actors),
  };
}

async function act(
  $: EngineInterface,
  key: string,
  write: (run: Run, repo: string, actors: Actors) => Promise<void>,
) {
  if (read.kind !== "read" || busy !== null) return;
  busy = key;
  spin($);
  $.ui.invalidate("ui.render");

  try {
    await write(runner($), read.repo, read.actors);
  } catch (err) {
    $.ui.toast(`factory: ${messageOf(err)}`);
  }

  await refresh($);
  busy = null;
  spin($);
  $.ui.invalidate("ui.render");
}

async function undoCall($: EngineInterface, call: CallRow) {
  await act($, `undo-${call.callId}`, async (run, repo, actors) => {
    /** A second press, or another machine's, finds the first undo issue and opens none. */
    if (undone(await readSnapshot(run, repo, []), actors).has(call.callId))
      return;
    /** `gh issue create --label` fails on a label the repo lacks. */
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
  await act($, `note-${row.issue}`, async (run, repo) => {
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

async function answer(
  $: EngineInterface,
  w: WaitRow,
  qi: number,
  value: string,
  key: string,
) {
  owning.delete(`${w.waitId}:${qi}`);

  if (value.trim() === "") return redraw($, () => {});
  const got = picks.get(w.waitId) ?? w.wait.questions.map(() => undefined);

  got[qi] = value.trim();
  picks.set(w.waitId, got);
  const answers = got.flatMap((a) => (a === undefined ? [] : [a]));

  if (answers.length < w.wait.questions.length) return redraw($, () => {});
  picks.delete(w.waitId);
  await act($, key, async (run, repo, actors) => {
    /** An answer from another machine, or github.com, may have landed since the last read. */
    if (
      answerTo(await comments(run, repo, w.issue), actors, {
        id: w.waitId,
        c: w.wait,
      })
    ) {
      $.ui.toast(`factory: #${w.issue} was already answered`);

      return;
    }

    await post(run, repo, w.issue, answerFor(w.waitId, w.wait, answers));
  });
}

async function retry($: EngineInterface, row: StuckRow) {
  await act($, `retry-${row.issue}`, async (run, repo) => {
    await must(run, [
      "gh",
      "issue",
      "edit",
      String(row.issue),
      "--repo",
      repo,
      "--remove-label",
      STUCK_LABEL,
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
  keepReading($);

  try {
    const r = await $.ui.open({
      id: PANE,
      title: "factory",
      closeOnEscape: true,
      columns: PANE_COLUMNS,
    });

    if (!r.isPlaced) $.ui.toast(`factory: ${r.reason}`);
  } catch (err) {
    $.ui.toast(`factory: ${messageOf(err)}`);
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
    spinner?.cancel();
    spinner = null;

    return next(e);
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    /**
     * A reload of the module keeps the pane open but starts its state over, with nothing
     * reading. So the draw starts the read itself, once the draw ends.
     */
    if (ticking === null || (read.kind === "unread" && reading === null))
      $.clock.after(0, () => {
        keepReading($);

        if (read.kind === "unread") void refresh($);
      });
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
            {read.kind === "unread"
              ? `${FRAMES[frame]} reading GitHub`
              : read.why}
          </Text>
        </Box>
      );
    const r = read.rows;

    return (
      <Box flexDirection="column" width={width} paddingX={1}>
        {tabBar($, ui, r)}
        <Text dimColor>{"─".repeat(width - 2)}</Text>
        {r.truncated.length > 0 && (
          <Text color="warning">{`GitHub listed only part of: ${r.truncated.join(", ")}`}</Text>
        )}
        {tab === "questions" &&
          waitCards($, ui, r.questions, "no question waits for you")}
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

/** Drawn plain, since the user rules out bracketed buttons. */
function pill(
  ui: ElementTable,
  key: string,
  label: string,
  onPress: () => void,
  isMain = false,
) {
  const { Button, Text } = ui;
  const isBusy = busy === key;

  return (
    <Button plain key={key} label={label} onPress={onPress}>
      <Text
        bold
        dimColor={busy !== null && !isBusy}
        color={isMain ? "inverseText" : "suggestion"}
        backgroundColor={isMain ? "suggestion" : undefined}
      >
        {isBusy ? ` ${FRAMES[frame]} ${label} ` : ` ${label} `}
      </Text>
    </Button>
  );
}

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
  /** A surface with no text field gets no note button; a note can still go on github.com. */
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

function waitCards(
  $: EngineInterface,
  ui: ElementTable,
  waits: WaitRow[],
  none: string,
) {
  if (waits.length === 0) return empty(ui, none);

  return waits.map((w) => {
    const color = w.plan === null ? "claude" : "warning";

    return card(
      ui,
      color,
      w.wait.questions.map((q, qi) => questionBlock($, ui, w, qi, color)),
    );
  });
}

function questionBlock(
  $: EngineInterface,
  ui: ElementTable,
  w: WaitRow,
  qi: number,
  color: string,
) {
  const { Box, Text, Markdown } = ui;
  const Input = "Input" in ui ? ui.Input : null;
  const q = w.wait.questions[qi]!;
  const asksApproval = isApproval(q);
  const picked = picks.get(w.waitId)?.[qi];
  const own: QuestionKey = `${w.waitId}:${qi}`;
  const isOwning = owning.has(own);
  const isOpen = asksApproval && planOpen.has(w.waitId);

  return (
    <Box flexDirection="column" marginTop={qi === 0 ? 0 : 1}>
      {head(
        ui,
        asksApproval
          ? `#${w.issue}  ${w.title}`
          : qi === 0
            ? `#${w.issue}  ${q.question}`
            : q.question,
        color,
      )}
      <Text dimColor>{q.why}</Text>
      {foot(ui, [
        asksApproval &&
          pill(ui, `plan-${w.waitId}`, isOpen ? "▾ fold" : "▸ plan", () =>
            redraw($, () =>
              isOpen ? planOpen.delete(w.waitId) : planOpen.add(w.waitId),
            ),
          ),
        ...q.options.map((o, oi) =>
          pill(
            ui,
            `opt-${w.waitId}-${qi}-${oi}`,
            o,
            () => void answer($, w, qi, o, `opt-${w.waitId}-${qi}-${oi}`),
            picked === undefined ? asksApproval && o === APPROVE : picked === o,
          ),
        ),
        Input &&
          pill(
            ui,
            `own-${w.waitId}-${qi}`,
            isOwning ? "cancel" : "my own",
            () =>
              redraw($, () =>
                isOwning ? owning.delete(own) : owning.add(own),
              ),
          ),
      ])}
      {isOpen && (
        <Box marginTop={1}>
          <Markdown text={w.plan ?? ""} />
        </Box>
      )}
      {Input && isOwning && (
        <Input
          key={`own-text-${w.waitId}-${qi}`}
          placeholder="your answer"
          submitLabel="send"
          autoFocus
          onSubmit={(v: string) =>
            void answer($, w, qi, v, `own-${w.waitId}-${qi}`)
          }
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
        <Text>
          {c.picked}
          {c.others.length > 0 && <Text dimColor>{"  not "}</Text>}
          {c.others.length > 0 && (
            <Text strikethrough dimColor>
              {c.others.join(", ")}
            </Text>
          )}
        </Text>,
        <Text dimColor>{c.why}</Text>,
        foot(ui, [
          pill(ui, `undo-${c.callId}`, "undo", () => void undoCall($, c)),
        ]),
      ],
      `call-${c.callId}`,
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
