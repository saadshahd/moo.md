import { z } from "zod";
import type { HumConfig } from "../config/schema.ts";
import type { PastChange } from "../decide/labels.ts";
import { type Label, LABELS } from "../decide/risk.ts";
import { brokenLabelOf } from "../loop/breaks.ts";
import { commitsOf, type Merge } from "../loop/records.ts";
import { foldItem, type Picked } from "../state/item-log.ts";
import type { State } from "../state/open.ts";

/** A case of the alignment call's set: what the change answers and its diff, labelled by what git later did to it. */
export const AlignmentCase = z.object({ case: z.string(), label: z.enum(LABELS), subject: z.string(), body: z.string().default(""), diff: z.string() });

/** A case of the review run's set: an item and the diff that answers it, labelled by the verdict it deserved. */
export const ReviewCase = z.object({ case: z.string(), label: z.string(), item: z.string(), body: z.string().default(""), diff: z.string() });

/** The judges whose sets a merged item joins: those that judge a change, each with the name its pick has in the item's log. */
const JUDGED = ["alignment", "review-verdict"] as const;

type Judged = (typeof JUDGED)[number];

const PICK_OF = { alignment: "alignment", "review-verdict": "review" } as const satisfies Record<Judged, Picked["judge"]>;

/** What a merged item gives the judges its change was put to: what they read, and the label git settled on the change. */
export const MergedCase = z.object({
	item: z.string().min(1),
	title: z.string(),
	body: z.string(),
	diff: z.string(),
	label: z.enum(LABELS),
	judges: z.array(z.enum(JUDGED)),
});

export type MergedCase = z.infer<typeof MergedCase>;

const casesFor =
	<C>(judge: Judged, asCase: (found: MergedCase) => C) =>
	(merged: readonly MergedCase[]): C[] =>
		merged.flatMap((found) => (found.judges.includes(judge) ? [asCase(found)] : []));

/** The merged items' cases of each judge's set, in its shape: the alignment call's take the change's label, the review run's approve for a clean change and request-changes for one reverted or fixed. */
export const MERGED_CASES = {
	alignment: casesFor("alignment", ({ item, title, body, diff, label }): z.input<typeof AlignmentCase> => ({ case: item, label, subject: title, body, diff })),
	"review-verdict": casesFor("review-verdict", ({ item, title, body, diff, label }): z.input<typeof ReviewCase> => ({ case: item, label: label === "clean" ? "approve" : "request-changes", item: title, body, diff })),
} as const satisfies Record<Judged, (merged: readonly MergedCase[]) => object[]>;

/** Where a merged item's text and its change's diff come from: the work source, and git. */
export type CaseSources = {
	readonly itemText: (item: string) => Promise<{ readonly title: string; readonly body: string } | undefined>;
	readonly diff: (from: string, to: string) => Promise<string>;
};

/**
 * A merged change's label once a fix can no longer change it: reverted or fixed as the loop saved it for any of its
 * commits, clean once `fixWindow` later changes on the base touched one of its paths; undefined before then, or where
 * the history no longer reaches the change.
 */
const settledLabel = (state: State, merge: Merge, changes: readonly PastChange[], fixWindow: number): Label | undefined => {
	const at = changes.findIndex(({ sha }) => sha === merge.sha);
	const touching = at === -1 ? [] : changes.slice(at + 1).filter(({ files }) => files.some((file) => merge.paths.includes(file)));

	return brokenLabelOf(state, merge) ?? (touching.length >= fixWindow ? "clean" : undefined);
};

/** The base's commit just before the change: walking back from its commit on the base, the first that is not one of its own. */
const baseBefore = (merge: Merge, changes: readonly PastChange[]): string | undefined => {
	const own = new Set(commitsOf(merge));
	const at = changes.findIndex(({ sha }) => sha === merge.sha);

	return at === -1 ? undefined : changes.slice(0, at).findLast(({ sha }) => !own.has(sha))?.sha;
};

/**
 * Keeps a case for each merged item whose change a judge was put to, once git settles its label; a case kept before
 * takes a label that changed since, as a later revert gives. The case holds the item's text and the base's diff across
 * the change, as much as a judge reads. An item the work source no longer gives, or a change whose base before it the
 * history no longer reaches, gives no case.
 */
export const keepMergedCases = async (state: State, changes: readonly PastChange[], { changeLabels, diffLimit }: Pick<HumConfig, "changeLabels" | "diffLimit">, sources: CaseSources): Promise<void> => {
	for (const merge of state.merges.list()) {
		const log = state.events.read(merge.item);
		const label = settledLabel(state, merge, changes, changeLabels.fixWindow);

		if (!log.ok || label === undefined) continue;

		const { picks } = foldItem(log.value);
		const judges = JUDGED.filter((judge) => picks[PICK_OF[judge]] !== undefined);

		if (judges.length === 0) continue;

		const kept = state.cases.get(merge.item);
		const from = baseBefore(merge, changes);

		if (kept !== undefined) {
			state.cases.put(merge.item, { ...kept, label, judges });
			continue;
		}

		const text = from === undefined ? undefined : await sources.itemText(merge.item);

		if (from !== undefined && text !== undefined) state.cases.put(merge.item, { item: merge.item, title: text.title, body: text.body, diff: (await sources.diff(from, merge.sha)).slice(0, diffLimit), label, judges });
	}
};
