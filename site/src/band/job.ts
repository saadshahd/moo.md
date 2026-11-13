/* The one job every band piece plays: the skills demo sessions' late fee on
   overdue invoices, read from the sessions as they were recorded, so a
   piece's words are the sessions' own. */
import { turns as offTurns } from "../demo/sessions/skills-off";
import { turns as onTurns } from "../demo/sessions/skills-on";

const fail = (why: string): never => {
  throw new Error(`band/job: ${why}`);
};
const sentences = (s: string) => s.match(/.*?[.!?](?=\s+[A-Z]|$)/g) ?? [s];

/* The last two lines of a preview's last block, less their shared indent. */
const glimpse = (preview: string) => {
  const lines = preview.split("\n\n").at(-1)!.split("\n").slice(-2);
  const indent = Math.min(...lines.map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
};

/* The job as you typed it, less the command and the skills named after it. */
export const job = onTurns[0].user
  .replace(/^\/\S+\s+/, "")
  .replace(/\s+\/\S+/g, "");

/* moo off: the first two sentences of the reply the agent gave without
   asking. */
export const alone = sentences(String(offTurns.at(-1)!.reply![0]))
  .slice(0, 2)
  .join("");

/* moo on: each question the session asked that had two answers, each with a
   preview. */
export const forks = onTurns
  .flatMap((t) => t.dialogs ?? [])
  .flatMap((d) => d.questions)
  .filter((q) => q.options.length === 2 && q.options.every((o) => o.preview))
  .map((q) => ({
    header: q.header,
    question: q.question,
    proposed: q.options.findIndex((o) => o.label.includes("(Recommended)")),
    options: q.options.map((o) => ({
      label: o.label,
      preview: glimpse(o.preview!),
      result: sentences(o.description)[0].trim(),
    })),
  }));
if (!forks.length)
  fail(
    "the moo-on session asks no question with two answers, each with a preview",
  );
const unproposed = forks.find((f) => f.proposed < 0);
if (unproposed)
  fail(`its question "${unproposed.header}" recommends neither answer`);

/* moo on, with the work done: the first question the run left for you, as
   tend's questions pane showed it, with its two answers. */
const pane =
  onTurns[0].panes?.questions?.body.flat() ??
  fail("the moo-on session's first turn has no questions pane");
const paneLabel = (id: string) =>
  (
    pane.find((c) => c.id === id) ?? fail(`its questions pane has no ${id}`)
  ).label.replace(/^[•◦]\s*/, "");
const answers = [paneLabel("answer:0:0"), paneLabel("answer:0:1")];
/* The answer you gave in the next turn: the one whose words before its colon
   start your reply. */
const reply = onTurns[1]?.user ?? fail("the moo-on session has no turn after the run");
const picked = answers.findIndex((a) => reply.startsWith(a.split(":")[0]));
if (picked < 0) fail(`its second turn, "${reply}", starts with neither answer`);
export const leftForYou = { title: paneLabel("title"), question: paneLabel("question:0"), answers, picked };
