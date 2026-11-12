import { cells, ellipsize, rowCells, spaces, wrap } from "./cells.ts";
import { displayId } from "../item.ts";
import { droppingFromEnd, fitting } from "./fit.ts";
import { type Row, type Span, span } from "./row.ts";

/** Under this many cells a title has no room beside its id and metadata, so it goes under them. */
export const MIN_TITLE_CELLS = 12;
const COLUMN_GAP = 2;

export type ListEntry = {
	/** What a press on this row folds or unfolds. */
	readonly foldId: string;
	readonly item: string;
	readonly title: string;
	/** Metadata parts, dropped from the end when short. */
	readonly meta: readonly Span[];
};

/**
 * One line per entry: id, title, metadata. A title that does not fit ends in "…" and pressing the row shows it whole.
 * Where the title would get under 12 cells it goes under the id instead, and an unfolded row always does.
 */
export const listRows = (entry: ListEntry, isUnfolded: boolean, width: number): Row[] => {
	const id = ellipsize(displayId(entry.item), width);
	const press = { kind: "fold", id: entry.foldId } as const;
	const meta = fitting(droppingFromEnd(entry.meta), width - cells(id) - COLUMN_GAP) ?? [];
	const room = width - cells(id) - rowCells(meta) - 2 * COLUMN_GAP;
	const isStacked = isUnfolded || room < MIN_TITLE_CELLS;

	if (!isStacked) {
		const title = ellipsize(entry.title, room);

		return [[span(id, "strong", press), span(spaces(COLUMN_GAP), "plain"), span(title, "plain", title === entry.title ? undefined : press), span(spaces(room - cells(title) + COLUMN_GAP), "plain"), ...meta]];
	}

	const head: Row = [span(id, "strong", press), span(spaces(width - cells(id) - rowCells(meta)), "plain"), ...meta];

	if (isUnfolded) return [head, ...wrap(entry.title, width).map((line) => [span(line, "plain", press)])];

	const title = ellipsize(entry.title, width);

	return [head, [span(title, "plain", title === entry.title ? undefined : press)]];
};
