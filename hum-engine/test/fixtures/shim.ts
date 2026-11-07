import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHIM = join(import.meta.dir, "claude-shim.ts");

/** What one `-p` call does. */
export type Behavior = {
	/** Files to write and commit in the working directory. */
	commit?: Record<string, string>;
	/** A structured result. */
	structured?: unknown;
	plugins?: string[];
	keySource?: string;
	/** An error result with this text. */
	error?: string;
	/** A rate_limit_event that rejects, with `resetsAt` in epoch seconds. */
	rejectUntil?: number;
	/** One assistant message with this many output tokens, then the shim sleeps. */
	spend?: number;
	hang?: boolean;
	modelTokens?: number;
	/** A file the shim writes its stdin to. */
	saveStdin?: string;
	subtype?: string;
	/** Write `docs/<item>.md` and commit it, the item being the id in the prompt's `# Item <id>:` heading. */
	commitForItem?: boolean;
	/** Ask this question until the prompt carries the owner's answer, then finish. */
	askUnlessAnswered?: string;
	/** Sleep this long before the first assistant message. */
	beforeToken?: number;
	/** Sleep this long after it, so the run overlaps another. */
	sleep?: number;
};

export type ShimSpec = { version?: string; script?: Behavior[]; items?: Record<string, Behavior> };

export type Shim = {
	/** The executable the runner calls instead of `claude`. */
	readonly binary: string;
	/** Environment that makes the shim read `spec`. */
	readonly env: Record<string, string>;
	/** One entry per `-p` call, in order. */
	readonly calls: () => { at: number; itemId: string | undefined; argv: string[]; stdinBytes: number; stdinSha: string; pid: number; cwd: string }[];
	/** When each `-p` process wrote its result, by pid. */
	readonly ends: () => { pid: number; at: number }[];
};

const lines = (file: string) => {
	try {
		return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
	} catch {
		return [];
	}
};

/** A `claude` stand-in in a temp folder; nothing leaves it. */
export const makeShim = (spec: ShimSpec = {}): Shim => {
	const dir = mkdtempSync(join(tmpdir(), "hum-shim-"));
	const binary = join(dir, "claude");
	const log = join(dir, "calls.jsonl");

	writeFileSync(binary, `#!/bin/sh\nexec bun ${JSON.stringify(SHIM)} "$@"\n`);
	chmodSync(binary, 0o755);

	return {
		binary,
		env: { HUM_SHIM: JSON.stringify({ ...spec, log }) },
		calls: () => lines(log),
		ends: () => lines(`${log}.ends`),
	};
};
