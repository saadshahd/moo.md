import { z } from "zod";

/** Any JSON value; the type of config read from disk before it is parsed. */
export const Json = z.json();

export type Json = z.infer<typeof Json>;

/** A value as the JSON it saves: what `JSON.stringify` writes, checked as Json on the way back. Undefined, which saves nothing, does not type-check. */
export const asJson = (value: NonNullable<unknown>): Json => Json.parse(JSON.parse(JSON.stringify(value)));
