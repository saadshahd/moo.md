import type { Card, Status } from "../../../hum-engine/src/status/format.ts";
import { blankRow, noticeCardRows, questionCardRows, unreadCardRows } from "./cards.ts";
import { reportedUnread, sinceText } from "./freshness.ts";
import { headerRow, measureRow } from "./header.ts";
import type { ViewInput } from "./input.ts";
import { type ListEntry, listRows } from "./lists.ts";
import { innerWidth, padded, type Row, span } from "./row.ts";
import { problemWords } from "./summary.ts";
import { wrap } from "./cells.ts";

type PaneInput = ViewInput & {
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
		entries.flatMap((entry) => listRows(entry, { isUnfolded: input.unfolded.has(entry.foldId), width: input.width })),
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

const unreadBlocks = (input: ViewInput): Row[][] => {
	const reported = reportedUnread(input.unread, input);

	return reported === undefined ? [] : [unreadCardRows(reported, input)];
};

/** The cards, the unread read first, then question cards and then waiting, limited and fault. */
const cardBlocks = (status: Status, input: ViewInput): Row[][] => [
	...unreadBlocks(input),
	...status.questions.map((question) => questionCardRows(question, input)),
	...NOTICE_ORDER.flatMap((kind) => status.cards.filter((card) => card.kind === kind).map((card) => noticeCardRows(card, input))),
];

/** The rows above the first card: the header's two lines. */
const headerRows = (status: Status, input: ViewInput): Row[] => [headerRow(status, input), measureRow(status.measure, input.width)];

/** The pane's blocks in order, split where an inline pane opens: the header and the first card lead, and a status file it cannot show leads with all it has. */
const blocksOf = (input: PaneInput): { readonly lead: Row[][]; readonly rest: Row[][] } => {
	const { read, now, width } = input;

	if (read.kind !== "status") return { lead: [...unreadBlocks(input), wrap(problemWords(read) ?? "Reading the status file.", width).map((line): Row => [span(line, "amber")])], rest: [] };

	const { status } = read;
	const [first = [], ...cards] = cardBlocks(status, input);

	return {
		lead: [headerRows(status, input), first],
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
export const openingRows = (input: ViewInput): number => separated(innerBlocksOf({ ...input, unfolded: new Set() }).lead).length;
