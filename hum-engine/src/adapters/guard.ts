import pRetry, { AbortError, type RetryContext } from "p-retry";
import { z } from "zod";
import { type Adapter, ClaimResult, Failed, type Fallible, type Integrations, Item, ItemId, ItemRef, PermanentError, Watch, type WorkSource } from "../adapter-api.ts";
import { type HumConfig, SHIPPED_DEFAULTS } from "../config/schema.ts";
import type { Faults } from "../state/faults.ts";
import { SECOND_MS } from "../time.ts";

type Backoff = { readonly first: number; readonly max: number };

export type GuardOptions = {
	/** The integration's name; each card names it and is scoped to it. */
	readonly provider: string;
	readonly faults: Faults;
	/** A failure that outlasts this shows one card; a shorter one shows nothing. */
	readonly timeoutMs: number;
	/** The pause before the first retry, doubled each retry up to the longest pause. */
	readonly backoffMs?: Backoff;
	/** Where the last ready list is kept, so a restarted worker still sees an empty list that contradicts it. Memory only when absent. */
	readonly lastReady?: { readonly load: () => string[]; readonly save: (ids: string[]) => void };
};

/** The guard's timings from the owner's provider settings. */
export const guardTimings = ({ providerTimeoutSeconds, providerBackoff }: Pick<HumConfig, "providerTimeoutSeconds" | "providerBackoff">): Pick<Required<GuardOptions>, "timeoutMs" | "backoffMs"> => ({
	timeoutMs: providerTimeoutSeconds * SECOND_MS,
	backoffMs: { first: providerBackoff.firstSeconds * SECOND_MS, max: providerBackoff.maxSeconds * SECOND_MS },
});

const SHIPPED_BACKOFF_MS = guardTimings(SHIPPED_DEFAULTS).backoffMs;

const none = z.void();

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** A retry cannot fix a permanent failure, so it skips every retry. */
const abortIfPermanent = (cause: unknown): never => {
	throw cause instanceof PermanentError ? new AbortError(cause) : cause;
};

/**
 * The engine's side of every adapter call.
 * - A reply of the wrong shape is refused at once with one card, and never retried.
 * - A transient failure is retried inside the timeout; one that outlasts it raises one card and throws.
 * - An empty ready list that contradicts the last read is a fault, not "no work".
 * - A call that would double on a retry (`comment`, `ask`, `decide`, `answer`) runs once; its caller retries it under an op key.
 * - An answer of `failed: "now"` raises one card and throws at once; `failed: "retry"` is a transient failure like any other.
 */
export const guarded = (adapter: Adapter, { provider, faults, timeoutMs, backoffMs = SHIPPED_BACKOFF_MS, lastReady: remembered }: GuardOptions): Integrations => {
	const unavailable = { code: "provider-unavailable", item: provider };
	const contradicted = { code: "empty-list", item: provider };

	const refuseChangedReply = (error: z.ZodError): never => {
		const [issue] = error.issues;

		faults.raise({
			code: "integration-shape-changed",
			item: provider,
			cause: `${provider} replied in a shape hum does not know: ${issue?.path.join(".") || "(root)"}: ${issue?.message}`,
			fix: `Run /hum to set ${provider} up again, or update its adapter.`,
		});

		throw new PermanentError(`${provider} replied in a changed shape`);
	};

	const raiseWhenGivingUp = ({ error, attemptNumber, retryDelay }: RetryContext): void => {
		if (retryDelay > 0) return;

		faults.raise({
			code: "provider-unavailable",
			item: provider,
			cause: `${provider} failed ${attemptNumber} times in a row: ${messageOf(error)}`,
			fix: "hum keeps retrying on its own; check the provider's status if this stays.",
		});
	};

	const failNow = ({ why }: Failed): never => {
		faults.raise({ code: "provider-failed", item: provider, cause: `${provider} could not complete a call: ${why}`, fix: `Fix what ${provider} names, or update its adapter; hum calls it again on its next tick.` });

		throw new PermanentError(`${provider}: ${why}`);
	};

	const once = async <T>(call: () => Promise<T | Failed>, schema: z.ZodType<T>): Promise<T> => {
		const reply = await call();
		const failed = Failed.safeParse(reply);

		if (failed.success) return failed.data.failed === "now" ? failNow(failed.data) : Promise.reject(new Error(`${provider}: ${failed.data.why}`));

		const parsed = schema.safeParse(reply);

		return parsed.success ? parsed.data : refuseChangedReply(parsed.error);
	};

	const retried = async <T>(call: () => Promise<T | Failed>, schema: z.ZodType<T>): Promise<T> => {
		const value = await pRetry(() => once(call, schema).catch(abortIfPermanent), {
			retries: Number.POSITIVE_INFINITY,
			maxRetryTime: timeoutMs,
			minTimeout: backoffMs.first,
			maxTimeout: backoffMs.max,
			onFailedAttempt: raiseWhenGivingUp,
		});

		faults.clear(unavailable);

		return value;
	};

	const { workSource, questions, answers, release } = adapter;
	let lastReadyIds: ItemId[] = (remembered?.load() ?? []).flatMap((id) => ItemId.safeParse(id).data ?? []);

	const firstStillReady = async (source: Fallible<WorkSource>, ids: readonly ItemId[]): Promise<ItemId | undefined> => {
		for (const id of ids) if ((await retried(() => source.read(id), Item)).ready) return id;

		return undefined;
	};

	const refuseContradictingEmptyList = async (source: Fallible<WorkSource>): Promise<void> => {
		const stillReady = await firstStillReady(source, lastReadyIds);

		if (stillReady === undefined) return;

		faults.raise({
			code: "empty-list",
			item: provider,
			cause: `${provider} listed no ready items, yet "${stillReady}" is still ready`,
			fix: "No item was marked gone; hum reads the list again on its next tick.",
		});

		throw new PermanentError(`${provider} returned an empty list that contradicts its last read`);
	};

	return {
		apiVersion: adapter.apiVersion,
		workSource: workSource && {
			listReady: async () => {
				const list = await retried(() => workSource.listReady(), ItemRef.array());

				if (list.length === 0) await refuseContradictingEmptyList(workSource);

				faults.clear(contradicted);
				lastReadyIds = list.map((ref) => ref.id);
				remembered?.save(lastReadyIds);

				return list;
			},
			read: (id) => retried(() => workSource.read(id), Item),
			claim: (id, holder, ttlMs) => retried(() => workSource.claim(id, holder, ttlMs), ClaimResult),
			renew: (id, holder, ttlMs) => retried(() => workSource.renew(id, holder, ttlMs), ClaimResult),
			comment: (id, text) => once(() => workSource.comment(id, text), none),
			fileFollowUp: (from, followUp) => retried(() => workSource.fileFollowUp(from, followUp), ItemRef),
			finish: (id) => retried(() => workSource.finish(id), none),
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
