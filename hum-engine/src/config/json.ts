import { z } from "zod";

/** Any JSON value; the type of config read from disk before it is parsed. */
export const Json = z.json();

export type Json = z.infer<typeof Json>;

/** A value as the JSON it saves: what `JSON.stringify` writes, checked as Json on the way back. */
export const asJson = (value: Parameters<typeof JSON.stringify>[0]): Json => Json.parse(JSON.parse(JSON.stringify(value)));
