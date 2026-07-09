import { describe, it, expect } from "vitest";
import { Terrain, BIOME_ID } from "../../src/world/terrain/index.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../../src/primitives/index.ts";

describe("Terrain.generate", () => {
  it("returns elevation and biomeId Uint8Arrays of correct size", () => {
    const t = Terrain.generate(42);
    expect(t.elevation).toBeInstanceOf(Uint8Array);
    expect(t.biomeId).toBeInstanceOf(Uint8Array);
    expect(t.elevation.length).toBe(WORLD_WIDTH * WORLD_HEIGHT);
    expect(t.biomeId.length).toBe(WORLD_WIDTH * WORLD_HEIGHT);
  });

  it("produces all three biomes (not a flat world)", () => {
    const t = Terrain.generate(42);
    const ids = new Set(t.biomeId);
    expect(ids.has(BIOME_ID.water)).toBe(true);
    expect(ids.has(BIOME_ID.land)).toBe(true);
    expect(ids.has(BIOME_ID.mountain)).toBe(true);
  });

  it("biomeId values are always valid BIOME_ID members", () => {
    const t = Terrain.generate(42);
    const valid = new Set(Object.values(BIOME_ID));
    expect(t.biomeId.every((id) => valid.has(id))).toBe(true);
  });

  it("is deterministic — same seed yields identical arrays", () => {
    const a = Terrain.generate(42);
    const b = Terrain.generate(42);
    expect(a.biomeId).toEqual(b.biomeId);
    expect(a.elevation).toEqual(b.elevation);
  });

  it("different seeds produce different terrain", () => {
    const a = Terrain.generate(42);
    const b = Terrain.generate(99);
    expect(a.biomeId).not.toEqual(b.biomeId);
  });
});

describe("Terrain.biomeAt / elevationAt", () => {
  it("biomeAt uses row-major order", () => {
    const t = Terrain.generate(42);
    const x = 7;
    const y = 3;
    expect(Terrain.biomeAt(t, x, y)).toBe(t.biomeId[y * WORLD_WIDTH + x]);
  });

  it("elevationAt uses row-major order", () => {
    const t = Terrain.generate(42);
    const x = 7;
    const y = 3;
    expect(Terrain.elevationAt(t, x, y)).toBe(t.elevation[y * WORLD_WIDTH + x]);
  });

  it("biomeAt returns water for out-of-bounds", () => {
    const t = Terrain.generate(42);
    expect(Terrain.biomeAt(t, -1, 0)).toBe(BIOME_ID.water);
  });
});
