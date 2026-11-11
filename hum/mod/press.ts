import type { EngineInterface, ProcessRunResult } from "claude-code";
import type { Unread } from "../types";
import { openingRows } from "./view/pane.ts";
import type { ViewRead } from "./view/read.ts";

type Engine = EngineInterface;

const PANE_TITLE = "hum";
const REPO_ENGINE = "node_modules/.bin/hum";

export type PressContext = { readonly width: number; readonly amberAfterSeconds: number; readonly read: ViewRead; readonly unread?: Unread };

/** Runs the repo's pinned hum at the repo's root, never the plugin's copy, because the two update apart. */
export async function runHum($: Engine, root: string, args: readonly string[], { timeoutMs }: { readonly timeoutMs?: number } = {}): Promise<ProcessRunResult> {
	return $.process.run([`${root}/${REPO_ENGINE}`, ...args], { cwd: root, timeoutMs });
}

/** What a failed hum said, without its own `hum <op>:` lead. */
export const failureOf = (ran: Pick<ProcessRunResult, "exitCode" | "stderr">): string => ran.stderr.trim().replace(/^hum [\w-]+: /, "") || `exited ${ran.exitCode}`;

/** The cells an inline pane's frame takes from the band's width: its border and one cell of its own padding at each side. */
export const INLINE_FRAME_CELLS = 4;

/** Opens the pane as tall as its header and first card need at the width the inline pane will have, so the first card's buttons are in view. */
export async function openPane($: Engine, pane: string, context: PressContext): Promise<void> {
	const rows = openingRows(context.read, await $.clock.now(), context.amberAfterSeconds, Math.max(0, context.width - INLINE_FRAME_CELLS), context.unread);

	await $.ui.open({ id: pane, title: PANE_TITLE, rows });
}
