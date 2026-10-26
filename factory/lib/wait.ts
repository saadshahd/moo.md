// A run that asks waits on its issue with its turn ended. These read, from the issue's comments,
// whether it still waits and what the human answered.

import { APPROVE, parse, parseApprovalQuestion, type Wait } from "./formats.ts";
import { latest, trusted, type Comment } from "./github.ts";

/** The newest wait comment no one has answered yet, or null. */
export function openWait(
  cs: readonly Comment[],
): { id: number; c: Wait } | null {
  const w = latest(cs, "wait");

  return w !== null && w.c.answers === null ? w : null;
}

/**
 * The first answer to wait comment `waitId` by someone who may push to the repo: an answer comment naming it, or
 * a person's plain comment after it, which answers every question with its text.
 */
export function answerTo(
  cs: readonly Comment[],
  waitId: number,
  questions: number,
): { id: number; author: string; answers: string[] } | null {
  for (const c of cs) {
    if (c.id <= waitId || !trusted(c)) continue;
    const f = parse(c.body);

    if (f?.kind === "answer" && f.wait === waitId)
      return { id: c.id, author: c.author, answers: f.answers };

    if (f === null)
      return {
        id: c.id,
        author: c.author,
        answers: Array.from({ length: questions }, () => c.body.trim()),
      };
  }

  return null;
}

/** The seal prefix the answers approve, or null when they approve no plan. */
export function approvedSeal(
  w: Wait,
  answers: readonly string[],
): string | null {
  const i = w.questions.findIndex((q) => parseApprovalQuestion(q.question));
  const q = w.questions[i];
  const a = answers[i];

  return q !== undefined &&
    a !== undefined &&
    a.trim().toLowerCase() === APPROVE.toLowerCase()
    ? (parseApprovalQuestion(q.question)?.seal8 ?? null)
    : null;
}

/** What the waiting run reads as its next message. */
export function answerMessage(w: Wait, answers: readonly string[]): string {
  const lines = w.questions.map(
    (q, i) => `- ${q.question}\n  Answer: ${answers[i] ?? "(none)"}`,
  );

  return `Your questions on issue #${w.issue} were answered:\n\n${lines.join("\n")}\n\nGo on with the work.`;
}

/** The ids of the comments that answered a wait: they reached the run as its answer, never as a note. */
export function answerIds(cs: readonly Comment[]): Set<number> {
  return new Set(
    cs.flatMap((c) => {
      const w = parse(c.body);

      if (w?.kind !== "wait" || w.answers === null) return [];
      const a = answerTo(cs, c.id, w.questions.length);

      return a ? [a.id] : [];
    }),
  );
}
