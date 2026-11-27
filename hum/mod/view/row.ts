import type { Dismissal } from "../../types";
import { plain, spaces } from "./cells.ts";

/** `filled` is a label between two cap glyphs: the caps in the accent colour and the label on it. */
export type Tone = "plain" | "dim" | "strong" | "amber" | "accent" | "success" | "filled";

/** What the owner may ask hum to do at the step an item is at, by the `hum` command that asks it. */
export const REQUESTS = ["skip", "run-now"] as const;

export type Request = (typeof REQUESTS)[number];

/** What pressing a span does. */
export type Press =
	| { readonly kind: "fold"; readonly id: string }
	| { readonly kind: "fill"; readonly item: string; readonly word: string }
	| { readonly kind: "open" }
	| { readonly kind: "link"; readonly url: string }
	| { readonly kind: "dismiss"; readonly cards: readonly Dismissal[] }
	| { readonly kind: "note"; readonly item: string; readonly step: string }
	| { readonly kind: "request"; readonly request: Request; readonly item: string; readonly step: string };

/** A picker of the steps a note to the item may go to; picking one presses a note to it. Its text is what it draws. */
export type NotePick = { readonly label: string; readonly item: string; readonly steps: readonly string[] };

export type Span = { readonly text: string; readonly tone: Tone; readonly press?: Press; readonly pick?: NotePick };

/** One line of the view. The drawing makes one box per row and never takes a width of its own. */
export type Row = readonly Span[];

export const span = (text: string, tone: Tone = "plain", press?: Press): Span => ({ text: plain(text), tone, press });

/** The empty cells at each side of every row the view draws. */
const PADDING = 1;

/** The width a row's content has inside the padding. */
export const innerWidth = (width: number): number => Math.max(0, width - 2 * PADDING);

/** The row with its padding; its content was made for `innerWidth` of the surface's width. */
export const padded = (row: Row): Row => [span(spaces(PADDING)), ...row, span(spaces(PADDING))];
