import type { EngineInterface } from "claude-code";
import type { Unread } from "../types";
import { openingRows } from "./view/pane.ts";
import type { ViewRead } from "./view/read.ts";

type Engine = EngineInterface;

const PANE_TITLE = "hum";

export type PressContext = { readonly width: number; readonly amberAfterSeconds: number; readonly read: ViewRead; readonly unread?: Unread };

/** The cells an inline pane's frame takes from the band's width: its border and one cell of its own padding at each side. */
export const INLINE_FRAME_CELLS = 4;

/** Opens the pane as tall as its header and first card need at the width the inline pane will have, so the first card's buttons are in view. */
export async function openPane($: Engine, pane: string, context: PressContext): Promise<void> {
	const rows = openingRows(context.read, await $.clock.now(), context.amberAfterSeconds, Math.max(0, context.width - INLINE_FRAME_CELLS), context.unread);

	await $.ui.open({ id: pane, title: PANE_TITLE, rows });
}
