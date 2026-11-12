import { type Adapter, type Claim, type ItemRef, PermanentError, type ThreadEntry, type Watch } from "../adapter-api.ts";
import { claimer, isLive } from "./claim.ts";
import { questionText } from "./marked.ts";

type Stored = { id: string; title: string; body: string; ready: boolean; thread: ThreadEntry[]; claim?: Claim; from?: string };

/** A provider failure a retry can outlast, like a GitHub 502. */
export class ProviderError extends Error {
	override readonly name = "ProviderError";
}

const START_CLOCK = 1_000_000;

/**
 * One in-memory provider behind all four integrations. Its controls stand in for the real provider's clock,
 * its failures and its rate limit, so machine tests and fault tests run without a network.
 */
export class FakeProvider {
	#items = new Map<string, Stored>();
	#version = 0;
	#clock = START_CLOCK;
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

	#isReady(item: Stored): boolean {
		return item.ready && !isLive(item.claim, this.#clock);
	}

	#push(id: string, entry: Omit<ThreadEntry, "at">): void {
		this.#get(id).thread.push({ ...entry, at: this.#clock });
		this.#version++;
	}

	#take = claimer(
		{
			standing: async (id) => {
				const { claim } = this.#get(id);

				return claim && { claim };
			},
			isReady: async (id) => this.#get(id).ready,
			write: async (claim, over) => {
				const item = this.#get(claim.item);

				if (item.claim !== over?.claim) return false;

				item.claim = claim;
				this.#version++;

				return true;
			},
		},
		this.now,
	);

	adapter(): Adapter {
		const asRef = ({ id, title }: Stored): ItemRef => ({ id, title });
		const spend = <T>(body: () => T) => this.#call(true, body);

		return {
			apiVersion: 1,
			workSource: {
				listReady: async () =>
					spend(() => this.listReplacement?.() ?? (this.#emptyList ? [] : [...this.#items.values()].flatMap((item) => (this.#isReady(item) ? [asRef(item)] : [])))),
				read: async (id) =>
					spend(() => {
						const item = this.#get(id);

						return { id: item.id, title: item.title, body: item.body, ready: this.#isReady(item), thread: [...item.thread] };
					}),
				claim: async (id, holder, ttlMs) => spend(() => this.#take("claim", id, holder, ttlMs)),
				renew: async (id, holder, ttlMs) => spend(() => this.#take("renew", id, holder, ttlMs)),
				comment: async (id, text) => spend(() => this.#push(id, { kind: "comment", text })),
				fileFollowUp: async (from, { title, body }) =>
					spend(() => {
						this.#get(from);

						const known = [...this.#items.values()].find((item) => item.from === from && item.title === title);

						if (known) return asRef(known);

						const id = this.seed(title);

						Object.assign(this.#get(id), { body, from });

						return { id, title };
					}),
			},
			questions: {
				ask: async (id, question) => spend(() => this.#push(id, { kind: "question", text: questionText(question) })),
				decide: async (id, text) => spend(() => this.#push(id, { kind: "decision", text })),
			},
			answers: {
				answer: async (id, { text, option }) => spend(() => this.#push(id, option === undefined ? { kind: "answer", text } : { kind: "answer", text, option })),
				watch: async (since): Promise<Watch> => this.#call(false, () => ({ token: String(this.#version), changed: String(this.#version) !== since })),
			},
			release: {
				publish: async (id, ref) => spend(() => void this.shipped.push(`publish ${id} ${ref}`)),
				release: async (id, ref) => spend(() => void this.shipped.push(`release ${id} ${ref}`)),
			},
		};
	}
}
