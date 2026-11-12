import type { Status } from "../../../hum-engine/src/status/format.ts";
import type { ViewSource } from "../../types";
import { STATUS_FORMAT } from "../vendor/libs.js";

/** What the view knows about the status file. The engine validates every write, so the view checks only the format number. */
export type ViewRead =
	| { readonly kind: "waiting" }
	| { readonly kind: "status"; readonly status: Status }
	| { readonly kind: "missing"; readonly path: string }
	| { readonly kind: "unreadable"; readonly message: string }
	| { readonly kind: "unsupported"; readonly format: number | string };

type Formatted = { readonly format?: number | string };

const isStatus = (value: Formatted | null): value is Status => value?.format === STATUS_FORMAT;

export const parseStatus = (text: string): ViewRead => {
	try {
		const parsed: Formatted | null = JSON.parse(text);

		return isStatus(parsed) ? { kind: "status", status: parsed } : { kind: "unsupported", format: parsed?.format ?? "none" };
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
