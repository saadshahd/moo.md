import { z } from "zod";
import { type FollowUp, type ItemId, type Question } from "../adapter-api.ts";
import type { CallScope } from "../adapters/once.ts";

const text = z.string().min(1);

const Scope = z.strictObject({ run: text, attempt: z.int().nonnegative() });

const Ask = z.strictObject({ text, options: z.array(text).optional(), detail: z.string().optional() });

/** Where publish keeps the id of an item it filed: the break that filed it, or the repeat group whose check item it is. */
const FiledFor = z.discriminatedUnion("record", [z.strictObject({ record: z.literal("break"), item: text }), z.strictObject({ record: z.literal("repeat"), key: text })]);

/**
 * What a pass asks publish to do for its item, on the item's run branch. A pass never writes to the work source, the
 * questions, GitHub or the remote itself: publish applies each intent under its op key, after it checked the pass's
 * bundle.
 */
export const Intent = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("comment"), text, scope: Scope }),
	z.strictObject({ kind: z.literal("ask"), question: Ask, scope: Scope }),
	z.strictObject({ kind: z.literal("decide"), text, scope: Scope }),
	z.strictObject({ kind: z.literal("file-follow-up"), title: text, body: text, filedFor: FiledFor.optional() }),
	z.strictObject({ kind: z.literal("push-branch"), head: text }),
	z.strictObject({ kind: z.literal("keep-evidence") }),
	...(["land", "save-landing"] as const).map((kind) => z.strictObject({ kind: z.literal(kind), head: text, ownerApproved: z.boolean() })),
]);

export type Intent = z.infer<typeof Intent>;

export type FiledFor = z.infer<typeof FiledFor>;

/** The writes a pass makes through its outbox, shaped as the work source's and the questions' own. */
export type PassWrites = {
	readonly comment: (id: ItemId, text: string) => Promise<void>;
	readonly ask: (id: ItemId, question: Question) => Promise<void>;
	readonly decide: (id: ItemId, text: string) => Promise<void>;
	readonly fileFollowUp: (from: ItemId, followUp: FollowUp, filedFor?: FiledFor) => Promise<void>;
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
			ask: async (item, question) => this.add({ kind: "ask", question: { ...this.#own(item, question), options: question.options && [...question.options] }, scope }),
			decide: async (item, text) => this.add({ kind: "decide", text: this.#own(item, text), scope }),
			fileFollowUp: async (from, { title, body }, filedFor) => this.add({ kind: "file-follow-up", title: this.#own(from, title), body, filedFor }),
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
