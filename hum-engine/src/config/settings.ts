import { join } from "node:path";
import type { z } from "zod";
import { orMissing, readJson } from "../state/fs.ts";
import { migrateConfig } from "./migrate.ts";

/**
 * The settings `schema` names, read from the repo's `.hum/hum.json` after it is migrated to the schema version this
 * engine runs. A repo with no `hum.json` gets the schema's own defaults. Throws when the file is unreadable, its
 * schema version is one this engine does not read, or a value is refused.
 */
export const readSettings = <S extends z.ZodType>(repo: string, schema: S): z.output<S> => {
	const raw = orMissing(() => readJson(join(repo, ".hum", "hum.json")), undefined);

	if (raw === undefined) return schema.parse({});

	const migrated = migrateConfig(raw);

	if (!migrated.ok) throw new Error(migrated.refusal.message);

	return schema.parse(migrated.value);
};
