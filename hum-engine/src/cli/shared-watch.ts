import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { z } from "zod";
import type { Watch } from "../adapter-api.ts";
import { atomicWrite, hasCode, orMissing, readJson } from "../state/fs.ts";

const Outcome = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("read"), changed: z.boolean() }),
	z.strictObject({ kind: z.literal("failed"), cause: z.string().min(1) }),
]);

/** The last read of what changed, kept for every `hum watch` in the repo. The token is the last one a read returned. */
const SavedWatch = z.strictObject({
	token: z.string().optional(),
	checkedAt: z.number().int().nonnegative(),
	outcome: Outcome,
});

type SavedWatch = z.infer<typeof SavedWatch>;

export type SharedWatchOptions = {
	readonly stateDir: string;
	readonly now: () => number;
	/** How long one read serves every caller. */
	readonly cacheMs: number;
	/** How long the reader's lock stands before another caller may take it over. */
	readonly lockMs: number;
	/** The one read of the work source, from the token the last read returned. */
	readonly read: (since: string | undefined) => Promise<Watch>;
	/** Called once per read that saw a change, so the worker reads now instead of on its next tick. */
	readonly changed: () => void;
};

const cachePath = (stateDir: string): string => join(stateDir, "watch.json");

const lockPath = (stateDir: string): string => join(stateDir, "watch.lock");

const loadSavedWatch = (stateDir: string): SavedWatch | undefined =>
	orMissing(() => SavedWatch.parse(readJson(cachePath(stateDir))), undefined);

const save = (stateDir: string, saved: SavedWatch): void =>
	atomicWrite(cachePath(stateDir), `${JSON.stringify(saved)}\n`);

/** The saved read while it still serves callers; none once it is older than `cacheMs`. */
const servable = (
	saved: SavedWatch | undefined,
	now: number,
	cacheMs: number,
): SavedWatch | undefined =>  saved !== undefined && now - saved.checkedAt < cacheMs ? saved : undefined;

/** What a saved read answers a caller: the same change, or the same failure. */
const replay = (saved: SavedWatch): Watch => {
	if (saved.outcome.kind === "failed") throw new Error(saved.outcome.cause);

	return { token: saved.token ?? "", changed: saved.outcome.changed };
};

/** proper-lockfile refuses a staleness under two seconds. */
const STALE_FLOOR_MS = 2000;

/**
 * One read of what changed serves every caller in the repo for `cacheMs`. Only the caller holding the lock reads;
 * the others answer from the saved read. A lock left by a reader that died stands for `lockMs`, then goes.
 */
export async function sharedWatch(o: SharedWatchOptions): Promise<Watch> {
	const before = loadSavedWatch(o.stateDir);

	const served = servable(before, o.now(), o.cacheMs);

	if (served !== undefined) return replay(served);

	mkdirSync(o.stateDir, { recursive: true });

	const release = await lock(o.stateDir, {
		lockfilePath: lockPath(o.stateDir),
		realpath: false,
		retries: 0,
		stale: Math.max(o.lockMs, STALE_FLOOR_MS),
	}).catch((error: Error) => {
		if (hasCode(error, "ELOCKED")) return undefined;

		throw error;
	});

	if (release === undefined) {
		if (before === undefined)
			throw new Error(
				"another hum watch is making the first read; ask again shortly",
			);

		return replay(before);
	}

	try {
		const saved = loadSavedWatch(o.stateDir);

		const servedMeanwhile = servable(saved, o.now(), o.cacheMs);

		if (servedMeanwhile !== undefined) return replay(servedMeanwhile);

		const read = await o.read(saved?.token).catch((error: Error) => {
			save(o.stateDir, {
				token: saved?.token,
				checkedAt: o.now(),
				outcome: {
					kind: "failed",
					cause: error.message,
				},
			});

			throw error;
		});

		save(o.stateDir, {
			token: read.token,
			checkedAt: o.now(),
			outcome: { kind: "read", changed: read.changed },
		});

		if (read.changed) o.changed();

		return read;
	} finally {
		await release();
	}
}
