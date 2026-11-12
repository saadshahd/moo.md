import type { ViewSource } from "../../types";
import { STATUS_FORMAT, Status } from "../vendor/libs.js";

/** What the view knows about the status file: a format it does not read is unsupported, and its own format in another shape is unreadable. */
export type ViewRead =
	| { readonly kind: "waiting" }
	| { readonly kind: "status"; readonly status: Status }
	| { readonly kind: "missing"; readonly path: string }
	| { readonly kind: "unreadable"; readonly message: string }
	| { readonly kind: "unsupported"; readonly format: number | string };

type Formatted = { readonly format?: number | string };

const readFormatted = (parsed: Formatted | null): ViewRead => {
	if (parsed?.format !== STATUS_FORMAT) return { kind: "unsupported", format: parsed?.format ?? "none" };

	const checked = Status.safeParse(parsed);

	return checked.success ? { kind: "status", status: checked.data } : { kind: "unreadable", message: checked.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`).join("; ") };
};

export const parseStatus = (text: string): ViewRead => {
	try {
		return readFormatted(JSON.parse(text));
	} catch (error) {
		return { kind: "unreadable", message: error instanceof Error ? error.message : "the status file cannot be parsed" };
	}
};

/** The status file's place: the repo's git common dir, as the engine's default state folder. */
export const statusPathOf = (cwd: string, commonDir: string): string => {
	const absolute = commonDir.startsWith("/") ? commonDir : `${cwd}/${commonDir}`;

	return `${absolute.replace(/\/\.?$/, "")}/hum/status.json`;
};

export const readOf = (source: ViewSource): ViewRead => {
	switch (source.kind) {
		case "waiting":
			return { kind: "waiting" };
		case "missing":
			return { kind: "missing", path: source.path };
		case "failed":
			return { kind: "unreadable", message: source.message };
		case "text":
			return parseStatus(source.text);
	}
};
