import type { Card, Status } from "../../../hum-engine/src/status/format.ts";
import { blankRow, faultCardRows, noticeCardRows, questionCardRows, unreadCardRows } from "./cards.ts";
import { shownFaultGroups } from "./faults.ts";
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

/** Notice cards in the order the pane lists them, before the fault cards. */
const NOTICE_ORDER: readonly Card["kind"][] = ["waiting", "limited"];

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

const inFlightEntries = ({ open }: Status, now: number): ListEntry[] =>
	open
		.filter(({ running }) => running)
		.map(({ item, title = "", at, since }) => ({
			foldId: `in-flight:${item}`,
			item,
			title,
			meta: [span(at, "plain"), span(sinceText(since, now), "dim")],
		}));

const mergedEntries = ({ merged }: Status, now: number): ListEntry[] =>
	merged.map(({ item, title, level, mergedAt }) => ({
		foldId: `merged:${item}`,
		item,
		title,
		meta: [...(level === undefined ? [] : [span(level, "plain")]), span(sinceText(mergedAt, now), "dim")],
	}));

/** A choice's row: what was chosen, what came of its item and when; unfolded, why the run could choose alone and the files it touched. */
const choiceEntries = ({ choices }: Status, now: number): ListEntry[] =>
	choices.map(({ item, text, at, why, files = [], result }) => ({
		foldId: `choice:${item}:${at}`,
		item,
		title: text,
		meta: [...(result === undefined ? [] : [span(result, result === "merged" ? "plain" : "amber")]), span(sinceText(at, now), "dim")],
		detail: [...(why === undefined ? [] : [`Why: ${why}`]), ...(files.length === 0 ? [] : [`Files: ${files.join(", ")}`])],
	}));

const unreadBlocks = (input: ViewInput): Row[][] => {
	const reported = reportedUnread(input.unread, input);

	return reported === undefined ? [] : [unreadCardRows(reported, input)];
};

/** The cards, the unread read first, then question cards, then waiting and limited, then the fault cards not dismissed. */
const cardBlocks = (status: Status, input: ViewInput): Row[][] => [
	...unreadBlocks(input),
	...status.questions.map((question) => questionCardRows(question, input)),
	...NOTICE_ORDER.flatMap((kind) => status.cards.filter((card) => card.kind === kind).map((card) => noticeCardRows(card, input))),
	...shownFaultGroups(status, input.dismissed).map((group) => faultCardRows(group, input)),
];

/** The rows above the first card: the header's two lines. */
const headerRows = (status: Status, input: ViewInput): Row[] => [headerRow(status, input), measureRow(status.measure, input.width)];

/** The pane's blocks in order, split where an inline pane opens: the header and the first card lead, and a status file it cannot show leads with all it has. */
const blocksOf = (input: PaneInput) => {
	const { read, now, width } = input;

	if (read.kind !== "status") return { lead: [...unreadBlocks(input), wrap(problemWords(read), width).map((line): Row => [span(line, "amber")])], rest: [] };

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
