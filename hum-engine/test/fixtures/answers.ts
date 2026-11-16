import type { RunOutcome } from "../../src/adapters/claude-p.ts";
import type { Json } from "../../src/config/json.ts";

/** A run that finished and answered `structured`, as `claude -p` reports one. */
export const finished = (structured: Json): RunOutcome => ({
	kind: "finished",
	subtype: "success",
	isError: false,
	sessionId: undefined,
	text: "",
	structured,
	tokens: 10,
	cacheReadTokens: 0,
	plugins: [],
	keySource: undefined,
	models: ["claude-sonnet-5-5"],
});
