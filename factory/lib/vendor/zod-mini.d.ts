/**
 * The zod/mini exports the factory uses. `bun run vendor` bundles exactly these into
 * zod-mini.js, because a mod can import no npm package; types come from the pinned `zod`.
 * Name only functions here: Bun writes zod's namespace exports (`z`, `core`) without a
 * declaration, and the engine refuses to load the bundle.
 */
export {
  array,
  boolean,
  codec,
  encode,
  int,
  literal,
  maxLength,
  minimum,
  minLength,
  nullable,
  number,
  object,
  optional,
  parse,
  record,
  regex,
  safeDecode,
  safeParse,
  string,
  union,
} from "zod/mini";
export type { infer, ZodMiniType } from "zod/mini";
