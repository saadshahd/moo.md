export type Tone = "plain" | "dim" | "strong" | "amber";

/** What pressing a span does. */
export type Press =
	| { readonly kind: "run"; readonly command: string }
	| { readonly kind: "fold"; readonly id: string }
	| { readonly kind: "open" };

export type Span = { readonly text: string; readonly tone: Tone; readonly press?: Press };

/** One line of the view. The drawing makes one box per row and never takes a width of its own. */
export type Row = readonly Span[];

export const span = (text: string, tone: Tone = "plain", press?: Press): Span => ({ text, tone, press });
