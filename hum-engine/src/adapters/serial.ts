import pLimit from "p-limit";
import type { Adapter } from "../adapter-api.ts";

type Queue = <T>(call: () => Promise<T>) => Promise<T>;

// SAFETY: every member of an integration role is an async method; each is replaced by one with the same signature.
const inOrder = <R extends object>(role: R | undefined, run: Queue): R | undefined =>
	role && (Object.fromEntries(Object.entries(role).map(([name, member]) => [name, member instanceof Function ? (...args: unknown[]) => run(async () => member.apply(role, args)) : member])) as R);

/**
 * Runs an adapter's calls one at a time. Runs that go side by side share one adapter, and an adapter
 * that keeps a clone (the markdown source) must not take two writes into it at once.
 */
export const serialized = (adapter: Adapter): Adapter => {
	const run: Queue = pLimit(1);

	return {
		apiVersion: adapter.apiVersion,
		workSource: inOrder(adapter.workSource, run),
		questions: inOrder(adapter.questions, run),
		answers: inOrder(adapter.answers, run),
		release: inOrder(adapter.release, run),
	};
};
