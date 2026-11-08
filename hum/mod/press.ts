import type { EngineInterface, ProcessRunResult } from "claude-code";
import { openingRows } from "./view/pane.ts";
import type { ViewRead } from "./view/read.ts";

type Engine = EngineInterface;

const PANE_TITLE = "hum";
const REPO_ENGINE = "node_modules/.bin/hum";

export type PressContext = { readonly width: number; readonly amberAfterSeconds: number; readonly read: ViewRead };

/** Runs the repo's pinned hum at the repo's root, never the plugin's copy, because the two update apart. */
export async function runHum($: Engine, root: string, args: readonly string[]): Promise<ProcessRunResult> {
	return $.process.run([`${root}/${REPO_ENGINE}`, ...args], { cwd: root });
}

/** What a failed hum said, without its own `hum <op>:` lead. */
export const failureOf = (ran: Pick<ProcessRunResult, "exitCode" | "stderr">): string => ran.stderr.trim().replace(/^hum [\w-]+: /, "") || `exited ${ran.exitCode}`;

/** Opens the pane as tall as its header and first card need, so the first card's buttons are in view. */
export async function openPane($: Engine, pane: string, context: PressContext): Promise<void> {
	const rows = openingRows(context.read, await $.clock.now(), context.amberAfterSeconds, context.width);

	await $.ui.open({ id: pane, title: PANE_TITLE, rows });
}
