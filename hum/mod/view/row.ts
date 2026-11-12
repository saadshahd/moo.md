import { plain, spaces } from "./cells.ts";

/** `filled` is a label between two cap glyphs: the caps in the accent colour and the label on it. */
export type Tone = "plain" | "dim" | "strong" | "amber" | "filled";

/** What pressing a span does. */
export type Press =
	| { readonly kind: "fold"; readonly id: string }
	| { readonly kind: "fill"; readonly item: string; readonly word: string }
	| { readonly kind: "open" };

export type Span = { readonly text: string; readonly tone: Tone; readonly press?: Press };

/** One line of the view. The drawing makes one box per row and never takes a width of its own. */
export type Row = readonly Span[];

export const span = (text: string, tone: Tone = "plain", press?: Press): Span => ({ text: plain(text), tone, press });

/** The empty cells at each side of every row the view draws. */
const PADDING = 1;

/** The width a row's content has inside the padding. */
export const innerWidth = (width: number): number => Math.max(0, width - 2 * PADDING);

/** The row with its padding; its content was made for `innerWidth` of the surface's width. */
export const padded = (row: Row): Row => [span(spaces(PADDING)), ...row, span(spaces(PADDING))];
