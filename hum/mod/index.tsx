import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import { drawRows } from "./draw.tsx";
import { type PressContext, openPane, runAction } from "./press.ts";
import { viewSettings } from "./settings.ts";
import { bandRow } from "./view/band.ts";
import { paneRows } from "./view/pane.ts";
import { readOf } from "./view/read.ts";
import type { Press } from "./view/row.ts";
import { locate, newWatch, poll } from "./watch.ts";

const MS = 1000;
const PANE = "hum";

/* oxlint-disable anti-slop/no-shape-in-symbol-names -- `shape` is the engine's option name for a stored value's version tag */
const source = atom({ plugin: "hum", key: "source" } as const, { kind: "waiting" }, { shape: "source-1" });

const unfolded = atom({ plugin: "hum", key: "unfolded" } as const, [], { shape: "unfolded-1" });
/* oxlint-enable anti-slop/no-shape-in-symbol-names */

const toggled = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id]);

const pressed = ($: EngineInterface, context: PressContext) => async (press: Press): Promise<void> => {
	if (press.kind === "fold") {
		await update($, unfolded, (ids) => toggled(ids, press.id));
	} else if (press.kind === "run") await runAction($, press.command);
	else await openPane($, PANE, context);
};

export const register: Register = (on, options) => {
	const { pollSeconds, amberAfterSeconds } = viewSettings(options);
	const watch = newWatch();

	on("session.start", async ($, e, next) => {
		if (!e.isInteractive) return next(e);

		watch.path = await locate($, e.cwd);

		const look = async (): Promise<void> => {
			const found = await poll($, watch, amberAfterSeconds);

			if (found !== undefined) await update($, source, () => found);
		};

		await look();
		$.clock.every(pollSeconds * MS, () => void look());

		return next(e);
	});

	on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
		const below = await next(e);

		if (e.props.hasSurvey) return below;

		const view = readOf(await read($, source));
		const row = bandRow({ read: view, now: await $.clock.now(), amberAfterSeconds, width: e.props.bodyColumns });
		const tags = $.ui.resolve(e);
		const { Box } = tags;

		watch.lastRead = view;

		return (
			<Box flexDirection="column">
				{drawRows(tags, [row], pressed($, { width: e.props.bodyColumns, amberAfterSeconds, read: view }))}
				{below}
			</Box>
		);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const view = readOf(await read($, source));
		const rows = paneRows({ read: view, now: await $.clock.now(), amberAfterSeconds, width: e.props.bodyColumns, unfolded: new Set(await read($, unfolded)) });

		return drawRows($.ui.resolve(e), rows, pressed($, { width: e.props.bodyColumns, amberAfterSeconds, read: view }));
	});
};
