import { ellipsize, rowCells } from "./cells.ts";
import { SEPARATOR } from "./glyphs.ts";
import { type Row, type Span, span } from "./row.ts";

/** Parts side by side, a dim separator between each. */
export const joinParts = (parts: readonly Span[]): Row => parts.flatMap((part, index) => (index === 0 ? [part] : [span(SEPARATOR, "dim"), part]));

/** The first candidate that fits; when none does, the last one with its first part cut to the room. One row, never wrapped. */
export const firstFitting = (candidates: readonly Row[], width: number): Row => {
	const fitting = candidates.find((candidate) => rowCells(candidate) <= width);

	if (fitting !== undefined) return fitting;

	const [first] = candidates.at(-1) ?? [];

	return first === undefined ? [] : [span(ellipsize(first.text, width), first.tone, first.press)];
};

/** The parts joined, then the same with one part fewer from the end, down to the first alone. */
export const droppingFromEnd = (parts: readonly Span[]): Row[] => parts.map((_, index) => joinParts(parts.slice(0, parts.length - index)));
