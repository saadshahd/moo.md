import type { Card, Status } from "../../../hum-engine/src/status/format.ts";
import type { Unread } from "../../types";
import { blankRow, noticeCardRows, questionCardRows, unreadCardRows } from "./cards.ts";
import { reportedUnread, sinceText } from "./freshness.ts";
import { headerRow, measureRow } from "./header.ts";
import { type ListEntry, listRows } from "./lists.ts";
import type { ViewRead } from "./read.ts";
import { innerWidth, padded, type Row, span } from "./row.ts";
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
	/** A read of the work source that keeps failing; it shows as the first card once it is past the amber limit. */
	readonly unread?: Unread;
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

const unreadBlocks = (unread: Unread | undefined, now: number, amberAfterSeconds: number, width: number): Row[][] => {
	const reported = reportedUnread(unread, now, amberAfterSeconds);

	return reported === undefined ? [] : [unreadCardRows(reported, now, width)];
};

/** The cards, the unread read first, then question cards and then waiting, limited and fault. */
const cardBlocks = (status: Status, now: number, width: number, unreadFirst: readonly Row[][]): Row[][] => [
	...unreadFirst,
	...status.questions.map((question) => questionCardRows(question, now, width)),
	...NOTICE_ORDER.flatMap((kind) => status.cards.filter((card) => card.kind === kind).map((card) => noticeCardRows(card, now, width))),
];

/** The rows above the first card: the header's two lines. */
const headerRows = (status: Status, now: number, amberAfterSeconds: number, width: number): Row[] => [headerRow(status, now, amberAfterSeconds, width), measureRow(status.measure, width)];

/** The pane's blocks in order, split where an inline pane opens: the header and the first card lead, and a status file it cannot show leads with all it has. */
const blocksOf = (input: PaneInput): { readonly lead: Row[][]; readonly rest: Row[][] } => {
	const { read, now, amberAfterSeconds, width } = input;
	const unread = unreadBlocks(input.unread, now, amberAfterSeconds, width);

	if (read.kind !== "status") return { lead: [...unread, wrap(problemWords(read) ?? "Reading the status file.", width).map((line): Row => [span(line, "amber")])], rest: [] };

	const { status } = read;
	const [first = [], ...cards] = cardBlocks(status, now, width, unread);

	return {
		lead: [headerRows(status, now, amberAfterSeconds, width), first],
		rest: [
			...cards,
			listSection("in flight", inFlightEntries(status, now), input),
			listSection("merged", mergedEntries(status, now), input),
			listSection("choices made without you", choiceEntries(status, now), input),
		],
	};
};

const innerBlocksOf = (input: PaneInput) => blocksOf({ ...input, width: innerWidth(input.width) });

/** The whole pane: header, then question cards, notice cards, in flight, merged, and choices made without the owner; each row has its padding. */
export const paneRows = (input: PaneInput): Row[] => {
	const { lead, rest } = innerBlocksOf(input);

	return separated([...lead, ...rest]).map(padded);
};

/** The rows an inline pane opens with: the header and the first card, so its buttons are in view. */
export const openingRows = (read: ViewRead, now: number, amberAfterSeconds: number, width: number, unread?: Unread): number =>
	separated(innerBlocksOf({ read, now, amberAfterSeconds, width, unfolded: new Set(), unread }).lead).length;
