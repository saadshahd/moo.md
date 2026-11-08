import { join } from "node:path";
import { z } from "zod";
import { atomicWrite, createOnce, orMissing, readJson, slug } from "./fs.ts";

/** One external op of one attempt of one run of one item. */
export const OpKey = z.strictObject({
	itemId: z.string().min(1),
	run: z.string().min(1),
	attempt: z.int().nonnegative(),
	op: z.string().min(1),
});

export type OpKey = z.infer<typeof OpKey>;

const Record = OpKey.extend({ state: z.enum(["started", "done"]), at: z.int().nonnegative() });

export type OpProvider = {
	/** True when the provider already holds the effect of this op, found by its key. */
	readonly holds: () => Promise<boolean>;
	readonly run: () => Promise<void>;
};

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

	state(key: OpKey): "started" | "done" | undefined {
		return orMissing(() => Record.parse(readJson(this.#path(OpKey.parse(key)))).state, undefined);
	}

	/** Runs the op once per key, across restarts: `skipped` when it is done or the provider already holds it. */
	async once(key: OpKey, { holds, run }: OpProvider): Promise<"ran" | "skipped"> {
		const checked = OpKey.parse(key);
		const fresh = this.#write(checked, "started", true);

		if (!fresh) {
			if (this.state(checked) === "done") return "skipped";

			if (await holds()) {
				this.#write(checked, "done", false);

				return "skipped";
			}
		}

		await run();
		this.#write(checked, "done", false);

		return "ran";
	}
}
