import { expect, test } from "bun:test";
import { mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import type { Watch } from "../src/adapter-api.ts";
import { type SharedWatchOptions, sharedWatch } from "../src/cli/shared-watch.ts";
import { tempDir } from "./fixtures/temp.ts";

const CACHE_MS = 10_000;
const LOCK_MS = 30_000;

type Harness = { readonly options: SharedWatchOptions; readonly reads: (string | undefined)[]; wakes: number; now: number };

const harness = (answer: (since: string | undefined) => Promise<Watch>): Harness => {
	const h: Harness = {
		reads: [],
		wakes: 0,
		now: 1_000_000,
		options: {
			stateDir: join(tempDir("watch"), "hum"),
			now: () => h.now,
			cacheMs: CACHE_MS,
			lockMs: LOCK_MS,
			read: (since) => {
				h.reads.push(since);

				return answer(since);
			},
			changed: () => {
				h.wakes += 1;
			},
		},
	};

	return h;
};

test("callers within the cache time share one read, and a later caller reads again from the saved token", async () => {
	const h = harness(async (since) => ({ token: `after-${since ?? "start"}`, changed: since === undefined }));

	const first = await sharedWatch(h.options);
	const answers = await Promise.all([1, 2, 3].map(() => sharedWatch(h.options)));
	h.now += CACHE_MS;
	const later = await sharedWatch(h.options);

	expect(h.reads).toEqual([undefined, "after-start"]);
	expect(answers).toEqual([first, first, first]);
	expect(later).toEqual({ token: "after-after-start", changed: false });
	expect(h.wakes).toBe(1);
});

test("a failed read is answered to every caller with its cause until the cache time passes", async () => {
	const h = harness(async () => {
		throw new Error("GitHub 502");
	});

	await expect(sharedWatch(h.options)).rejects.toThrow("GitHub 502");
	await expect(sharedWatch(h.options)).rejects.toThrow("GitHub 502");
	expect(h.reads.length).toBe(1);
});

test("a lock left by a reader that died is taken over once it is older than the lock time", async () => {
	const h = harness(async () => ({ token: "t", changed: false }));
	const lockDir = join(h.options.stateDir, "watch.lock");
	const pastLockSeconds = (Date.now() - LOCK_MS - 1000) / 1000;

	mkdirSync(lockDir, { recursive: true });
	await expect(sharedWatch(h.options)).rejects.toThrow("another hum watch");

	utimesSync(lockDir, pastLockSeconds, pastLockSeconds);
	expect(await sharedWatch(h.options)).toEqual({ token: "t", changed: false });
});
