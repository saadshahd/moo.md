import { displayId, FREE_ANSWER } from "../item.ts";
import type { Answering } from "./machine.ts";

/** An option that is a whole answer as filled; every other option opens a sentence the owner finishes. */
const WHOLE_ANSWERS: ReadonlySet<string> = new Set(["approve", "retry"]);

/** The words an open sentence starts with, per option; an option not listed starts with its own word. */
const OPEN_SENTENCES = new Map([["change", "change the plan so that "]]);

const sentenceOf = (option: string): string => (WHOLE_ANSWERS.has(option) ? option : (OPEN_SENTENCES.get(option) ?? `${option} `));

/** What pressing a question's button puts in the prompt, and the option the post will carry. */
export const answerOf = ({ item, word }: { readonly item: string; readonly word: string }): Answering => {
	const label = displayId(item);
	const opener = `${label}: `;
	const isFree = word === FREE_ANSWER;

	return {
		item,
		label,
		opener,
		filled: isFree ? opener : `${opener}${sentenceOf(word)}`,
		isOpen: !WHOLE_ANSWERS.has(word),
		option: isFree ? undefined : word,
	};
};
