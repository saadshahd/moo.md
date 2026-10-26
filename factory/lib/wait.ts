
import { APPROVE, parse, parseApprovalQuestion, type Wait } from "./formats.ts";
import { latest, trusted, type Comment } from "./github.ts";

export function openWait(
  cs: readonly Comment[],
): { id: number; c: Wait } | null {
  const w = latest(cs, "wait");

  return w !== null && w.c.answers === null ? w : null;
}

/**
 * An answer comment naming the wait answers it question by question; a person's plain comment
 * after the wait answers every question with its text.
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
