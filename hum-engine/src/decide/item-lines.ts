/** The paths an item's body lists on a `<label>: a, b` line, split at commas and spaces; none where it has no such line. */
export const listedPaths = (body: string, label: string): string[] =>
	new RegExp(`^${label}:[ \\t]*(.+)$`, "im")
		.exec(body)?.[1]
		?.split(/[,\s]+/)
		.filter(Boolean) ?? [];
