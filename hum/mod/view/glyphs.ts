/** The only glyphs the view draws. Each one's cell count is the one `string-width` gives and a capture of the terminal confirmed. */
export const GLYPHS = {
	separator: "·",
	ellipsis: "…",
	rule: "─",
} as const;

export const SEPARATOR = ` ${GLYPHS.separator} `;
