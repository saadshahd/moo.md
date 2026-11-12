import type { EngineInterface, ProcessRunResult } from "claude-code";

const REPO_ENGINE = "node_modules/.bin/hum";

/** Runs the repo's pinned hum at the repo's root, never the plugin's copy, because the two update apart. */
export async function runHum($: EngineInterface, root: string, args: readonly string[], { timeoutMs }: { readonly timeoutMs?: number } = {}): Promise<ProcessRunResult> {
	return $.process.run([`${root}/${REPO_ENGINE}`, ...args], { cwd: root, timeoutMs });
}
