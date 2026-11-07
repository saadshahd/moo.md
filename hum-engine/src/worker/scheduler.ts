import type { Item } from "../adapter-api.ts";

/** The paths an item will touch, as files or folders (a glob counts as its folder). `undefined` when the item does not say. */
export type Footprint = readonly string[] | undefined;

const TOUCHES = /^touches:[ \t]*(.+)$/im;

/** The item's declared footprint: a body line `touches: docs/a.md, src/`. An item that declares none is unknown, so it runs alone. */
export const footprintOf = (item: Pick<Item, "body">): Footprint => {
	const line = TOUCHES.exec(item.body)?.[1];
	const paths = line?.split(/[,\s]+/).filter(Boolean);

	return paths && paths.length > 0 ? paths : undefined;
};

/** The folder a path or glob stands for: cut at the first glob character, then back to a whole segment. "" is the repo root. */
const folderOf = (entry: string): string => {
	const path = entry.replace(/^\.\//, "").replace(/\/+$/, "");
	const glob = path.search(/[*?[{]/);

	return glob < 0 ? path : path.slice(0, Math.max(0, path.lastIndexOf("/", glob)));
};

const related = (a: string, b: string): boolean => a === "" || b === "" || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/** Safe by default: two items clash when either footprint is unknown or any path of one lies in the other's. */
export const overlaps = (a: Footprint, b: Footprint): boolean => a === undefined || b === undefined || a.some((x) => b.some((y) => related(folderOf(x), folderOf(y))));

export type Candidate = { readonly id: string; readonly footprint: Footprint; /** The owner answered it: it goes ahead of fresh items. */ readonly answered: boolean };

export type PickInput = {
	readonly now: number;
	/** R4: until then no run starts. */
	readonly limitedUntil: number;
	/** The most runs that go at once. */
	readonly runners: number;
	readonly running: readonly { readonly id: string; readonly footprint: Footprint }[];
	/** Waiting items, oldest first. */
	readonly queue: readonly Candidate[];
};

export type Picked = { readonly start: readonly Candidate[]; readonly deferred: readonly Candidate[] };

/**
 * Which waiting items start now. Items on different files run side by side; an item that clashes with a
 * running item, or with an item ahead of it in the queue, waits, so items on one file go in order (row 4).
 * Answered items go first. Never more than `runners` runs at once, and none while limited.
 */
export const pick = ({ now, limitedUntil, runners, running, queue }: PickInput): Picked => {
	if (now < limitedUntil) return { start: [], deferred: queue };

	const ordered = [...queue.filter((c) => c.answered), ...queue.filter((c) => !c.answered)];
	const ahead: { footprint: Footprint }[] = [...running];
	const start: Candidate[] = [];
	const deferred: Candidate[] = [];

	for (const candidate of ordered) {
		const clash = ahead.some((other) => overlaps(other.footprint, candidate.footprint));

		ahead.push(candidate);

		if (clash || running.length + start.length >= runners) deferred.push(candidate);
		else start.push(candidate);
	}

	return { start, deferred };
};

/** E5: many triggers while the loop is busy or asleep make one wake. A run's end signals; the loop's next tick reads everything. */
export class Wake {
	#signalled = false;
	#wake: (() => void) | undefined;

	signal(): void {
		this.#signalled = true;
		this.#wake?.();
	}

	/** Resolves at once when signalled since the last wait, else on the next signal or after `ms`. */
	async wait(ms: number, abort?: AbortSignal): Promise<void> {
		if (!this.#signalled && !abort?.aborted) {
			await new Promise<void>((resolve) => {
				const done = () => {
					clearTimeout(timer);
					abort?.removeEventListener("abort", done);
					this.#wake = undefined;
					resolve();
				};

				const timer = setTimeout(done, ms);

				this.#wake = done;
				abort?.addEventListener("abort", done, { once: true });
			});
		}

		this.#signalled = false;
	}
}

/** The cache holds a written prefix this long (Anthropic's default TTL). */
const CACHE_TTL_MS = 5 * 60_000;

/** What the run that entered a prefix must do: `opened` at its first token, `release` when it ends. Both do nothing for a run that did not open the prefix. */
export type Lease = { readonly opened: () => void; readonly release: () => void };

const NO_LEASE: Lease = { opened: () => {}, release: () => {} };

/**
 * E4: runs that share a prompt prefix start one at a time. The first goes at once; the others wait until its
 * first token has arrived, so the cache is written once and every later run reads it. A prefix written
 * within the cache TTL is warm, and its runs start freely.
 */
export class PrefixGate {
	readonly #now: () => number;
	readonly #ttl: number;
	readonly #open = new Map<string, { readonly promise: Promise<void>; readonly resolve: () => void }>();
	readonly #warm = new Map<string, number>();

	constructor({ now = Date.now, ttlMs = CACHE_TTL_MS }: { now?: () => number; ttlMs?: number } = {}) {
		this.#now = now;
		this.#ttl = ttlMs;
	}

	/** Returns when this run may start its model call. */
	async enter(prefix: string, abort?: AbortSignal): Promise<Lease> {
		for (;;) {
			const waiting = this.#open.get(prefix);

			if (waiting) {
				await new Promise<void>((resolve, reject) => {
					abort?.addEventListener("abort", () => reject(new Error("stopped while waiting for the prefix's first token")), { once: true });
					void waiting.promise.then(resolve);
				});

				continue;
			}

			if ((this.#warm.get(prefix) ?? 0) > this.#now()) return NO_LEASE;

			const mine = Promise.withResolvers<void>();

			const free = () => {
				mine.resolve();

				if (this.#open.get(prefix) === mine) this.#open.delete(prefix);
			};

			this.#open.set(prefix, mine);

			return {
				opened: () => {
					this.#warm.set(prefix, this.#now() + this.#ttl);
					free();
				},
				release: free,
			};
		}
	}
}
