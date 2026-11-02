/**
 * The engine tells a mod no cell's size in pixels, so the box assumes a nominal cell: 8 by 14
 * points, drawn at a device pixel ratio of 2. Cells measure 8 by 13 in iTerm2 at 12 points and
 * about 8 by 17 in Ghostty at 13. The picture keeps its aspect inside its box: where cells are
 * taller than this, the box ends in a blank strip; shorter, in one at the right. pele lays text out at 16 px;
 * drawn at 1.2 of that, a label reads at about the terminal's own size.
 */
export const CELL = { width: 8, height: 14 } as const;
export const RATIO = 2;
const DIAGRAM_SCALE = 1.2;

/** The caps on one picture: what roundup's terminal takes, under the engine's 2 MiB. */
export const MAX_BYTES = 1024 * 1024;
export const MAX_PIXELS = 4_000_000;
/** The engine's Image takes 1 to 255 cells each way. */
const MAX_CELLS = 255;

export type Box = { columns: number; rows: number };

const cells = (n: number) => Math.min(MAX_CELLS, Math.max(1, Math.ceil(n)));

/** The box a diagram `width` by `height` px fills, its text at the terminal's size. */
export function diagramBox(width: number, height: number): Box {
  return {
    columns: cells((width * DIAGRAM_SCALE) / CELL.width),
    rows: cells((height * DIAGRAM_SCALE) / CELL.height),
  };
}

/** The box a picture `width` by `height` pixels fills, one of its pixels a device pixel. */
export function pictureBox(width: number, height: number): Box {
  return {
    columns: cells(width / (CELL.width * RATIO)),
    rows: cells(height / (CELL.height * RATIO)),
  };
}

/** A box's size in device pixels, shrunk as a whole to `MAX_PIXELS` at most. */
export function boxPixels(box: Box): { width: number; height: number } {
  const width = box.columns * CELL.width * RATIO;
  const height = box.rows * CELL.height * RATIO;
  const shrink = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)));

  return {
    width: Math.floor(width * shrink),
    height: Math.floor(height * shrink),
  };
}

export type Raster = {
  mime: "png" | "jpeg" | "gif";
  width: number;
  height: number;
};

/** A PNG, JPEG or GIF's kind and size, read from its header; null for any other bytes. */
export function rasterOf(b: Uint8Array): Raster | null {
  const be16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const be32 = (i: number) =>
    ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;

  if (b.length >= 24 && be32(0) === 0x89504e47 && be32(4) === 0x0d0a1a0a)
    return { mime: "png", width: be32(16), height: be32(20) };

  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return {
      mime: "gif",
      width: b[6]! | (b[7]! << 8),
      height: b[8]! | (b[9]! << 8),
    };

  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    // Segments follow the start marker; a start-of-frame (C0 to CF, less C4, C8 and CC) holds the size.
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;

      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      )
        return { mime: "jpeg", width: be16(i + 7), height: be16(i + 5) };
      i += 2 + be16(i + 2);
    }
  }

  return null;
}
