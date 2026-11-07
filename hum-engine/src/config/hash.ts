import { createHash } from "node:crypto";
import type { Json } from "./json.ts";

const sortKeys = (value: Json): Json =>
	value !== null && !Array.isArray(value) && Object(value) === value
		? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
		: value;

/** SHA-256 of the JSON with object keys sorted at every depth, so key order never changes it. */
export const hashJson = (value: Json): string =>
	createHash("sha256")
		.update(JSON.stringify(value, (_key, inner: Json) => sortKeys(inner)))
		.digest("hex");
