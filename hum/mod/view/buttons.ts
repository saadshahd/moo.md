import { cells, ellipsize, rowCells, spaces } from "./cells.ts";
import { GLYPHS } from "./glyphs.ts";
import { type Press, type Row, type Span, span } from "./row.ts";

export const BUTTON_GAP = 2;

/** The primary action is filled and capped, `▐ label ▌`; any other is its label in dim text, one cell clear on each side. */
export const button = (label: string, press: Press, isPrimary: boolean): Span =>
	isPrimary ? span(`${GLYPHS.capLeft} ${label} ${GLYPHS.capRight}`, "filled", press) : span(` ${label} `, "dim", press);

/**
 * Buttons whole, right-aligned and two cells apart. A button that does not fit the rest of the row starts a new row,
 * so no label is ever cut unless it alone is wider than the line.
 */
export const buttonRows = (buttons: readonly Span[], width: number): Row[] => {
	const lines: Span[][] = [];

	for (const next of buttons) {
		const line = lines.at(-1);
		const fits = line !== undefined && rowCells(line) + BUTTON_GAP + cells(next.text) <= width;
		const whole = cells(next.text) <= width ? next : span(ellipsize(next.text, width), next.tone, next.press);

		if (line !== undefined && fits) line.push(span(spaces(BUTTON_GAP), "plain"), whole);
		else lines.push([whole]);
	}

	return lines.map((line) => [span(spaces(width - rowCells(line)), "plain"), ...line]);
};
