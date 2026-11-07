import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Card } from "../status/format.ts";
import { atomicWrite, listFiles, slug } from "./fs.ts";

/** The fault card for one failure. `key` makes it one card per cause and item. */
export type FaultInput = {
	readonly code: string;
	readonly item?: string;
	readonly cause: string;
	readonly fix: string;
	readonly action?: Card["action"];
};

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly fault: Card };

/** T5: the fault cards currently raised. One card per cause, kept in memory and, when the disk allows, on it. */
export class Faults {
	readonly #folder: string;
	readonly #now: () => number;
	readonly #cards = new Map<string, Card>();

	constructor(folder: string, now: () => number) {
		this.#folder = folder;
		this.#now = now;

		for (const file of listFiles(folder)) {
			try {
				const card = Card.safeParse(JSON.parse(readFileSync(file, "utf8")));

				if (card.success) this.#cards.set(card.data.key, card.data);
			} catch {
				// A damaged card file is dropped; the cause raises it again if it still holds.
			}
		}
	}

	#path(key: string): string {
		return join(this.#folder, `${slug(key)}.json`);
	}

	/**
	 * Raises the card, or returns the one already raised for this cause. A card that cannot be
	 * written (D3: the disk is full) still stands in memory, and the caller puts it in the status file.
	 */
	raise({ code, item, cause, fix, action }: FaultInput): Card {
		const key = item === undefined ? code : `${code}:${item}`;
		const raised = this.#cards.get(key);

		if (raised) return raised;

		const card = Card.parse({ kind: "fault", key, item, code, cause, fix, action, since: this.#now() });

		this.#cards.set(key, card);

		try {
			atomicWrite(this.#path(key), `${JSON.stringify(card)}\n`);
		} catch {
			// The card stays in memory; the disk that would hold it is the failure it reports.
		}

		return card;
	}

	/** Removes the card once its cause is gone. */
	clear(key: string): void {
		if (this.#cards.delete(key)) rmSync(this.#path(key), { force: true });
	}

	list(): Card[] {
		return [...this.#cards.values()].sort((a, b) => a.since - b.since || (a.key < b.key ? -1 : 1));
	}
}
