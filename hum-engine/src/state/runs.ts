import { join } from "node:path";
import { z } from "zod";
import { atomicWrite, createOnce, listFiles, listRecords, orMissing, readJson, slug } from "./fs.ts";

export const RunKey = z.object({ itemId: z.string().min(1), run: z.string().min(1), attempt: z.int().nonnegative() });

export type RunKey = z.infer<typeof RunKey>;

const BegunRecord = RunKey.extend({
	/** On the Mac the run's name is saved before launch and found by it after a crash. */
	name: z.string().min(1),
	/** The Claude session id: set ahead in CI, learned after launch on the Mac. */
	sessionId: z.string().min(1).optional(),
	savedAt: z.int().nonnegative(),
});

/** A run whose outcome is not yet taken is one a restart adopts; an ended run carries when it ended and the memory it used. */
export const RunRecord = z.union([
	BegunRecord.extend({ endedAt: z.undefined().optional() }),
	BegunRecord.extend({
		endedAt: z.int().nonnegative(),
		/** The rules of memory.md the run says it applied; absent when the run was shown none. */
		memoryUsed: z.array(z.string()).optional(),
	}),
]);

export type RunRecord = z.infer<typeof RunRecord>;

/** A run saved before its launch, and the two writes that follow it. */
export type BegunRun = {
	readonly record: RunRecord;
	/** A record was already saved for this key, so the caller adopts that run. */
	readonly adopted: boolean;
	/** Saves the session id once the launch has reported it. */
	readonly saveSession: (sessionId: string) => RunRecord;
	/** Marks the run's outcome as taken, so a restart starts a new attempt and adopts nothing. */
	readonly end: (memoryUsed?: readonly string[]) => RunRecord;
};

/** The run's name, then its session id, saved so a restart adopts the run and never starts it twice. */
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
		return orMissing(() => RunRecord.parse(readJson(this.#path(RunKey.parse(key)))), undefined);
	}

	/** Saves the run before it launches. When one is already saved for this key, returns it unchanged, so the caller adopts it. */
	begin(key: RunKey, { name, sessionId }: { readonly name: string; readonly sessionId?: string }): BegunRun {
		const record = RunRecord.parse({ ...key, name, sessionId, savedAt: this.#now() });
		const created = createOnce(this.#path(record), `${JSON.stringify(record)}\n`);
		const saved = created ? record : this.get(key);

		if (!saved) throw new Error(`run record for ${key.itemId} ${key.run} #${key.attempt} vanished after it was found`);

		return {
			record: saved,
			adopted: !created,
			saveSession: (sessionId) => this.#rewrite(key, { sessionId }),
			end: (memoryUsed) => this.#rewrite(key, { endedAt: this.#now(), memoryUsed: memoryUsed && [...memoryUsed] }),
		};
	}

	/** Rewrites a begun run's record. Nothing removes a record, so one gone since `begin` saved it throws. */
	#rewrite(key: RunKey, change: { readonly sessionId?: string; readonly endedAt?: number; readonly memoryUsed?: string[] }): RunRecord {
		const record = this.get(key);

		if (!record) throw new Error(`the run record of ${key.itemId} ${key.run} #${key.attempt} is gone since begin saved it`);

		const next = RunRecord.parse({ ...record, ...change });

		atomicWrite(this.#path(next), `${JSON.stringify(next)}\n`);

		return next;
	}

	/** The item's run of this purpose that was begun and never ended: the one a restart adopts. */
	unended(itemId: string, run: string): RunRecord | undefined {
		return this.list(itemId).find((record) => record.run === run && record.endedAt === undefined);
	}

	/** Every item's saved runs, oldest first. */
	all(): RunRecord[] {
		return listFiles(this.#folder)
			.flatMap(listRecords)
			.map((file) => RunRecord.parse(readJson(file)))
			.sort((a, b) => a.savedAt - b.savedAt);
	}

	/** The item's saved runs, oldest first. */
	list(itemId: string): RunRecord[] {
		return listRecords(join(this.#folder, slug(itemId)))
			.map((file) => RunRecord.parse(readJson(file)))
			.sort((a, b) => a.savedAt - b.savedAt || a.attempt - b.attempt);
	}
}
