import type { ItemRow, OpenItem, PadLink, Status } from "../../../hum-engine/src/status/format.ts";
import { displayId } from "../item.ts";
import { button } from "./buttons.ts";
import type { Labeled } from "./cards.ts";
import { cells, ellipsize, spaces } from "./cells.ts";
import { GLYPHS } from "./glyphs.ts";
import { type Press, type Row, type Tone, span } from "./row.ts";

/** The label of every control that opens a row or Pad in the roundup App. */
export const OPEN = `open ${GLYPHS.link}`;

const COLUMN_GAP = 2;

const ROW_MARK = "▸ ";

/** The press that opens `link` in the roundup App. */
export const opening = ({ link }: Pick<ItemRow | PadLink, "link">): Press => ({ kind: "link", url: link });

/** Where the owner answers an item: in the prompt, or, for an item on roundup, only in the row that asks it, which may be none yet. */
export type AnswerPlace = { readonly kind: "prompt" } | { readonly kind: "row"; readonly row?: ItemRow };

/** Where an item answers off roundup. */
export const IN_PROMPT: AnswerPlace = { kind: "prompt" };

/** The prompt, unless the item's runs are roundup rows: then the newest row that asks it. */
export const answerPlaceOf = ({ open, questions }: Pick<Status, "open" | "questions">, item: string): AnswerPlace =>
	open.find((found) => found.item === item)?.rows === undefined ? IN_PROMPT : { kind: "row", row: questions.findLast((question) => question.item === item && question.row !== undefined)?.row };

/** The buttons that answer an item where it answers: `fills` in the prompt, else the one that opens the asking row, or none while no row asks. */
export const answeringButtons = (place: AnswerPlace, fills: readonly Labeled[]): Labeled[] => {
	if (place.kind === "prompt") return [...fills];

	return place.row === undefined ? [] : [{ label: OPEN, press: opening(place.row) }];
};

/** One line: `text`, cut to leave room, then the control that opens `linked` at the right end. */
const linkRow = (text: string, tone: Tone, linked: Pick<ItemRow | PadLink, "link">, width: number): Row => {
	const control = button({ label: OPEN, press: opening(linked), isPrimary: false });
	const shown = ellipsize(text, Math.max(1, width - cells(control.text) - COLUMN_GAP));

	return [span(shown, tone), span(spaces(width - cells(shown) - cells(control.text)), "plain"), control];
};

/** What a row is called under its item, as hum names its runs `hum <id> <label>`. */
const labelOf = (item: string, { name }: ItemRow): string => name.replace(`hum ${item} `, "");

/** A line per row of an item's Workstream: its label and its Status in two columns, then the control that opens it. */
export const runRows = (item: string, rows: readonly ItemRow[], width: number): Row[] => {
	const column = Math.max(0, ...rows.map((row) => cells(labelOf(item, row))));

	return rows.map((row) => {
		const label = labelOf(item, row);

		return linkRow(`${ROW_MARK}${label}${spaces(column - cells(label) + COLUMN_GAP)}${row.state}`, "plain", row, width);
	});
};

/** The line that opens the item's handoff Pad. */
export const handoffRow = (handoff: PadLink, width: number): Row => linkRow(`handoff: Pad "${handoff.name}"`, "dim", handoff, width);

/** What the item's title line names: the item and its title, the step it is in, and whether it waits on the owner there. */
export const itemTitle = ({ item, title, at, steps }: OpenItem): string[] => [
	title === undefined ? displayId(item) : `${displayId(item)} ${title}`,
	at,
	...(steps.some(({ name, waitsOnOwner }) => name === at && waitsOnOwner) ? ["waiting on you"] : []),
];
