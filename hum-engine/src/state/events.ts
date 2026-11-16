import { join } from "node:path";
import { z } from "zod";
import { Json } from "../config/json.ts";
import { createOnce, listRecords, readJson, slug } from "./fs.ts";

export const SavedEvent = z.object({
	/** Where the event came from, such as a thread comment id: a second read of it adds nothing. */
	source: z.string().min(1),
	sourceId: z.string().min(1),
	itemId: z.string().min(1),
	type: z.string().min(1),
	receivedAt: z.int().nonnegative(),
	/** The event's place in its item's log. An event saved before hum kept places has none, and comes first, by when it arrived. */
	seq: z.int().nonnegative().optional(),
	payload: Json,
});

export type SavedEvent = z.infer<typeof SavedEvent>;

export type NewEvent = Omit<SavedEvent, "receivedAt" | "seq">;

/** Every event is saved before anything acts on it, keyed by source, so reading one twice adds nothing; each new one takes the next place in its item's log. */
export class EventLog {
	readonly #folder: string;
	readonly #now: () => number;

	constructor(folder: string, now: () => number) {
		this.#folder = folder;
		this.#now = now;
	}

	#path({ itemId, source, sourceId }: Pick<SavedEvent, "itemId" | "source" | "sourceId">): string {
		return join(this.#folder, slug(itemId), `${slug(`${source}\u0000${sourceId}`)}.json`);
	}

	/** Saves the event at the end of its item's log. `added` is false when this source and id are already in the log. */
	add(event: NewEvent): { readonly added: boolean; readonly event: SavedEvent } {
		const saved = SavedEvent.parse({ ...event, receivedAt: this.#now(), seq: listRecords(join(this.#folder, slug(event.itemId))).length });
		const added = createOnce(this.#path(saved), `${JSON.stringify(saved)}\n`);

		return added ? { added, event: saved } : { added, event: this.get(saved) };
	}

	get(key: Pick<SavedEvent, "itemId" | "source" | "sourceId">): SavedEvent {
		return SavedEvent.parse(readJson(this.#path(key)));
	}

	/** An item's events in the order its log took them. */
	list(itemId: string): SavedEvent[] {
		return listRecords(join(this.#folder, slug(itemId)))
			.map((file) => SavedEvent.parse(readJson(file)))
			.sort((a, b) => (a.seq ?? -1) - (b.seq ?? -1) || a.receivedAt - b.receivedAt || (a.sourceId < b.sourceId ? -1 : 1));
	}
}
