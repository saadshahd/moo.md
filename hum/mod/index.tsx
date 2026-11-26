import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import { guardAnswer } from "./answer/guard.ts";
import { answeringLabel, changedBox, editedBox, fillAnswer, isAnswering, post, restartAnswer, routeEnter } from "./answer/mode.ts";
import type { Dismissal } from "../types";
import { dismiss, lookDismissed, NOTHING_DISMISSED_SEEN } from "./dismissed.ts";
import { drawRows } from "./draw.tsx";
import { humSays } from "./says.ts";
import { type PressContext, openPane } from "./press.ts";
import { viewSettings } from "./settings.ts";
import { bandRow } from "./view/band.ts";
import type { ViewInput } from "./view/input.ts";
import { paneRows } from "./view/pane.ts";
import { readOf } from "./view/read.ts";
import type { Press } from "./view/row.ts";
import { exclusive, locate, NOTHING_SEEN, poll, repoRoot, UNSERVED, watchOnce } from "./watch.ts";

const MS = 1000;
const PANE = "hum";

/* oxlint-disable anti-slop/no-shape-in-symbol-names -- `shape` is the engine's option name for a stored value's version tag */
const source = atom({ plugin: "hum", key: "source" } as const, UNSERVED, { shape: "source-2" });

const unfolded = atom({ plugin: "hum", key: "unfolded" } as const, [], { shape: "unfolded-1" });

const unread = atom({ plugin: "hum", key: "unread" } as const, null, { shape: "unread-1" });

const dismissed = atom({ plugin: "hum", key: "dismissed" } as const, null, { shape: "dismissed-1" });
/* oxlint-enable anti-slop/no-shape-in-symbol-names */

const toggled = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id]);

/** A failure outside answer mode shows once and the event passes on. */
const showOnce = ($: EngineInterface) => (error: Error): void => $.ui.toast(humSays(error.message));

/** Dismisses `cards` in every pane on the repo this session serves; the status the pressed drawing showed decides which dismissals stay. */
const dismissCards = async ($: EngineInterface, cards: readonly Dismissal[], { read: shown }: PressContext): Promise<void> => {
	const known = await read($, dismissed);

	if (known === null || shown.kind !== "status") throw new Error("this session shows no status to dismiss cards from");

	const kept = await dismiss($, known.path, cards, shown.status.cards);

	await update($, dismissed, () => ({ path: known.path, cards: kept }));
};

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
			break;
		case "dismiss":
			await dismissCards($, press.cards, context).catch(showOnce($));
			break;
		default:
			return press satisfies never;
	}
};

/** What a drawing starts from, read as it is drawn; nothing where hum does not serve. */
async function viewInput($: EngineInterface, drawing: Pick<ViewInput, "width" | "amberAfterSeconds">): Promise<ViewInput | undefined> {
	const found = await read($, source);

	if (found.kind === "unserved") return undefined;

	return { ...drawing, read: readOf(found), now: await $.clock.now(), unread: (await read($, unread)) ?? undefined, dismissed: (await read($, dismissed))?.cards ?? [] };
}

export const register: Register = (on, options) => {
	const { pollSeconds, amberAfterSeconds, watchSeconds } = viewSettings(options);

	on("session.start", async ($, e, next) => {
		if (!e.isInteractive) return next(e);

		await restartAnswer($);

		const place = await locate($, e.cwd);

		if (place === undefined) return next(e);

		let seen = NOTHING_SEEN;
		let dismissedSeen = NOTHING_DISMISSED_SEEN;

		const lookAtDismissed = async (): Promise<void> => {
			const { found, seen: after } = await lookDismissed($, place.dismissedPath, dismissedSeen);

			dismissedSeen = after;

			if (found === undefined) return;

			if (found instanceof Error) showOnce($)(found);

			await update($, dismissed, () => ({ path: place.dismissedPath, cards: found instanceof Error ? [] : found }));
		};

		const look = async (): Promise<void> => {
			await lookAtDismissed();

			const wasServed = seen.kind === "served";
			const { found, seen: after } = await poll($, place, seen, amberAfterSeconds);

			seen = after;

			if (found === undefined) return;

			await update($, source, () => found);

			if (wasServed && after.kind === "unserved") await $.ui.close({ id: PANE });
		};

		const ask = async (): Promise<void> => {
			const cause = seen.kind === "served" ? await watchOnce($, place.root) : undefined;
			const now = await $.clock.now();

			await update($, unread, (before) => (cause === undefined ? null : { cause, since: before?.since ?? now }));
		};

		const asking = exclusive(ask);

		await look();
		asking();
		$.clock.every(pollSeconds * MS, exclusive(look));
		$.clock.every(watchSeconds * MS, asking);

		return next(e);
	});

	on("prompt.submit", ($, e, next) =>
		guardAnswer({
			isAnswering: () => isAnswering($),
			decide: async () => {
				const { decision, toPost } = await routeEnter($, e.origin.kind, e.text);

				if (toPost !== undefined) post($, () => $.session.cwd().then((cwd) => repoRoot($, cwd)), toPost).catch(showOnce($));

				return decision;
			},
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
		await changedBox($, { origin: e.origin.kind, box: e.text }).catch(showOnce($));

		return next(e);
	});

	on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
		const below = await next(e);

		if (e.props.hasSurvey) return below;

		const input = await viewInput($, { width: e.props.bodyColumns, amberAfterSeconds });

		if (input === undefined) return below;

		const row = bandRow({ ...input, answering: await answeringLabel($) });

		const tags = $.ui.resolve(e);
		const { Box } = tags;

		return (
			<Box flexDirection="column">
				{drawRows(tags, [row], pressed($, input))}
				{below}
			</Box>
		);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const tags = $.ui.resolve(e);
		const input = await viewInput($, { width: e.props.bodyColumns, amberAfterSeconds });

		if (input === undefined) return <tags.Box />;

		const rows = paneRows({ ...input, unfolded: new Set(await read($, unfolded)) });

		return drawRows(tags, rows, pressed($, input));
	});
};
