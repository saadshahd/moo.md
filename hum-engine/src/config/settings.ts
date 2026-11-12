import { join } from "node:path";
import type { z } from "zod";
import { orMissing, readJson } from "../state/fs.ts";

/** The settings `schema` names, read from the repo's `.hum/hum.json`. A repo with no `hum.json` gets the schema's own defaults. Throws when the file is unreadable or a value is refused. */
export const readSettings = <S extends z.ZodType>(repo: string, schema: S): z.output<S> => schema.parse(orMissing(() => readJson(join(repo, ".hum", "hum.json")), {}));
