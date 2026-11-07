import { z } from "zod";
import {
	type Adapter,
	Item,
	ItemRef,
	ClaimResult,
	PermanentError,
	Watch,
} from "../adapter-api.ts";
import type { Faults } from "../state/faults.ts";

export type GuardOptions = {
	/** The integration's name; a fault card names it and is scoped to it (R1). */
	readonly provider: string;
	readonly faults: Faults;
	/** A failure that outlasts this shows one card; a shorter one shows nothing. */
	readonly timeoutMs: number;
	readonly backoffMs?: number;
	readonly now?: () => number;
	readonly sleep?: (ms: number) => Promise<void>;
	/** R3: where the last ready list is kept, so a restarted worker still sees an empty list that contradicts it. Memory only when absent. */
	readonly lastReady?: { readonly load: () => string[]; readonly save: (ids: string[]) => void };
};

const MAX_BACKOFF_MS = 30_000;

/**
 * R1, R3, V7: the engine's side of every adapter call.
 * - A transient failure is retried inside the timeout; one that outlasts it raises one card and throws.
 * - A reply of the wrong shape is refused at once with one card, and never retried (V7).
 * - An empty list that contradicts the last read is a fault, not "no work" (R3).
 * A call that would double on a retry (`comment`, `ask`, `decide`, `answer`) runs once; its caller retries it under an op key (E2).
 */
export const guarded = (adapter: Adapter, { provider, faults, timeoutMs, backoffMs = 500, now = Date.now, sleep = Bun.sleep, lastReady: remembered }: GuardOptions): Adapter => {
	const unavailable = `provider-unavailable:${provider}`;

	const refuseChangedReply = (error: z.ZodError): never => {
		faults.raise({
			code: "integration-shape-changed",
			item: provider,
			cause: `${provider} replied in a shape hum does not know: ${error.issues[0]?.path.join(".") || "(root)"}: ${error.issues[0]?.message}`,
			fix: `Run /hum to set ${provider} up again, or update its adapter.`,
		});

		throw new PermanentError(`${provider} replied in a changed shape`);
	};

	const once = async <T>(call: () => Promise<T>, schema: z.ZodType<T>): Promise<T> => {
		try {
			return schema.parse(await call());
		} catch (error) {
			if (error instanceof z.ZodError) return refuseChangedReply(error);

			throw error;
		}
	};

	const retried = async <T>(call: () => Promise<T>, schema: z.ZodType<T>): Promise<T> => {
		const deadline = now() + timeoutMs;

		for (let attempt = 0; ; attempt++) {
			try {
				const value = await once(call, schema);

				faults.clear(unavailable);

				return value;
			} catch (error) {
				if (error instanceof PermanentError) throw error;

				if (now() >= deadline) {
					faults.raise({
						code: "provider-unavailable",
						item: provider,
						cause: `${provider} has failed for ${Math.round(timeoutMs / 1000)} s: ${error instanceof Error ? error.message : String(error)}`,
						fix: "hum keeps retrying on its own; check the provider's status if this stays.",
					});

					throw error;
				}

				await sleep(Math.min(backoffMs * 2 ** attempt, MAX_BACKOFF_MS));
			}
		}
	};

	const none = z.void();
	const { workSource, questions, answers, release } = adapter;
	let lastReady: string[] = remembered?.load() ?? [];

	return {
		apiVersion: adapter.apiVersion,
		workSource: workSource && {
			listReady: async () => {
				const list = await retried(() => workSource.listReady(), ItemRef.array());

				if (list.length === 0 && lastReady.length > 0) {
					for (const id of lastReady) {
						const item = await retried(() => workSource.read(id), Item);

						if (item.ready) {
							faults.raise({
								code: "empty-list",
								item: provider,
								cause: `${provider} listed no ready items, yet "${id}" is still ready`,
								fix: "No item was marked gone; hum reads the list again on its next tick.",
							});

							throw new PermanentError(`${provider} returned an empty list that contradicts its last read`);
						}
					}
				}

				faults.clear(`empty-list:${provider}`);
				lastReady = list.map((ref) => ref.id);
				remembered?.save(lastReady);

				return list;
			},
			read: (id) => retried(() => workSource.read(id), Item),
			claim: (id, holder, ttlMs) => retried(() => workSource.claim(id, holder, ttlMs), ClaimResult),
			renew: (id, holder, ttlMs) => retried(() => workSource.renew(id, holder, ttlMs), ClaimResult),
			comment: (id, text) => once(() => workSource.comment(id, text), none),
			fileFollowUp: (from, followUp) => retried(() => workSource.fileFollowUp(from, followUp), ItemRef),
		},
		questions: questions && {
			ask: (id, question) => once(() => questions.ask(id, question), none),
			decide: (id, text) => once(() => questions.decide(id, text), none),
		},
		answers: answers && {
			answer: (id, answer) => once(() => answers.answer(id, answer), none),
			watch: (since) => retried(() => answers.watch(since), Watch),
		},
		release: release && {
			publish: (id, ref) => retried(() => release.publish(id, ref), none),
			release: (id, ref) => retried(() => release.release(id, ref), none),
		},
	};
};
