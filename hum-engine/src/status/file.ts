import { readFileSync } from "node:fs";
import { atomicWrite, isMissing } from "../state/fs.ts";
import { Status } from "./format.ts";

export type StatusRead =
	| { readonly ok: true; readonly status: Status }
	| { readonly ok: false; readonly reason: "missing" | "unreadable"; readonly message: string };

/** U1: the engine's one write of the status file. Validates first, then temp file and rename, so no reader sees a part. */
export const writeStatus = (path: string, status: Status): void => {
	atomicWrite(path, `${JSON.stringify(Status.parse(status))}\n`);
};

export const readStatus = (path: string): StatusRead => {
	try {
		const parsed = Status.safeParse(JSON.parse(readFileSync(path, "utf8")));

		return parsed.success
			? { ok: true, status: parsed.data }
			: { ok: false, reason: "unreadable", message: `${path} does not hold a status file this engine reads: ${parsed.error.message}` };
	} catch (error) {
		if (error instanceof Error && isMissing(error)) return { ok: false, reason: "missing", message: `${path} does not exist` };

		return { ok: false, reason: "unreadable", message: `${path} cannot be read: ${error instanceof Error ? error.message : "unknown error"}` };
	}
};
