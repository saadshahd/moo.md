import { readFileSync } from "node:fs";
import { ADAPTER_API_VERSION } from "../adapter-api.ts";
import { SCHEMA_VERSION } from "../config/schema.ts";
import { atomicWrite, isMissing, orMissing, readJson } from "../state/fs.ts";
import { doneByIn } from "../state/item-log.ts";
import type { State } from "../state/open.ts";
import { CARD_EXCERPT, Heartbeat, Status, STATUS_FORMAT } from "./format.ts";
import { Looked, type WaitFacts, Waits, waitsOf } from "./waits.ts";

/** A status with nothing in it, stamped with the engine that wrote it. */
export const emptyStatus = (engineVersion: string, writtenAt: number): Status => ({
	format: STATUS_FORMAT,
	writtenAt,
	workers: {},
	engine: { version: engineVersion, adapterApi: ADAPTER_API_VERSION, configSchema: SCHEMA_VERSION },
	questions: [],
	cards: [],
	open: [],
	merged: [],
	choices: [],
	rules: [],
	possibleRepeats: [],
	unusedMemory: [],
	measure: null,
});

export type StatusRead =
	| { readonly ok: true; readonly status: Status }
	| { readonly ok: false; readonly reason: "missing" | "unreadable"; readonly message: string };

/** The engine's one write of the status file. Validates first, then writes atomically, so no reader sees a part. */
export const writeStatus = (path: string, status: Status): void => {
	atomicWrite(path, `${JSON.stringify(Status.parse(status))}\n`);
};

/** Where the status file and the waits beside it live, and the saved facts the waits read beside the status. */
export type StatusPlaces = Pick<State, "statusPath" | "waitsPath" | "lookedPath" | "faults" | "parked" | "landings" | "merges" | "events">;

/** When the owner last looked at the changes merged without them, where a look was marked. */
const readLooked = (path: string): number | undefined => orMissing(() => Looked.parse(readJson(path)).at, undefined);

const waitFactsOf = ({ parked, landings, merges, events, lookedPath }: StatusPlaces): WaitFacts => ({
	parked: parked.list(),
	landings: landings.list(),
	merges: merges.list().map(({ item, at }) => ({ at, doneBy: doneByIn(events, item) })),
	looked: readLooked(lookedPath),
	answered: events.newestOwnerAnswer(),
});

/** The card for waits hum could not build; the status file still goes out with it, and the waits file keeps its last good list. */
export const WAITS_CODE = "waits-unbuilt";

const builtWaits = (places: StatusPlaces, status: Status): string | Error => {
	try {
		return `${JSON.stringify(Waits.parse(waitsOf(status, waitFactsOf(places), status.writtenAt)))}\n`;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}
};

/**
 * Writes the status file with the raised cards, then the waits built from it, so the two say the same. Waits hum
 * cannot build raise one card in the status instead, so a damaged file the waits read never stops the status.
 */
export const publishStatus = (places: StatusPlaces, status: Omit<Status, "cards">): void => {
	const { faults } = places;
	const waits = builtWaits(places, { ...status, cards: faults.list() });

	if (waits instanceof Error) faults.raise({ code: WAITS_CODE, cause: `hum could not build the list of what waits on you: ${waits.message}`.slice(0, CARD_EXCERPT), fix: "hum builds it again at its next write; look at the cause if this card stays." });
	else faults.clear({ code: WAITS_CODE });

	writeStatus(places.statusPath, { ...status, cards: faults.list() });

	if (!(waits instanceof Error)) atomicWrite(places.waitsPath, waits);
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
export const writeCards = (places: StatusPlaces, engineVersion: string, now: number): void => {
	const read = readStatus(places.statusPath);

	publishStatus(places, read.ok ? read.status : emptyStatus(engineVersion, now));
};
