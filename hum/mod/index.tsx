import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import { guardAnswer } from "./answer/guard.ts";
import { answeringLabel, changedBox, editedBox, fillAnswer, isAnswering, restartAnswer, submitted } from "./answer/mode.ts";
import { drawRows } from "./draw.tsx";
import { type PressContext, openPane } from "./press.ts";
import { viewSettings } from "./settings.ts";
import { bandRow } from "./view/band.ts";
import { paneRows } from "./view/pane.ts";
import { readOf } from "./view/read.ts";
import type { Press } from "./view/row.ts";
import { locate, newWatch, poll, repoRoot, watchOnce } from "./watch.ts";

const MS = 1000;
const PANE = "hum";

/* oxlint-disable anti-slop/no-shape-in-symbol-names -- `shape` is the engine's option name for a stored value's version tag */
const source = atom({ plugin: "hum", key: "source" } as const, { kind: "waiting" }, { shape: "source-1" });

const unfolded = atom({ plugin: "hum", key: "unfolded" } as const, [], { shape: "unfolded-1" });

const unread = atom({ plugin: "hum", key: "unread" } as const, null, { shape: "unread-1" });
/* oxlint-enable anti-slop/no-shape-in-symbol-names */

const toggled = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id]);

const pressed = ($: EngineInterface, context: PressContext) => async (press: Press): Promise<void> => {
	switch (press.kind) {
		case "fold":
			await update($, unfolded, (ids) => toggled(ids, press.id));
			break;
		case "fill":
			await fillAnswer($, press.item, press.word);
			break;
		case "open":
			await openPane($, PANE, context);
	}
};

/** A failure outside answer mode shows once and the event passes on. */
const showOnce = ($: EngineInterface) => (error: Error): void => $.ui.toast(`hum: ${error.message}`);

export const register: Register = (on, options) => {
	const { pollSeconds, amberAfterSeconds, watchSeconds } = viewSettings(options);
	const watch = newWatch();

	on("session.start", async ($, e, next) => {
		if (!e.isInteractive) return next(e);

		await restartAnswer($);
		watch.path = await locate($, e.cwd);
		watch.root = await repoRoot($, e.cwd);

		const look = async (): Promise<void> => {
			const found = await poll($, watch, amberAfterSeconds);

			if (found !== undefined) await update($, source, () => found);
		};

		const ask = async (): Promise<void> => {
			const cause = await watchOnce($, watch.root);
			const now = await $.clock.now();

			await update($, unread, (before) => (cause === undefined ? null : { cause, since: before?.since ?? now }));
		};

		await Promise.all([look(), ask()]);
		$.clock.every(pollSeconds * MS, () => void look());
		$.clock.every(watchSeconds * MS, () => void ask());

		return next(e);
	});

	on("prompt.submit", ($, e, next) =>
		guardAnswer({
			isAnswering: () => isAnswering($),
			decide: () => submitted($, watch.root, e.origin.kind, e.text),
			pass: () => next(e),
			drop: (reason) => ({ drop: reason }),
			show: (message) => $.ui.toast(message),
		}),
	);

	on("prompt.edit", async ($, e, next) => {
		const box = await next(e);

		await editedBox($, box.text).catch(showOnce($));

		return box;
	});

	on("prompt.change", async ($, e, next) => {
		await changedBox($, e.origin.kind, e.text).catch(showOnce($));

		return next(e);
	});

	on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
		const below = await next(e);

		if (e.props.hasSurvey) return below;

		const view = readOf(await read($, source));

		const row = bandRow({
			read: view,
			now: await $.clock.now(),
			amberAfterSeconds,
			width: e.props.bodyColumns,
			answering: await answeringLabel($),
			unread: (await read($, unread)) ?? undefined,
		});

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
