import type {
  ElementTable,
  EngineInterface,
  Register,
  RenderChildren,
} from "claude-code";
import {
  STUCK_LABEL,
  must,
  post,
  repoOf,
  type Actors,
  type Run,
} from "../lib/github.ts";
import { runner } from "../hooks/session.ts";
import { messageOf } from "../lib/errors.ts";
import { RULES_PATH, actorsOf, readRules, type Rules } from "../lib/rules.ts";
import { UNDO_LABEL, comments, readSnapshot, undone } from "../lib/snapshot.ts";
import type { Question } from "../lib/formats.ts";
import { APPROVE, answerFor, answerTo, isApproval } from "../lib/wait.ts";
import {
  rows,
  tokens,
  undoIssue,
  type CallRow,
  type Rows,
  type WaitRow,
} from "./rows.ts";

const PANE = "factory";
const PANE_COLUMNS = 72;
const READ_EVERY_SECONDS = 20;
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_MS = 80;

type Tab = "questions" | "plans" | "held" | "stuck" | "calls" | "cost";

type Read =
  | { kind: "unread" }
  | { kind: "none"; why: string }
  | { kind: "failed"; why: string }
  | { kind: "read"; repo: string; actors: Actors; rows: Rows; everyMs: number };

let read: Read = { kind: "unread" };
let tab: Tab = "questions";

/** Keys of the toggle pills now open: a stuck note, a plan, an own answer. */
const open = new Set<string>();
const picks = new Map<number, (string | undefined)[]>();
let busy: string | null = null;
let reading: Promise<void> | null = null;
let spinner: { cancel: () => void } | null = null;
let ticking: { ms: number; timer: { cancel: () => void } } | null = null;
let frame = 0;

const draw = ($: EngineInterface) => $.ui.invalidate("ui.render");

/** Runs `gh` with `words` split on spaces, then each of `args` whole. */
async function gh(run: Run, words: string, ...args: string[]) {
  await must(run, ["gh", ...words.split(" "), ...args]);
}

/** Reads GitHub once; a read already running is joined, never doubled. */
function refresh($: EngineInterface): Promise<void> {
  reading ??= (async () => {
    spin($);

    try {
      read = await readRows($);
    } catch (err) {
      read = { kind: "failed", why: messageOf(err) };
    }
  })().finally(() => {
    reading = null;

    /** A changed `paneEverySeconds` takes hold at once; a closed pane stays without a timer. */
    if (ticking !== null) keepReading($);
    spin($);
    draw($);
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
    draw($);
  });
}

/**
 * Reads start only once the pane opens, never at session start: every factory run loads this
 * module too, and a timer in each would spend the user's GitHub calls.
 */
function keepReading($: EngineInterface) {
  const ms = read.kind === "read" ? read.everyMs : READ_EVERY_SECONDS * 1_000;

  if (ticking?.ms === ms) return;
  ticking?.timer.cancel();
  ticking = { ms, timer: $.clock.every(ms, () => void refresh($)) };
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
    everyMs: (rules.paneEverySeconds ?? READ_EVERY_SECONDS) * 1_000,
  };
}

function setBusy($: EngineInterface, key: string | null) {
  busy = key;
  spin($);
  draw($);
}

async function act(
  $: EngineInterface,
  key: string,
  write: (run: Run, repo: string, actors: Actors) => Promise<void>,
) {
  if (read.kind !== "read" || busy !== null) return;
  setBusy($, key);

  try {
    await write(runner($), read.repo, read.actors);
  } catch (err) {
    $.ui.toast(`factory: ${messageOf(err)}`);
  }

  await refresh($);
  setBusy($, null);
}

function undoCall($: EngineInterface, call: CallRow) {
  return act($, `undo-${call.callId}`, async (run, repo, actors) => {
    /** A second press, or another machine's, finds the first undo issue and opens none. */
    if (undone(await readSnapshot(run, repo, []), actors).has(call.callId))
      return;
    const { title, body } = undoIssue(call);

    /** `gh issue create --label` fails on a label the repo lacks. */
    await gh(
      run,
      `label create ${UNDO_LABEL} --repo ${repo} --force --color 5319E7 --description`,
      "Reverses a call a factory run made",
    );
    await gh(
      run,
      `issue create --repo ${repo} --label ${UNDO_LABEL} --title`,
      title,
      "--body",
      body,
    );
    $.ui.toast(`factory: opened an issue to undo "${call.choice}"`);
  });
}

async function answer(
  $: EngineInterface,
  w: WaitRow,
  qi: number,
  value: string,
  key: string,
) {
  open.delete(`own-${w.waitId}-${qi}`);
  const v = value.trim();

  if (v === "") return draw($);
  const got = picks.get(w.waitId) ?? [];

  got[qi] = v;
  picks.set(w.waitId, got);
  const answers = got.flatMap((a) => a ?? []);

  if (answers.length < w.wait.questions.length) return draw($);
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

async function openUrl($: EngineInterface, url: string) {
  const r = await $.process.run(["open", url]);

  if (r.exitCode !== 0) $.ui.toast(`factory: can't open ${url}`);
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
        "What the factory needs from you: questions, plans, held and stuck runs, calls, cost per merged PR",
      immediate: true,
    });

    return next(e);
  });

  on("command.run", { command: "factory" }, async ($) => {
    await show($);

    return { text: "" };
  });

  on("ui.close", { id: PANE }, async ($, e, next) => {
    ticking?.timer.cancel();
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

    return (
      <Box flexDirection="column" width={width} paddingX={1}>
        {read.kind === "read" ? (
          view($, ui, read.rows, width)
        ) : (
          <Text
            dimColor={read.kind !== "failed"}
            color={read.kind === "failed" ? "error" : undefined}
          >
            {read.kind === "unread"
              ? `${FRAMES[frame]} reading GitHub`
              : read.why}
          </Text>
        )}
      </Box>
    );
  });
};

const TABS = [
  { name: "questions", color: "claude" },
  { name: "plans", color: "warning" },
  { name: "held", color: "warning" },
  { name: "stuck", color: "error" },
  { name: "calls", color: "suggestion" },
] as const;

function view($: EngineInterface, ui: ElementTable, r: Rows, width: number) {
  const { Box, Text, Button, Markdown } = ui;

  /** A surface with no text field gets no typed answer or note; those can still go on github.com. */
  const Input = "Input" in ui ? ui.Input : null;

  const tabButton = (name: Tab, color: string, label: string) => (
    <Button
      plain
      key={`tab-${name}`}
      label={name}
      onPress={() => ((tab = name), draw($))}
    >
      <Text
        bold={tab === name}
        color={tab === name ? color : undefined}
        dimColor={tab !== name}
      >
        {label}
      </Text>
    </Button>
  );

  const card = (
    color: string,
    children: RenderChildren[],
    hoverKey?: string,
  ) => (
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

  const head = (title: string, color: string) => (
    <Text bold color={color} wrap="truncate-end">
      {title}
    </Text>
  );

  /** Drawn plain, since the user rules out bracketed buttons. */
  const pill = (
    key: string,
    label: string,
    onPress: () => void,
    isMain = false,
  ) => (
    <Button plain key={key} label={label} onPress={onPress}>
      <Text
        bold
        dimColor={busy !== null && busy !== key}
        color={isMain ? "inverseText" : "suggestion"}
        backgroundColor={isMain ? "suggestion" : undefined}
      >
        {busy === key ? ` ${FRAMES[frame]} ${label} ` : ` ${label} `}
      </Text>
    </Button>
  );

  const toggle = (key: string, shut: string, opened: string) =>
    pill(key, open.has(key) ? opened : shut, () => {
      if (!open.delete(key)) open.add(key);
      draw($);
    });

  const field = (
    key: string,
    placeholder: string,
    onSubmit: (v: string) => void,
  ) =>
    Input &&
    open.has(key) && (
      <Input
        key={`${key}-text`}
        placeholder={placeholder}
        submitLabel="send"
        autoFocus
        onSubmit={onSubmit}
      />
    );

  const foot = (buttons: RenderChildren[]) => (
    <Box flexDirection="row" justifyContent="flex-end" gap={1} marginTop={1}>
      {buttons}
    </Box>
  );

  const empty = (text: string) =>
    card("inactive", [<Text dimColor>{text}</Text>]);

  const question = (w: WaitRow, q: Question, qi: number, color: string) => {
    const asksApproval = isApproval(q);
    const picked = picks.get(w.waitId)?.[qi];
    const own = `own-${w.waitId}-${qi}`;

    return (
      <Box flexDirection="column" marginTop={qi === 0 ? 0 : 1}>
        {head(
          asksApproval
            ? `#${w.issue}  ${w.title}`
            : qi === 0
              ? `#${w.issue}  ${q.question}`
              : q.question,
          color,
        )}
        <Text dimColor>{q.why}</Text>
        {foot([
          asksApproval && toggle(`plan-${w.waitId}`, "▸ plan", "▾ fold"),
          ...q.options.map((o, oi) => {
            const key = `opt-${w.waitId}-${qi}-${oi}`;

            return pill(
              key,
              o,
              () => void answer($, w, qi, o, key),
              picked === undefined
                ? asksApproval && o === APPROVE
                : picked === o,
            );
          }),
          Input && toggle(own, "my own", "cancel"),
        ])}
        {asksApproval && open.has(`plan-${w.waitId}`) && (
          <Box marginTop={1}>
            <Markdown text={w.plan ?? ""} />
          </Box>
        )}
        {field(own, "your answer", (v) => void answer($, w, qi, v, own))}
      </Box>
    );
  };

  const waits = (ws: WaitRow[], none: string, color: string) =>
    ws.length === 0
      ? empty(none)
      : ws.map((w) =>
          card(
            color,
            w.wait.questions.map((q, qi) => question(w, q, qi, color)),
          ),
        );

  const cards: Record<Tab, () => RenderChildren> = {
    questions: () => waits(r.questions, "no question waits for you", "claude"),
    plans: () => waits(r.plans, "no plan waits for you", "warning"),
    held: () =>
      r.held.length === 0
        ? empty("nothing is held")
        : r.held.map((h) =>
            card("warning", [
              head(`#${h.issue}  ${h.title}`, "warning"),
              <Text>{h.line}</Text>,
              foot([pill(`open-held-${h.issue}`, "open", () => void openUrl($, h.url))]),
            ]),
          ),
    stuck: () =>
      r.stuck.length === 0
        ? empty("no run is stuck")
        : r.stuck.map((s) =>
            card("error", [
              head(`#${s.issue}  ${s.title}`, "error"),
              <Text>{s.reason}</Text>,
              foot([
                pill(`open-${s.issue}`, "open", () => void openUrl($, s.url)),
                Input && toggle(`note-${s.issue}`, "note", "cancel"),
                pill(
                  `retry-${s.issue}`,
                  "retry",
                  () =>
                    void act($, `retry-${s.issue}`, (run, repo) =>
                      gh(
                        run,
                        `issue edit ${s.issue} --repo ${repo} --remove-label ${STUCK_LABEL}`,
                      ),
                    ),
                  true,
                ),
              ]),
              field(
                `note-${s.issue}`,
                "what the next run should do",
                (text) => {
                  open.delete(`note-${s.issue}`);

                  if (text.trim() === "") draw($);
                  else
                    void act($, `note-${s.issue}`, (run, repo) =>
                      gh(
                        run,
                        `issue comment ${s.issue} --repo ${repo} --body`,
                        text,
                      ),
                    );
                },
              ),
            ]),
          ),
    calls: () =>
      r.calls.length === 0
        ? empty("no call to review")
        : r.calls.map((c) =>
            card(
              "inactive",
              [
                head(`#${c.issue}  ${c.choice}`, "suggestion"),
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
                foot([
                  pill(`undo-${c.callId}`, "undo", () => void undoCall($, c)),
                ]),
              ],
              `call-${c.callId}`,
            ),
          ),
    cost: () => {
      if (r.avg === null) return empty("no factory PR has merged yet");
      const top = Math.max(...r.costs.map((c) => c.tokens));
      const room = 24;

      return card("success", [
        <Box marginBottom={1}>{head("tokens per merged PR", "success")}</Box>,
        <Box flexDirection="column">
          {r.costs.map((c) => (
            <Box flexDirection="row" gap={2}>
              <Text dimColor>{`#${c.pr}`.padEnd(6)}</Text>
              <Text color="success">
                {"█"
                  .repeat(Math.max(1, Math.round((c.tokens / top) * room)))
                  .padEnd(room)}
              </Text>
              <Text tabular>
                {c.tokens.toLocaleString("en-US").padStart(11)}
              </Text>
            </Box>
          ))}
        </Box>,
        <Box marginTop={1}>
          <Text
            dimColor
          >{`${r.costs.length} PRs · avg ${tokens(r.avg)} tokens`}</Text>
        </Box>,
      ]);
    },
  };

  return [
    <Box flexDirection="row" justifyContent="space-between" gap={2}>
      <Box flexDirection="row" gap={2}>
        {TABS.map((t) =>
          tabButton(t.name, t.color, `${t.name}(${r[t.name].length})`),
        )}
      </Box>
      {tabButton(
        "cost",
        "success",
        `tokens/PR(${r.avg === null ? "–" : tokens(r.avg)})`,
      )}
    </Box>,
    <Text dimColor>{"─".repeat(width - 2)}</Text>,
    r.truncated.length > 0 && (
      <Text color="warning">{`GitHub listed only part of: ${r.truncated.join(", ")}`}</Text>
    ),
    cards[tab](),
  ];
}
