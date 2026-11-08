import PQueue from "p-queue";
import type { Adapter } from "../adapter-api.ts";

// SAFETY: every member of an integration role is an async method; each is replaced by one with the same signature.
const inOrder = <R extends object>(role: R | undefined, queue: PQueue): R | undefined =>
	role && (Object.fromEntries(Object.entries(role).map(([name, member]) => [name, member instanceof Function ? (...args: unknown[]) => queue.add(async () => member.apply(role, args)) : member])) as R);

/**
 * Runs an adapter's calls one at a time. Runs that go side by side share one adapter, and an adapter
 * that keeps a clone, as the markdown source does, must not take two writes into it at once.
 */
export const serialized = (adapter: Adapter): Adapter => {
	const queue = new PQueue({ concurrency: 1 });

	return {
		apiVersion: adapter.apiVersion,
		workSource: inOrder(adapter.workSource, queue),
		questions: inOrder(adapter.questions, queue),
		answers: inOrder(adapter.answers, queue),
		release: inOrder(adapter.release, queue),
	};
};
