import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./config.ts";

const NAME = "holding";

/** The `integrations` that put the holding adapter in every slot it serves. */
export const HOLDING_SLOTS = { "work-source": NAME, questions: NAME, answers: NAME };

/** How long a hum process that should exit gets before a test counts it as held open. */
export const HELD_MS = 10_000;

/**
 * Writes an owner adapter into `repo` that holds the process open from the moment it is built until `close`, as
 * roundup's socket client does, and lists nothing ready.
 */
export const writeHoldingAdapter = (repo: string): void => {
	mkdirSync(join(repo, "adapters"), { recursive: true });
	writeFileSync(
		join(repo, "adapters", `${NAME}.ts`),
		`import { ADAPTER_API_VERSION } from ${JSON.stringify(join(root, "src", "adapter-api.ts"))};

const none = async () => {
	throw new Error("the holding adapter has no items");
};

export default () => {
	const held = setInterval(() => {}, 60_000);

	return {
		apiVersion: ADAPTER_API_VERSION,
		workSource: { listReady: async () => [], listClaimed: async () => [], read: none, claim: none, renew: none, comment: none, fileFollowUp: none, finish: none },
		questions: { ask: none, decide: none },
		answers: { answer: none, watch: async () => ({ token: "", changed: false }) },
		close: async () => clearInterval(held),
	};
};
`,
	);
};
