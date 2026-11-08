import type { Card, Status } from "../../../hum-engine/src/status/format.ts";
import { blankRow, noticeCardRows, questionCardRows } from "./cards.ts";
import { headerRow, measureRow } from "./header.ts";
import { type ListEntry, listRows, sinceText } from "./lists.ts";
import type { ViewRead } from "./read.ts";
import { type Row, span } from "./row.ts";
import { problemWords } from "./summary.ts";
import { wrap } from "./cells.ts";

export type PaneInput = {
	readonly read: ViewRead;
	readonly now: number;
	readonly amberAfterSeconds: number;
	/** The width the surface gives the body. */
	readonly width: number;
	/** The ids of the list rows the owner unfolded. */
	readonly unfolded: ReadonlySet<string>;
};

/** Notice cards in the order the pane lists them. */
const NOTICE_ORDER: readonly Card["kind"][] = ["waiting", "limited", "fault"];

const separated = (blocks: readonly (readonly Row[])[]): Row[] => blocks.filter((block) => block.length > 0).flatMap((block, index) => (index === 0 ? [...block] : [blankRow(), ...block]));

const section = (title: string, count: number, rows: readonly Row[], width: number): Row[] =>
	count === 0 ? [] : [...wrap(`${title} (${count})`, width).map((line): Row => [span(line, "strong")]), ...rows];

const listSection = (title: string, entries: readonly ListEntry[], input: PaneInput): Row[] =>
	section(
		title,
		entries.length,
		entries.flatMap((entry) => listRows(entry, input.unfolded.has(entry.foldId), input.width)),
		input.width,
	);

const inFlightEntries = ({ inFlight }: Status, now: number): ListEntry[] =>
	inFlight.map(({ item, title, level, state, since, unclear }) => ({
		foldId: `in-flight:${item}`,
		item,
		title,
		meta: [span([level, unclear ? "unclear" : undefined].flatMap((word) => word ?? []).join(" "), unclear ? "amber" : "plain"), span(state, "plain"), span(sinceText(since, now), "dim")].filter(({ text }) => text !== ""),
	}));

const mergedEntries = ({ merged }: Status, now: number): ListEntry[] =>
	merged.map(({ item, title, level, mergedAt }) => ({
		foldId: `merged:${item}`,
		item,
		title,
		meta: [...(level === undefined ? [] : [span(level, "plain")]), span(sinceText(mergedAt, now), "dim")],
	}));

const choiceEntries = ({ choices }: Status, now: number): ListEntry[] =>
	choices.map(({ item, text, at }) => ({ foldId: `choice:${item}:${at}`, item, title: text, meta: [span(sinceText(at, now), "dim")] }));

/** The cards, question cards first and then waiting, limited and fault. */
const cardBlocks = (status: Status, now: number, width: number): Row[][] => [
	...status.questions.map((question) => questionCardRows(question, now, width)),
	...NOTICE_ORDER.flatMap((kind) => status.cards.filter((card) => card.kind === kind).map((card) => noticeCardRows(card, now, width))),
];

/** The rows above the first card: the header's two lines and a blank. */
export const headerRows = (status: Status, now: number, amberAfterSeconds: number, width: number): Row[] => [headerRow(status, now, amberAfterSeconds, width), measureRow(status.measure, width)];

/** The whole pane: header, then question cards, notice cards, in flight, merged, and choices made without the owner. */
export const paneRows = (input: PaneInput): Row[] => {
	const { read, now, amberAfterSeconds, width } = input;

	if (read.kind !== "status") return wrap(problemWords(read) ?? "Reading the status file.", width).map((line) => [span(line, "amber")]);

	const { status } = read;

	return separated([
		headerRows(status, now, amberAfterSeconds, width),
		...cardBlocks(status, now, width),
		listSection("in flight", inFlightEntries(status, now), input),
		listSection("merged", mergedEntries(status, now), input),
		listSection("choices made without you", choiceEntries(status, now), input),
	]);
};

/** The rows an inline pane opens with: the header and the first card, so its buttons are in view. */
export const openingRows = (read: ViewRead, now: number, amberAfterSeconds: number, width: number): number => {
	if (read.kind !== "status") return paneRows({ read, now, amberAfterSeconds, width, unfolded: new Set() }).length;

	const first = cardBlocks(read.status, now, width)[0] ?? [];

	return headerRows(read.status, now, amberAfterSeconds, width).length + (first.length === 0 ? 0 : first.length + 1);
};

