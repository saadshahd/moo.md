import type { EngineInterface } from "claude-code";
import { openingRows } from "./view/pane.ts";
import type { ViewRead } from "./view/read.ts";

type Engine = EngineInterface;

const PANE_TITLE = "hum";
const REPO_ENGINE = "./node_modules/.bin/hum";

export type PressContext = { readonly width: number; readonly amberAfterSeconds: number; readonly read: ViewRead };


/** A card's action runs the repo's pinned hum, never the plugin's copy, because the two update apart. */
export async function runAction($: Engine, command: string): Promise<void> {
	const [, ...args] = command.split(" ");
	const ran = await $.process.run([REPO_ENGINE, ...args]);

	if (ran.exitCode !== 0) $.ui.toast(`${command} failed: ${ran.stderr.trim()}`);
}

/** Opens the pane as tall as its header and first card need, so the first card's buttons are in view. */
export async function openPane($: Engine, pane: string, context: PressContext): Promise<void> {
	const rows = openingRows(context.read, await $.clock.now(), context.amberAfterSeconds, context.width);

	await $.ui.open({ id: pane, title: PANE_TITLE, rows });
}
