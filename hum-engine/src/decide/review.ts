import type { Item } from "../adapter-api.ts";

/** The most of a branch's diff one prompt carries. */
export const DIFF_LIMIT = 100_000;

/**
 * What a fresh review run reads: the item as the owner asked it and the change's diff. It takes no thread, so the
 * author's plan, questions and answers never reach the reviewer.
 */
export const reviewInput = (item: Pick<Item, "id" | "title" | "body">, diff: string): string =>
	[`# Item ${item.id}: ${item.title}`, item.body.trim(), `## The change\n${diff.slice(0, DIFF_LIMIT)}`].join("\n\n");
