import { createHash } from "node:crypto";
import type { Integrations, ItemId, ThreadEntry } from "../adapter-api.ts";
import type { OpKeys } from "../state/ops.ts";

/** The run and attempt a write belongs to; with the item and the write itself they form its op key. */
export type CallScope = { readonly run: string; readonly attempt: number };

const OP_HASH_LENGTH = 16;

type Entry = { readonly kind: ThreadEntry["kind"]; readonly text: string; readonly option?: string };

/** The same entry in the same scope is the same op, so writing it twice writes it once. */
const opName = ({ kind, text, option }: Entry): string => `${kind}:${createHash("sha256").update(`${option ?? ""}\u0000${text}`).digest("hex").slice(0, OP_HASH_LENGTH)}`;

/** Whether `thread` already holds `entry`; a provider may append its own lines after the text. */
const hasEntry = (thread: readonly ThreadEntry[], { kind, text, option }: Entry): boolean =>
	thread.some((found) => found.kind === kind && found.option === option && (found.text === text || found.text.startsWith(`${text}\n`)));

/**
 * `comment`, `ask`, `decide` and `answer` are never retried by the guard, so each runs under an op key. A key a
 * crash left started is settled by reading the item's thread: when the entry is there, the write is skipped.
 */
export const onceCalls = (adapter: Integrations, ops: OpKeys, scope: CallScope): Integrations => {
	const { workSource, questions, answers } = adapter;

	const once = async (itemId: ItemId, entry: Entry, write: () => Promise<void>): Promise<void> => {
		await ops.once(
			{ itemId, ...scope, op: opName(entry) },
			{ holds: async () => (workSource ? hasEntry((await workSource.read(itemId)).thread, entry) : false), run: write },
		);
	};

	return {
		...adapter,
		workSource: workSource && { ...workSource, comment: (id, text) => once(id, { kind: "comment", text }, () => workSource.comment(id, text)) },
		questions: questions && {
			ask: (id, question) => once(id, { kind: "question", text: question.text }, () => questions.ask(id, question)),
			decide: (id, text) => once(id, { kind: "decision", text }, () => questions.decide(id, text)),
		},
		answers: answers && {
			...answers,
			answer: (id, answer) => once(id, { kind: "answer", text: answer.text, option: answer.option }, () => answers.answer(id, answer)),
		},
	};
};
