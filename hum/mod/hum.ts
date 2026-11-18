import type { EngineInterface, ProcessRunResult } from "claude-code";

const REPO_ENGINE = "node_modules/.bin/hum";

/** The repo's pinned hum, never the plugin's copy, because the two update apart. */
export const engineAt = (root: string): string => `${root}/${REPO_ENGINE}`;

/** Runs the repo's pinned hum at the repo's root. */
export async function runHum($: EngineInterface, root: string, args: readonly string[], { timeoutMs }: { readonly timeoutMs?: number } = {}): Promise<ProcessRunResult> {
	return $.process.run([engineAt(root), ...args], { cwd: root, timeoutMs });
}
