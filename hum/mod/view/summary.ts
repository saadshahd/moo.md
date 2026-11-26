import type { Status } from "../../../hum-engine/src/status/format.ts";
import type { Dismissal } from "../../types";
import { shownFaultGroups } from "./faults.ts";
import type { ViewRead } from "./read.ts";

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

const cardsOf = (status: Status, kind: Status["cards"][number]["kind"]): number => status.cards.filter((card) => card.kind === kind).length;

/** Which count names the engine's state, most pressing first. The first with something in it speaks. */
const STATE_WORDS: readonly { readonly count: (status: Status, dismissed: readonly Dismissal[]) => number; readonly words: (count: number) => string }[] = [
	{ count: (status) => status.questions.length, words: (count) => `${count} ${count === 1 ? "needs" : "need"} you` },
	{ count: (status, dismissed) => shownFaultGroups(status, dismissed).length, words: (count) => plural(count, "fault") },
	{ count: (status) => cardsOf(status, "limited"), words: () => "limited" },
	{ count: (status) => cardsOf(status, "waiting"), words: (count) => `${count} waiting` },
	{ count: (status) => status.inFlight.length, words: (count) => `${count} running` },
];

const IDLE = "idle";

/** At most 34 cells, the room the band gives its status. Faults count as the pane shows them. */
export const statusWords = (read: ViewRead, dismissed: readonly Dismissal[]): string => {
	switch (read.kind) {
		case "unreadable":
			return "status unreadable";
		case "unsupported":
			return `status format ${read.format}`;
		case "status": {
			const found = STATE_WORDS.map(({ count, words }) => ({ n: count(read.status, dismissed), words })).find(({ n }) => n > 0);

			return found === undefined ? IDLE : found.words(found.n);
		}
	}
};

/** The cause the pane names under its header when the status file cannot be shown. */
export const problemWords = (read: Exclude<ViewRead, { readonly kind: "status" }>): string => {
	switch (read.kind) {
		case "unreadable":
			return `The status file cannot be read: ${read.message}`;
		case "unsupported":
			return `The status file is format ${read.format}; this view reads another. Update the plugin or the engine so they match.`;
		default:
			return read satisfies never;
	}
};
