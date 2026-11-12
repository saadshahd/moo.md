import type { Question } from "../../hum-engine/src/status/format.ts";

const ITEM_ID = /^\d+$/;

/** A numeric item id reads as an issue number. */
export const displayId = (item: string): string => (ITEM_ID.test(item) ? `#${item}` : item);

/** The button a question without options carries: it opens a free answer. */
export const FREE_ANSWER = "answer";

/** The words a question's buttons carry: its options, or one free answer. */
export const buttonWords = ({ options }: Pick<Question, "options">): readonly string[] => (options.length > 0 ? options : [FREE_ANSWER]);
