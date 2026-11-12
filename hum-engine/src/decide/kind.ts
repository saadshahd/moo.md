import { z } from "zod";
import type { Item } from "../adapter-api.ts";
import type { HumConfig } from "../config/schema.ts";
import { DATA_RULE, fenced } from "./prose.ts";

/** A template field naming the kind: a `Kind: <name>` line, or an issue form's `### Kind` heading over its value. */
const TEMPLATE_FIELD = /^(?:kind:[ \t]*(\S+)|#{1,6}[ \t]*kind[ \t]*\n+[ \t]*(\S+))/im;

/** The answer a model call gives when no kind fits. */
export const UNSURE = "unsure";

/** The kind an item names itself: a label the owner mapped to a kind or that is a kind's name, else its template field. */
export const declaredKind = (item: Pick<Item, "body" | "labels">, kinds: readonly string[], kindLabels: HumConfig["kindLabels"]): string | undefined => {
	const field = TEMPLATE_FIELD.exec(item.body);
	const named = [...(item.labels ?? []), field?.[1] ?? field?.[2]].flatMap((name) => (name === undefined ? [] : [name.toLowerCase()]));

	return named.map((name) => kindLabels[name] ?? name).find((name) => kinds.includes(name));
};

/** The cheap model call that picks a kind from the item's text, or says it is unsure. */
export const kindQuestion = (item: Pick<Item, "title" | "body">, { kinds, kindMeanings }: { readonly kinds: readonly string[]; readonly kindMeanings: Readonly<Record<string, string>> }) => ({
	boundary: "kind" as const,
	prompt: [
		`Pick the kind of this work item. Judge by the change the work makes, not by the area it touches. Answer ${UNSURE} when none fits or you cannot tell.`,
		kinds.map((kind) => `- ${kind}: ${kindMeanings[kind] ?? "no meaning given"}`).join("\n"),
		DATA_RULE,
		fenced("item", `${item.title}\n\n${item.body}`),
	].join("\n\n"),
	answer: z.strictObject({ kind: z.enum([...kinds, UNSURE]) }),
});

/** A change of the docs-only kind that touches a path outside its globs is not docs. */
export const doesLeaveDocs = (paths: readonly string[], { docsOnly }: Pick<HumConfig, "docsOnly">): boolean =>
	paths.some((path) => !docsOnly.paths.some((glob) => new Bun.Glob(glob).match(path)));
