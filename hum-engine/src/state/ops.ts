import { join } from "node:path";
import { z } from "zod";
import { atomicWrite, createOnce, listRecords, orMissing, readJson, slug } from "./fs.ts";

/** One external op of one attempt of one run of one item. */
export const OpKey = z.object({
	itemId: z.string().min(1),
	run: z.string().min(1),
	attempt: z.int().nonnegative(),
	op: z.string().min(1),
});

export type OpKey = z.infer<typeof OpKey>;

const Record = OpKey.extend({ state: z.enum(["started", "done"]), at: z.int().nonnegative() });

export type OpProvider<T> = {
	/** True when the provider already holds the effect of this op, found by its key. */
	readonly holds: () => Promise<boolean>;
	readonly run: () => Promise<T>;
	/** Whether the run's value finished the op; an op left unfinished runs again on the next call. Every value finishes it unless this says otherwise. */
	readonly isDone?: (value: T) => boolean;
};

/** `skipped` when the op was done or the provider held it; else the value its run returned. */
export type OpRun<T> = { readonly kind: "skipped" } | { readonly kind: "ran"; readonly value: T };

/** The key is saved before the op, so a restart after a kill finds the op started and asks the provider before it runs it again. */
export class OpKeys {
	readonly #folder: string;
	readonly #now: () => number;

	constructor(folder: string, now: () => number) {
		this.#folder = folder;
		this.#now = now;
	}

	#path(key: OpKey): string {
		return join(this.#folder, `${slug(JSON.stringify([key.itemId, key.run, key.attempt, key.op]))}.json`);
	}

	#write(key: OpKey, state: "started" | "done", create: boolean): boolean {
		const text = `${JSON.stringify({ ...key, state, at: this.#now() })}\n`;

		if (create) return createOnce(this.#path(key), text);

		atomicWrite(this.#path(key), text);

		return true;
	}

	/** Every op saved. */
	list(): z.infer<typeof Record>[] {
		return listRecords(this.#folder).map((file) => Record.parse(readJson(file)));
	}

	state(key: OpKey): "started" | "done" | undefined {
		return orMissing(() => Record.parse(readJson(this.#path(OpKey.parse(key)))).state, undefined);
	}

	/** Runs the op once per key, across restarts. */
	async once<T>(key: OpKey, { holds, run, isDone = () => true }: OpProvider<T>): Promise<OpRun<T>> {
		const checked = OpKey.parse(key);
		const fresh = this.#write(checked, "started", true);

		if (!fresh) {
			if (this.state(checked) === "done") return { kind: "skipped" };

			if (await holds()) {
				this.#write(checked, "done", false);

				return { kind: "skipped" };
			}
		}

		const value = await run();

		if (isDone(value)) this.#write(checked, "done", false);

		return { kind: "ran", value };
	}
}
