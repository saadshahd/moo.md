import {
	type Adapter,
	type Answer,
	type ClaimResult,
	type FollowUp,
	type Item,
	type ItemRef,
	PermanentError,
	type Question,
	type ThreadEntry,
	type Watch,
} from "../adapter-api.ts";

type Stored = { id: string; title: string; body: string; ready: boolean; thread: ThreadEntry[]; claim?: { holder: string; expiresAt: number }; from?: string };

/** A provider failure a retry can outlast, like a GitHub 502. */
export class ProviderError extends Error {
	override readonly name = "ProviderError";
}

/**
 * One in-memory provider behind all four integrations. Its controls stand in for the real provider's clock,
 * its failures and its rate limit, so machine tests and fault tests run without a network.
 */
export class FakeProvider {
	#items = new Map<string, Stored>();
	#version = 0;
	#clock = 1_000_000;
	#failures = 0;
	#spent = 0;
	#emptyList = false;
	/** Every `publish` and `release`, in order. */
	readonly shipped: string[] = [];
	/** Replaces `listReady`'s answer, as when a provider changes its API and replies off the shape the engine knows. */
	listReplacement: (() => ItemRef[]) | undefined;

	now = (): number => this.#clock;

	advance(ms: number): void {
		this.#clock += ms;
	}

	/** Requests that spent rate limit. `watch` spends none. */
	spent(): number {
		return this.#spent;
	}

	/** The next `count` calls throw a `ProviderError`. */
	failNext(count: number): void {
		this.#failures = count;
	}

	/** `listReady` answers `[]` whatever it holds. */
	set emptyList(value: boolean) {
		this.#emptyList = value;
	}

	seed(title: string, { ready = true }: { ready?: boolean } = {}): string {
		const id = `item-${this.#items.size + 1}`;

		this.#items.set(id, { id, title, body: `${title} body`, ready, thread: [] });
		this.#version++;

		return id;
	}

	#call<T>(spend: boolean, body: () => T): T {
		if (this.#failures > 0) {
			this.#failures--;
			throw new ProviderError("502 Bad Gateway");
		}

		if (spend) this.#spent++;

		return body();
	}

	#get(id: string): Stored {
		const found = this.#items.get(id);

		if (!found) throw new PermanentError(`no item "${id}"`);

		return found;
	}

	#live(item: Stored): boolean {
		return item.claim !== undefined && item.claim.expiresAt > this.#clock;
	}

	#push(id: string, entry: Omit<ThreadEntry, "at">): void {
		this.#get(id).thread.push({ ...entry, at: this.#clock });
		this.#version++;
	}

	#take(id: string, holder: string, ttlMs: number, renew: boolean): ClaimResult {
		if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new PermanentError(`a claim lasts a positive whole number of milliseconds, not ${ttlMs}`);

		const item = this.#get(id);
		const held = this.#live(item) ? item.claim : undefined;

		if (held && held.holder !== holder) return { won: false, claim: { item: id, ...held } };

		if (renew && item.claim?.holder !== holder) {
			if (item.claim) return { won: false, claim: { item: id, ...item.claim } };

			throw new PermanentError(`"${holder}" holds no claim on "${id}"`);
		}

		if (!held && !item.ready) throw new PermanentError(`item "${id}" is not ready`);

		item.claim = { holder, expiresAt: this.#clock + ttlMs };
		this.#version++;

		return { won: true, claim: { item: id, ...item.claim } };
	}

	adapter(): Adapter {
		const view = (item: Stored): Item => ({ id: item.id, title: item.title, body: item.body, ready: item.ready && !this.#live(item), thread: [...item.thread] });
		const asRef = (item: Stored): ItemRef => ({ id: item.id, title: item.title });

		return {
			apiVersion: 1,
			workSource: {
				listReady: async () =>
					this.#call(true, () => {
						if (this.listReplacement) return this.listReplacement();

						return this.#emptyList ? [] : [...this.#items.values()].flatMap((item) => (view(item).ready ? [asRef(item)] : []));
					}),
				read: async (id) => this.#call(true, () => view(this.#get(id))),
				claim: async (id, holder, ttlMs) => this.#call(true, () => this.#take(id, holder, ttlMs, false)),
				renew: async (id, holder, ttlMs) => this.#call(true, () => this.#take(id, holder, ttlMs, true)),
				comment: async (id, text) => this.#call(true, () => this.#push(id, { kind: "comment", text })),
				fileFollowUp: async (from, { title, body }: FollowUp) =>
					this.#call(true, () => {
						this.#get(from);

						const known = [...this.#items.values()].find((item) => item.from === from && item.title === title);

						if (known) return asRef(known);

						const id = this.seed(title);

						Object.assign(this.#get(id), { body, from });

						return { id, title };
					}),
			},
			questions: {
				ask: async (id, { text, options }: Question) => this.#call(true, () => this.#push(id, { kind: "question", text: options?.length ? `${text}\n\nOptions: ${options.join(", ")}` : text })),
				decide: async (id, text) => this.#call(true, () => this.#push(id, { kind: "decision", text })),
			},
			answers: {
				answer: async (id, { text, option }: Answer) => this.#call(true, () => this.#push(id, option === undefined ? { kind: "answer", text } : { kind: "answer", text, option })),
				watch: async (since): Promise<Watch> => this.#call(false, () => ({ token: String(this.#version), changed: String(this.#version) !== since })),
			},
			release: {
				publish: async (id, ref) => this.#call(true, () => void this.shipped.push(`publish ${id} ${ref}`)),
				release: async (id, ref) => this.#call(true, () => void this.shipped.push(`release ${id} ${ref}`)),
			},
		};
	}
}
