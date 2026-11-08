import { cells, ellipsize, rowCells, spaces } from "./cells.ts";
import { type Press, type Row, type Span, span } from "./row.ts";

export const BUTTON_GAP = 2;

/** `[ label ]`; the primary action is filled, which pads it by one cell on each side. */
export const button = (label: string, press: Press, isPrimary: boolean): Span => span(isPrimary ? `[  ${label}  ]` : `[ ${label} ]`, "strong", press);

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
