import { parse, type Answer, type Question, type Wait } from "./formats.ts";
import { factoryComments, fromTrusted, latest, type Actors, type Comment } from "./github.ts";

export const APPROVE = "Approve";

/** The one question that asks for a plan's approval; the ask hook names its seal in `approves`. */
export const APPROVAL_QUESTION = "Approve the plan posted on this issue?";

export const isApproval = (q: Question) =>
  q.question.trim() === APPROVAL_QUESTION;

export function openWait(
  cs: readonly Comment[],
  a: Actors,
): { id: number; c: Wait } | null {
  const w = latest(cs, a, "wait");

  return w !== null && w.c.answers === null ? w : null;
}

/**
 * The trusted answer to `wait`: an answer comment naming it, or a plain comment after it when
 * the wait asks one question and that question is no approval. An approval needs an answer
 * comment, so a passing remark never approves a plan.
 */
export function answerTo(
  cs: readonly Comment[],
  a: Actors,
  wait: { id: number; c: Wait },
): { id: number; answers: string[]; approves: string | null } | null {
  const plain =
    wait.c.questions.length === 1 && !wait.c.questions.some(isApproval);

  for (const c of cs) {
    if (c.id <= wait.id || !fromTrusted(c, a)) continue;
    const f = parse(c.body);

    if (f?.kind === "answer" && f.wait === wait.id)
      return { id: c.id, answers: f.answers, approves: f.approves };

    if (f === null && plain)
      return { id: c.id, answers: [c.body.trim()], approves: null };
  }

  return null;
}

/** The answer comment a person posts to `wait`; picking Approve on its approval question approves its seal. */
export function answerFor(
  waitId: number,
  wait: Wait,
  answers: string[],
): Answer {
  const i = wait.questions.findIndex(isApproval);
  const picked = answers[i]?.trim().toLowerCase();

  return {
    kind: "answer",
    issue: wait.issue,
    wait: waitId,
    answers,
    approves: picked === APPROVE.toLowerCase() ? wait.approves : null,
  };
}

/** Whether a trusted person's answer approved this exact seal. */
export function approved(
  cs: readonly Comment[],
  a: Actors,
  seal: string,
): boolean {
  return cs.some((c) => {
    if (!fromTrusted(c, a)) return false;
    const f = parse(c.body);

    return f?.kind === "answer" && f.approves === seal;
  });
}

export function answerMessage(w: Wait, answers: readonly string[]): string {
  const lines = w.questions.map(
    (q, i) => `- ${q.question}\n  Answer: ${answers[i] ?? "(none)"}`,
  );

  return `Your questions on issue #${w.issue} were answered:\n\n${lines.join("\n")}\n\nGo on with the work.`;
}

/**
 * What trusted people said on the issue that is no factory comment and no answer to a wait:
 * an answer reaches the run as its next message, never as a note.
 */
export function notes(cs: readonly Comment[], a: Actors): Comment[] {
  const answered = new Set(
    factoryComments(cs, a).flatMap(({ id, c }) => {
      if (c.kind !== "wait") return [];
      const ans = answerTo(cs, a, { id, c });

      return ans ? [ans.id] : [];
    }),
  );

  return cs.filter(
    (c) => fromTrusted(c, a) && parse(c.body) === null && !answered.has(c.id),
  );
}
