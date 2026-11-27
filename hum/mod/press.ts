import type { EngineInterface } from "claude-code";
import { runHum } from "./hum.ts";
import { displayId } from "./item.ts";
import { failureOf, humSays } from "./says.ts";
import { openingRows } from "./view/pane.ts";
import type { ViewInput } from "./view/input.ts";
import type { Press, Request } from "./view/row.ts";

type Engine = EngineInterface;

const PANE_TITLE = "hum";

/** What a press needs of the drawing it came from; the clock is read when the press lands. */
export type PressContext = Omit<ViewInput, "now">;

/** The cells an inline pane's frame takes from the band's width: its border and one cell of its own padding at each side. */
const INLINE_FRAME_CELLS = 4;

/** Opens `url` with the system's opener, as the roundup App takes its own links; a failure says why. */
export async function openLink($: Engine, url: string): Promise<void> {
	const opened = await $.process.run(["open", url]);

	if (opened.exitCode !== 0) throw new Error(`hum could not open ${url}: ${opened.stderr.trim() || `open exited ${opened.exitCode}`}`);
}

/** What the owner asked hum to do, as the toast that confirms it says it. */
const ASKED = {
	skip: (step: string) => `asked to skip ${step}`,
	"run-now": (step: string) => `asked to run ${step}'s timer now`,
} as const satisfies Record<Request, (step: string) => string>;

/** Asks the repo's hum to make the owner's request at the item's step, and says it was asked; the worker checks it again before it acts. A refusal says why. */
export async function askHum($: Engine, root: string, { request, item, step }: Extract<Press, { readonly kind: "request" }>): Promise<void> {
	const ran = await runHum($, root, [request, item, step]);

	if (ran.exitCode !== 0) throw new Error(failureOf(ran));

	$.ui.toast(humSays(`${displayId(item)}: ${ASKED[request](step)}`));
}

/** Opens the pane as tall as its header and first card need at the width the inline pane will have, so the first card's buttons are in view. */
export async function openPane($: Engine, pane: string, context: PressContext): Promise<void> {
	const rows = openingRows({ ...context, now: await $.clock.now(), width: Math.max(0, context.width - INLINE_FRAME_CELLS) });

	await $.ui.open({ id: pane, title: PANE_TITLE, rows });
}
