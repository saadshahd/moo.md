import PQueue from "p-queue";
import type { Integrations } from "../adapter-api.ts";
import { eachCall } from "./each-call.ts";

const inOrder = <R extends object>(role: R | undefined, queue: PQueue): R | undefined => role && eachCall<R, R>(role, (call) => async (...args) => queue.add(async () => call(...args)));

/**
 * Runs an adapter's calls one at a time. Runs that go side by side share one adapter, and an adapter
 * that keeps a clone, as the markdown source does, must not take two writes into it at once.
 */
export const serialized = (adapter: Integrations): Integrations => {
	const queue = new PQueue({ concurrency: 1 });

	return {
		apiVersion: adapter.apiVersion,
		workSource: inOrder(adapter.workSource, queue),
		questions: inOrder(adapter.questions, queue),
		answers: inOrder(adapter.answers, queue),
		release: inOrder(adapter.release, queue),
	};
};
