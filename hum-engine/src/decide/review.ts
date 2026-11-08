import type { Item } from "../adapter-api.ts";
import type { HumConfig } from "../config/schema.ts";
import { DATA_RULE, fenced } from "./prose.ts";

/**
 * What a fresh review run reads: the item as the owner asked it and the change's diff. It takes no thread, so the
 * author's plan, questions and answers never reach the reviewer.
 */
export const reviewInput = (item: Pick<Item, "id" | "title" | "body">, diff: string, { diffLimit }: Pick<HumConfig, "diffLimit">): string =>
	[`# Item ${item.id}: ${item.title}`, DATA_RULE, fenced("item", item.body.trim()), `## The change`, fenced("diff", diff.slice(0, diffLimit))].join("\n\n");
