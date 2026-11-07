import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHIM = join(import.meta.dir, "claude-shim.ts");

export type ShimSpec = { version?: string; script?: object[] };

export type Shim = {
	/** The executable the runner calls instead of `claude`. */
	readonly binary: string;
	/** Environment that makes the shim read `spec`. */
	readonly env: Record<string, string>;
	/** One entry per `-p` call, in order. */
	readonly calls: () => { argv: string[]; stdinBytes: number; stdinSha: string; pid: number; cwd: string }[];
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
		calls: () => {
			try {
				return readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
			} catch {
				return [];
			}
		},
	};
};
