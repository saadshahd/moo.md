import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWrite, createOnce, isMissing, listFiles, slug } from "./fs.ts";

export const RunKey = z.strictObject({ itemId: z.string().min(1), run: z.string().min(1), attempt: z.int().nonnegative() });

export type RunKey = z.infer<typeof RunKey>;

export const RunRecord = RunKey.extend({
	/** On the Mac the run's name is saved before launch and found by it after a crash (D1). */
	name: z.string().min(1),
	/** The Claude session id: set ahead in CI, learned after launch on the Mac. */
	sessionId: z.string().min(1).optional(),
	savedAt: z.int().nonnegative(),
});

export type RunRecord = z.infer<typeof RunRecord>;

export type BegunRun = { readonly record: RunRecord; readonly adopted: boolean };

/** D1: the run's name, then its session id, saved so a restart adopts the run and never starts it twice. */
export class RunRecords {
	readonly #folder: string;
	readonly #now: () => number;

	constructor(folder: string, now: () => number) {
		this.#folder = folder;
		this.#now = now;
	}

	#path(key: RunKey): string {
		return join(this.#folder, slug(key.itemId), `${slug(`${key.run}\u0000${key.attempt}`)}.json`);
	}

	get(key: RunKey): RunRecord | undefined {
		try {
			return RunRecord.parse(JSON.parse(readFileSync(this.#path(RunKey.parse(key)), "utf8")));
		} catch (error) {
			if (error instanceof Error && isMissing(error)) return undefined;

			throw error;
		}
	}

	/** Saves the run before it launches. When one is already saved for this key, returns it unchanged, so the caller adopts it. */
	begin(key: RunKey, name: string, sessionId?: string): BegunRun {
		const record = RunRecord.parse({ ...key, name, sessionId, savedAt: this.#now() });
		const created = createOnce(this.#path(record), `${JSON.stringify(record)}\n`);
		const saved = created ? record : this.get(key);

		if (!saved) throw new Error(`run record for ${key.itemId} ${key.run} #${key.attempt} vanished after it was found`);

		return { record: saved, adopted: !created };
	}

	/** Saves the session id once the launch has reported it. */
	saveSession(key: RunKey, sessionId: string): RunRecord {
		const record = this.get(key);

		if (!record) throw new Error(`no saved run for ${key.itemId} ${key.run} #${key.attempt}; call begin before launch`);

		const next = RunRecord.parse({ ...record, sessionId });

		atomicWrite(this.#path(next), `${JSON.stringify(next)}\n`);

		return next;
	}

	/** The item's saved runs, oldest first. */
	list(itemId: string): RunRecord[] {
		return listFiles(join(this.#folder, slug(itemId)))
			.map((file) => RunRecord.parse(JSON.parse(readFileSync(file, "utf8"))))
			.sort((a, b) => a.savedAt - b.savedAt || a.attempt - b.attempt);
	}
}
