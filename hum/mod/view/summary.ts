import type { Status } from "../../../hum-engine/src/status/format.ts";
import type { ViewRead } from "./read.ts";

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

const cardsOf = (status: Status, kind: Status["cards"][number]["kind"]): number => status.cards.filter((card) => card.kind === kind).length;

/** Which count names the engine's state, most pressing first. The first with something in it speaks. */
const STATE_WORDS: readonly { readonly count: (status: Status) => number; readonly words: (count: number) => string }[] = [
	{ count: (status) => status.questions.length, words: (count) => `${count} ${count === 1 ? "needs" : "need"} you` },
	{ count: (status) => cardsOf(status, "fault"), words: (count) => plural(count, "fault") },
	{ count: (status) => cardsOf(status, "limited"), words: () => "limited" },
	{ count: (status) => cardsOf(status, "waiting"), words: (count) => `${count} waiting` },
	{ count: (status) => status.inFlight.length, words: (count) => `${count} running` },
];

const IDLE = "idle";

/** At most 34 cells, the room the band gives its status. */
export const statusWords = (read: ViewRead): string => {
	switch (read.kind) {
		case "waiting":
			return "reading status";
		case "missing":
			return "no status yet";
		case "unreadable":
			return "status unreadable";
		case "unsupported":
			return `status format ${read.format}`;
		case "status": {
			const found = STATE_WORDS.map(({ count, words }) => ({ n: count(read.status), words })).find(({ n }) => n > 0);

			return found === undefined ? IDLE : found.words(found.n);
		}
	}
};

/** The cause the pane names under its header when the status file cannot be shown. */
export const problemWords = (read: ViewRead): string | undefined => {
	switch (read.kind) {
		case "missing":
			return `${read.path} does not exist. Start the worker with hum serve, or run hum work once.`;
		case "unreadable":
			return `The status file cannot be read: ${read.message}`;
		case "unsupported":
			return `The status file is format ${read.format}; this view reads another. Update the plugin or the engine so they match.`;
		default:
			return undefined;
	}
};
