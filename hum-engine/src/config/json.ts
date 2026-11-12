import { z } from "zod";

/** Any JSON value; the type of config read from disk before it is parsed. */
export const Json = z.json();

export type Json = z.infer<typeof Json>;
