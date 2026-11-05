// tend's band and pane as they stood at each moment of a recorded session, by
// tend's own functions: the hooks' order replayed over the session's text.
// Usage: tsx card.mts <in.json> → JSON on stdout.
// In: one entry per turn, in order: whether tend ran (a turn recorded with moo
// off ran none), whether the user typed its prompt (a task notification's
// isn't), each assistant text block it wrote, and its final visible text
// (turn.complete's `answer`).
// Out: per turn, the chips' labels while it ran and once it ended, the pane
// each chip opens once it ended, as tend's Pane render builds it, and the key
// tend files the reply's short form under (none: tend ran no turn).
import { readFileSync } from "node:fs";
// No package.json above hunch's hooks names them modules, so tsx loads them as
// CommonJS: their exports come as one default object.
import tend from "../../hunch/hooks/tend.tsx";
import type { Band } from "../../hunch/hooks/band.tsx";
import type { Card, Question } from "../../hunch/hooks/tend.tsx";

type In = { tend: boolean; composer: boolean; texts: string[]; answer: string };
const turns: In[] = JSON.parse(readFileSync(process.argv[2], "utf8"));

const labels = (card: Card) => tend.bandModel(card, null).chips.map((c: { label: string }) => c.label);
/** tend's Pane render: a title row with its close item, a blank row, the card's rows. */
const pane = (card: Card, name: string): Band => ({
  chips: [],
  body: [
    [
      { id: "title", label: name, kind: "title" },
      { id: "close", label: "close", kind: "line" },
    ],
    [],
    ...tend.cardRows(card, name),
  ],
});

const msgs: { role: string; text: string }[] = [];
let card: Card = {};
let open: Question[] | undefined;
const out = turns.map((t) => {
  // A turn with moo off adds to the session's messages and nothing else.
  if (!t.tend) {
    msgs.push(...t.texts.map((text) => ({ role: "assistant", text })));
    return { during: labels(card), after: labels(card), panes: {}, short: null };
  }
  // prompt.submit: the user's own prompt closes every open question.
  if (t.composer) {
    open = [];
    card = tend.withOpen(card, open);
  }
  const during = labels(card);
  msgs.push(...t.texts.map((text) => ({ role: "assistant", text })));
  // turn.complete: the card read back, then the questions the answer leaves open.
  card = tend.withOpen(tend.latestCard(msgs), open);
  open = tend.turnQuestions(t.answer, card.questions ?? []);
  card = tend.withOpen(card, open);
  const after = labels(card);
  const panes = Object.fromEntries(
    tend.bandModel(card, null).chips.map((c: { id: string }) => {
      const name = c.id.replace(/^chip:/, "");
      return [name, pane(card, name)];
    }),
  );
  return { during, after, panes, short: tend.textKey(tend.stripCards(t.answer)) };
});
process.stdout.write(JSON.stringify(out));
