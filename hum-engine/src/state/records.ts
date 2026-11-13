import { join } from "node:path";
import { rmSync } from "node:fs";
import { z } from "zod";
import { atomicWrite, listRecords, orMissing, readJson, slug } from "./fs.ts";

/** One JSON file per key under a folder, written whole. The schema checks every read. */
export class Records<S extends z.core.$ZodType> {
	readonly #folder: string;
	readonly #schema: S;

	constructor(folder: string, schema: S) {
		this.#folder = folder;
		this.#schema = schema;
	}

	#path(key: string): string {
		return join(this.#folder, `${slug(key)}.json`);
	}

	get(key: string): z.output<S> | undefined {
		return orMissing(() => z.parse(this.#schema, readJson(this.#path(key))), undefined);
	}

	put(key: string, value: z.input<S>): void {
		atomicWrite(this.#path(key), `${JSON.stringify(z.parse(this.#schema, value))}\n`);
	}

	/** Copies the record at `key` into another store of its kind, as its schema reads it, where this one has it. */
	copyTo(into: Records<S>, key: string): void {
		const record = this.get(key);

		if (record !== undefined) atomicWrite(into.#path(key), `${JSON.stringify(record)}\n`);
	}

	remove(key: string): void {
		rmSync(this.#path(key), { force: true });
	}

	list(): z.output<S>[] {
		return listRecords(this.#folder).map((file) => z.parse(this.#schema, readJson(file)));
	}
}
