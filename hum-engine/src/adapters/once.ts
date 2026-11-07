import { createHash } from "node:crypto";
import type { Adapter, ThreadEntry } from "../adapter-api.ts";
import type { OpKeys } from "../state/ops.ts";

/** The run and attempt a write belongs to; with the item and the write itself they form its op key. */
export type CallScope = { readonly run: string; readonly attempt: number };

const holdsEntry = (thread: readonly ThreadEntry[], kind: ThreadEntry["kind"], text: string, option?: string): boolean =>
	thread.some((entry) => entry.kind === kind && entry.option === option && (entry.text === text || entry.text.startsWith(`${text}\n`)));

/**
 * E2: `comment`, `ask`, `decide` and `answer` do not retry (see `guarded`), so each runs under an op key. A key
 * left started by a crash is settled by reading the item's thread: when the entry is there, the write is skipped.
 * The same text written twice in one scope is one write.
 */
export const onceCalls = (adapter: Adapter, ops: OpKeys, scope: CallScope): Adapter => {
	const { workSource, questions, answers } = adapter;

	const once = (itemId: string, kind: ThreadEntry["kind"], text: string, option: string | undefined, run: () => Promise<void>) =>
		ops
			.once(
				{ itemId, ...scope, op: `${kind}:${createHash("sha256").update(`${option ?? ""}\u0000${text}`).digest("hex").slice(0, 16)}` },
				{
					holds: async () => (workSource ? holdsEntry((await workSource.read(itemId)).thread, kind, text, option) : false),
					run,
				},
			)
			.then(() => undefined);

	return {
		...adapter,
		workSource: workSource && { ...workSource, comment: (id, text) => once(id, "comment", text, undefined, () => workSource.comment(id, text)) },
		questions: questions && {
			ask: (id, question) => once(id, "question", question.text, undefined, () => questions.ask(id, question)),
			decide: (id, text) => once(id, "decision", text, undefined, () => questions.decide(id, text)),
		},
		answers: answers && { ...answers, answer: (id, answer) => once(id, "answer", answer.text, answer.option, () => answers.answer(id, answer)) },
	};
};
