import type { EngineInterface } from "claude-code";
import { openingRows } from "./view/pane.ts";
import type { ViewInput } from "./view/input.ts";

type Engine = EngineInterface;

const PANE_TITLE = "hum";

/** What a press needs of the drawing it came from; the clock is read when the press lands. */
export type PressContext = Omit<ViewInput, "now">;

/** The cells an inline pane's frame takes from the band's width: its border and one cell of its own padding at each side. */
export const INLINE_FRAME_CELLS = 4;

/** Opens the pane as tall as its header and first card need at the width the inline pane will have, so the first card's buttons are in view. */
export async function openPane($: Engine, pane: string, context: PressContext): Promise<void> {
	const rows = openingRows({ ...context, now: await $.clock.now(), width: Math.max(0, context.width - INLINE_FRAME_CELLS) });

	await $.ui.open({ id: pane, title: PANE_TITLE, rows });
}
