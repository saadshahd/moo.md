import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type AnyActor, type AnyActorLogic } from "xstate";
import { restoreActor } from "xstate/persist";
import { Json } from "../config/json.ts";
import { migrateSnapshot } from "../config/state-map.ts";
import { kindMachine } from "../config/machine.ts";
import type { Kind } from "../config/schema.ts";
import { type Faults, type Outcome } from "./faults.ts";
import { atomicWrite, isMissing, listFiles, slug } from "./fs.ts";
import {
	compareVersions,
	ENGINE_VERSION,
	Envelope,
	EnvelopeJson,
	ENVELOPE_FORMAT,
	ENVELOPE_MIGRATIONS,
	type EnvelopeMigrations,
	Header,
	SavedHeader,
} from "./format.ts";

type ActorClock = NonNullable<Parameters<typeof restoreActor>[2]>["clock"];

/** What the engine writes and reads as the envelope; tests set another to play a different release. */
export type Codec = {
	readonly engineVersion?: string;
	readonly format?: number;
	readonly migrations?: EnvelopeMigrations;
};

export type RestoreOptions = {
	/** The earlier version of the kind, by machine version, for a snapshot saved under it. */
	readonly kindAt?: (machineVersion: string) => Kind | undefined;
	readonly sources?: Readonly<Record<string, AnyActorLogic>>;
	readonly clock?: ActorClock;
};

/** An item with a saved snapshot, from the envelope header. */
export type SavedSnapshot = {
	readonly itemId: string;
	readonly kind: string;
	readonly machineVersion: string;
	readonly savedAt: number;
	/** The machine's state, when it is a plain state name. */
	readonly state: string | undefined;
};

/** The snapshot of a running item actor, as the JSON `saveItem` writes. */
export const persistedSnapshot = (actor: AnyActor): Json => Json.parse(JSON.parse(JSON.stringify(actor.getPersistedSnapshot())));

const reason = (error: Error | string): string => (error instanceof Error ? error.message : error);

/** Per-item snapshots under `items/`. Every failure becomes one fault card; nothing is thrown for bad data. */
export class Items {
	readonly #folder: string;
	readonly #faults: Faults;
	readonly #now: () => number;
	readonly #engineVersion: string;
	readonly #format: number;
	readonly #migrations: EnvelopeMigrations;

	constructor(folder: string, faults: Faults, now: () => number, { engineVersion = ENGINE_VERSION, format = ENVELOPE_FORMAT, migrations = ENVELOPE_MIGRATIONS }: Codec = {}) {
		this.#folder = folder;
		this.#faults = faults;
		this.#now = now;
		this.#engineVersion = engineVersion;
		this.#format = format;
		this.#migrations = migrations;
	}

	path(itemId: string): string {
		return join(this.#folder, `${slug(itemId)}.json`);
	}

	/** D3: temp file, fsync, rename. A failed write leaves the old snapshot and raises one card. */
	save(itemId: string, kind: Kind, snapshot: Json): Outcome<void> {
		const key = `snapshot-write-failed:${itemId}`;
		const envelope = { format: this.#format, engineVersion: this.#engineVersion, itemId, kind: kind.machine.id, machineVersion: kind.machine.version, savedAt: this.#now(), snapshot };

		try {
			atomicWrite(this.path(itemId), `${JSON.stringify(envelope)}\n`);
		} catch (error) {
			return {
				ok: false,
				fault: this.#faults.raise({
					code: "snapshot-write-failed",
					item: itemId,
					cause: `The state of ${itemId} could not be saved: ${reason(error instanceof Error ? error : String(error))}. The last saved state is kept.`,
					fix: "Free disk space where hum keeps its state; the next change saves it again.",
				}),
			};
		}

		this.#faults.clear(key);

		return { ok: true, value: undefined };
	}

	/** The items with a saved snapshot, read from each envelope header. A damaged file is left to `restore`, which raises its card. */
	saved(): SavedSnapshot[] {
		return listFiles(this.#folder).flatMap((file) => {
			try {
				const header = SavedHeader.safeParse(JSON.parse(readFileSync(file, "utf8")));

				if (!header.success) return [];

				const { itemId, kind, machineVersion, savedAt, snapshot } = header.data;

				return [{ itemId, kind, machineVersion, savedAt, state: snapshot.value }];
			} catch {
				return [];
			}
		});
	}

	/** Removes an item's snapshot once the item has finished. */
	remove(itemId: string): void {
		rmSync(this.path(itemId), { force: true });
	}

	#fault(itemId: string, code: string, cause: string, fix: string): Outcome<never> {
		return { ok: false, fault: this.#faults.raise({ code, item: itemId, cause, fix }) };
	}

	/**
	 * D2, V10: reads the item's snapshot and restores its actor, not started. Returns `undefined`
	 * when nothing is saved. A snapshot that cannot be restored stays on disk, and the caller starts
	 * nothing for that item.
	 */
	async restore(itemId: string, kind: Kind, { kindAt, sources = {}, clock }: RestoreOptions = {}): Promise<Outcome<AnyActor | undefined>> {
		const file = this.path(itemId);
		let text: string;

		try {
			text = readFileSync(file, "utf8");
		} catch (error) {
			if (error instanceof Error && isMissing(error)) return { ok: true, value: undefined };

			return this.#fault(itemId, "snapshot-unreadable", `The saved state of ${itemId} at ${file} cannot be read: ${reason(error instanceof Error ? error : String(error))}.`, "Fix the file's permissions or restore it from a backup; the other items go on.");
		}

		const unreadable = (why: string) =>
			this.#fault(itemId, "snapshot-unreadable", `The saved state of ${itemId} at ${file} is damaged: ${why}.`, "Restore the file from a backup, or delete it to start the item over; the other items go on.");

		let parsed: Json;

		try {
			parsed = Json.parse(JSON.parse(text));
		} catch (error) {
			return unreadable(reason(error instanceof Error ? error : String(error)));
		}

		const header = Header.safeParse(parsed);

		if (!header.success) return unreadable("it has no format or engine version");

		const order = compareVersions(header.data.engineVersion, this.#engineVersion);

		if (header.data.format > this.#format || order === undefined || order > 0) {
			return this.#fault(itemId, "snapshot-from-newer-engine", `The saved state of ${itemId} was written by hum ${header.data.engineVersion}, which is newer than the running ${this.#engineVersion}.`, "Update the engine to that version or later: bun add --exact @moo.md/hum@latest.");
		}

		let envelopeJson = EnvelopeJson.parse(parsed);

		for (let at = header.data.format; at < this.#format; at++) {
			const step = this.#migrations[at];

			if (!step) throw new Error(`no envelope migration from format ${at}; the engine ships a gap`);
			envelopeJson = { ...step(envelopeJson), format: at + 1 };
		}

		const envelope = Envelope.safeParse(envelopeJson);

		if (!envelope.success) return unreadable(envelope.error.message);

		const { snapshot, machineVersion } = envelope.data;
		let current = snapshot;

		if (machineVersion !== kind.machine.version) {
			const previous = kindAt?.(machineVersion);

			if (!previous) {
				return this.#fault(itemId, "snapshot-machine-unknown", `${itemId} was saved under version ${machineVersion} of its machine, and this config holds no map from it.`, "Add a stateMap for that version to the kind file, or delete the item's saved state.");
			}

			try {
				current = await migrateSnapshot(previous, kind, snapshot, sources);
			} catch (error) {
				return this.#fault(itemId, "snapshot-restore-error", `${itemId} could not move from machine version ${machineVersion} to ${kind.machine.version}: ${reason(error instanceof Error ? error : String(error))}.`, "Map the state in the kind's stateMap, or delete the item's saved state.");
			}
		}

		try {
			// SAFETY: the snapshot is JSON the machine's own schema validates; xstate reports a bad one as an 'error' status, checked below.
			const restored = current as never;
			const actor = restoreActor(kindMachine(kind, sources), restored, clock ? { clock } : undefined);
			const status = actor.getSnapshot();

			if (status.status === "error") {
				return this.#fault(itemId, "snapshot-restore-error", `The saved state of ${itemId} does not restore: ${reason(status.error instanceof Error ? status.error : String(status.error))}.`, "Restore the file from a backup, or delete it to start the item over; the other items go on.");
			}

			return { ok: true, value: actor };
		} catch (error) {
			return this.#fault(itemId, "snapshot-restore-error", `The saved state of ${itemId} does not restore: ${reason(error instanceof Error ? error : String(error))}.`, "Restore the file from a backup, or delete it to start the item over; the other items go on.");
		}
	}
}
