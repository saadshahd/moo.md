import * as v from "valibot";
import { ok, err } from "../../primitives/index.ts";
import type { Result } from "../../primitives/index.ts";

const BiomeSchema = v.object({
  id: v.string(),
  color: v.number(),
  movementCost: v.number(),
});

const WorldParamsSchema = v.object({
  ticksPerSeason: v.number(),
  seasonsPerYear: v.number(),
  traitSigma: v.number(),
  faunaCount: v.number(),
  baseRegenRate: v.number(),
  baseMovementCost: v.number(),
});

export type Biome = v.InferOutput<typeof BiomeSchema>;
export type WorldParams = v.InferOutput<typeof WorldParamsSchema>;

type LoadError =
  | { tag: "fetch_error"; message: string }
  | { tag: "parse_error"; message: string };

const loadJson = async (path: string): Promise<Result<unknown, LoadError>> => {
  try {
    const res = await fetch(path);
    if (!res.ok)
      return err({ tag: "fetch_error", message: `${res.status} ${path}` });
    return ok(await res.json());
  } catch (e) {
    return err({ tag: "fetch_error", message: String(e) });
  }
};

export const Mods = {
  loadBiomes: async (): Promise<Result<readonly Biome[], LoadError>> => {
    const raw = await loadJson("/data/biomes.json");
    if (raw.isErr()) return err(raw.error);
    const parsed = v.safeParse(v.array(BiomeSchema), raw.value);
    return parsed.success
      ? ok(parsed.output)
      : err({ tag: "parse_error", message: "biomes.json invalid" });
  },

  loadWorldParams: async (): Promise<Result<WorldParams, LoadError>> => {
    const raw = await loadJson("/data/world_params.json");
    if (raw.isErr()) return err(raw.error);
    const result = v.safeParse(WorldParamsSchema, raw.value);
    return result.success
      ? ok(result.output)
      : err({ tag: "parse_error", message: "world_params.json invalid" });
  },
} as const;
