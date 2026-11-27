import type { ItemRow, OpenItem, PadLink } from "../../../hum-engine/src/status/format.ts";
import { displayId } from "../item.ts";
import { button } from "./buttons.ts";
import { cells, ellipsize, spaces } from "./cells.ts";
import { GLYPHS } from "./glyphs.ts";
import { type Press, type Row, type Tone, span } from "./row.ts";

/** The label of every control that opens a row or Pad in the roundup App. */
export const OPEN = `open ${GLYPHS.link}`;

const COLUMN_GAP = 2;

const ROW_MARK = "▸ ";

/** The press that opens `link` in the roundup App. */
export const opening = ({ link }: Pick<ItemRow | PadLink, "link">): Press => ({ kind: "link", url: link });

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
