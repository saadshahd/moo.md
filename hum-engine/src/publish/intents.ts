import { z } from "zod";
import type { FollowUp, ItemId } from "../adapter-api.ts";
import type { CallScope } from "../adapters/once.ts";
import { SplitPart } from "../decide/prose.ts";

const text = z.string().min(1);

const Scope = z.strictObject({ run: text, attempt: z.int().nonnegative() });

/** What a split part's follow-up carries besides its text: the parts it waits on, by their place among this pass's follow-ups from 1, and its check. */
const SplitFiling = SplitPart.pick({ waitsOn: true, check: true });

type SplitFiling = z.infer<typeof SplitFiling>;

/**
 * What a pass asks publish to do for its item, on the item's run branch. A pass never writes to the work source, the
 * questions, GitHub or the remote itself: publish applies each intent under its op key, after it checked the pass's
 * bundle.
 */
export const Intent = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("comment"), text, scope: Scope }),
	z.strictObject({ kind: z.literal("decide"), text, scope: Scope }),
	z.strictObject({ kind: z.literal("file-follow-up"), title: text, body: text, part: SplitFiling.optional() }),
	z.strictObject({ kind: z.literal("push-branch"), head: text }),
	z.strictObject({ kind: z.literal("keep-evidence") }),
	...(["land", "save-landing"] as const).map((kind) => z.strictObject({ kind: z.literal(kind), head: text })),
]);

export type Intent = z.infer<typeof Intent>;

/** The writes a pass makes through its outbox, shaped as the work source's and the questions' own. */
export type PassWrites = {
	readonly comment: (id: ItemId, text: string) => Promise<void>;
	readonly decide: (id: ItemId, text: string) => Promise<void>;
	readonly fileFollowUp: (from: ItemId, followUp: FollowUp, part?: SplitFiling) => Promise<void>;
};

/** One pass's intents for its item, in the order the pass made them. */
export class Outbox {
	readonly #intents: Intent[] = [];

	constructor(readonly item: string) {}

	add(intent: Intent): void {
		this.#intents.push(Intent.parse(intent));
	}

	/** The writes of one run and attempt, each recorded as an intent publish applies under that scope. */
	calls(scope: CallScope): PassWrites {
		return {
			comment: async (item, text) => this.add({ kind: "comment", text: this.#own(item, text), scope }),
			decide: async (item, text) => this.add({ kind: "decide", text: this.#own(item, text), scope }),
			fileFollowUp: async (from, { title, body }, part) => this.add({ kind: "file-follow-up", title: this.#own(from, title), body, part }),
		};
	}

	/** Takes every intent recorded so far, leaving the outbox empty. */
	drain(): Intent[] {
		return this.#intents.splice(0);
	}

	#own<T>(item: string, value: T): T {
		if (item !== this.item) throw new Error(`the outbox of ${this.item} takes no write for ${item}`);

		return value;
	}
}
