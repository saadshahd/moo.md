import { readFileSync } from "node:fs";
import { atomicWrite, isMissing, orMissing } from "../state/fs.ts";
import { emptyStatus, Heartbeat, Status } from "./format.ts";

export type StatusRead =
	| { readonly ok: true; readonly status: Status }
	| { readonly ok: false; readonly reason: "missing" | "unreadable"; readonly message: string };

/** The engine's one write of the status file. Validates first, then writes atomically, so no reader sees a part. */
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

/** The worker's one write of its heartbeat each tick. */
export const writeHeartbeat = (path: string, heartbeat: Heartbeat): void => {
	atomicWrite(path, `${JSON.stringify(Heartbeat.parse(heartbeat))}\n`);
};

export const readHeartbeat = (path: string): Heartbeat | undefined => {
	return orMissing(() => {
		const parsed = Heartbeat.safeParse(JSON.parse(readFileSync(path, "utf8")));

		return parsed.success ? parsed.data : undefined;
	}, undefined);
};

/**
 * The service unit's write of the fault cards while no worker writes them. The status file's other fields
 * stay as they were, `writtenAt` included, so a dead worker still reads as stale.
 */
export const writeCards = (path: string, cards: Status["cards"], engineVersion: string, now: number): void => {
	const read = readStatus(path);

	writeStatus(path, { ...(read.ok ? read.status : emptyStatus(engineVersion, now)), cards });
};
