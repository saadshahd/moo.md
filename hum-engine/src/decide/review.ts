import type { HumConfig } from "../config/schema.ts";
import { DATA_RULE, fenced } from "./prose.ts";

/**
 * What a fresh review run reads: the item as the owner asked it and the change's diff. It takes no thread, so the
 * author's plan, questions and answers never reach the reviewer.
 */
/** What a prompt quotes of an item: plain text, whatever its id's source. */
export type ItemText = { readonly id: string; readonly title: string; readonly body: string };

export const reviewInput = (item: ItemText, diff: string, { diffLimit }: Pick<HumConfig, "diffLimit">): string =>
	[`# Item ${item.id}: ${item.title}`, DATA_RULE, fenced("item", item.body.trim()), `## The change`, fenced("diff", diff.slice(0, diffLimit))].join("\n\n");
