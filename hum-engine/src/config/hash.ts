import { createHash } from "node:crypto";
import stringify from "safe-stable-stringify";
import type { Json } from "./json.ts";

/** SHA-256 of the JSON with object keys sorted at every depth, so key order never changes it. */
export const hashJson = (value: Json): string => createHash("sha256").update(stringify(value)).digest("hex");
