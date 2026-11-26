import type { ServedSource } from "../../types";
import { STATUS_FORMAT, Status } from "../vendor/libs.js";

/** What the view knows about the status file: a format it does not read is unsupported, and its own format in another shape is unreadable. */
export type ViewRead =
	| { readonly kind: "status"; readonly status: Status }
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

type GitPlaces = { readonly cwd: string; readonly commonDir: string };

/** hum's state folder: in the repo's git common dir, as the engine's default, so every worktree of the repo shares it. */
const stateFolderOf = ({ cwd, commonDir }: GitPlaces): string => {
	const absolute = commonDir.startsWith("/") ? commonDir : `${cwd}/${commonDir}`;

	return `${absolute.replace(/\/\.?$/, "")}/hum`;
};

/** The status file the engine writes. */
export const statusPathOf = (git: GitPlaces): string => `${stateFolderOf(git)}/status.json`;

/** The pane's own file beside the status file: the fault cards dismissed in any pane on the repo. The engine never reads it. */
export const dismissedPathOf = (git: GitPlaces): string => `${stateFolderOf(git)}/pane-dismissed.json`;

export const readOf = (source: ServedSource): ViewRead => {
	switch (source.kind) {
		case "failed":
			return { kind: "unreadable", message: source.message };
		case "text":
			return parseStatus(source.text);
	}
};
