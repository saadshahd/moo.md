import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { atomicWrite, isMissing, listFiles, slug } from "./fs.ts";

/** One JSON file per key under a folder, written whole by temp file and rename (D3). The schema checks every read. */
export class Records<S extends z.ZodType> {
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
		try {
			return this.#schema.parse(
				JSON.parse(readFileSync(this.#path(key), "utf8")),
			);
		} catch (error) {
			if (error instanceof Error && isMissing(error)) return undefined;

			throw error;
		}
	}

	put(key: string, value: z.input<S>): void {
		atomicWrite(
			this.#path(key),
			`${JSON.stringify(this.#schema.parse(value))}\n`,
		);
	}

	remove(key: string): void {
		rmSync(this.#path(key), { force: true });
	}

	list(): z.output<S>[] {
		return listFiles(this.#folder).map((file) =>
			this.#schema.parse(JSON.parse(readFileSync(file, "utf8"))),
		);
	}
}
