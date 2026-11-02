/**
 * Draws one PNG for hold's view mod, which runs it with bun: a hooks module has no WebAssembly.
 *
 *   bun draw.ts mermaid <theme> <out.png>    Mermaid source on stdin
 *   bun draw.ts picture <file> <out.png>     a PNG, JPEG, GIF or SVG file
 *
 * Writes the PNG to <out.png> and prints the box it fills, `{"columns":C,"rows":R}`. A failure
 * prints its cause on stderr and exits 1.
 */
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { render } from "./vendor/pele.js";
import { initWasm, Resvg } from "./vendor/resvg.js";
import {
  boxPixels,
  diagramBox,
  MAX_BYTES,
  MAX_PIXELS,
  pictureBox,
  rasterOf,
  type Box,
} from "./size.ts";
import { resolveVars, sizeSvg } from "./svg.ts";
import { themeVars } from "./theme.ts";

/** Fonts resvg is handed, as WebAssembly reads no system font: the first of each list that exists. */
const SANS = [
  ["/System/Library/Fonts/Helvetica.ttc", "Helvetica"],
  ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVu Sans"],
  ["/usr/share/fonts/TTF/DejaVuSans.ttf", "DejaVu Sans"],
  ["/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf", "DejaVu Sans"],
  [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "Liberation Sans",
  ],
] as const;
const MONO = [
  ["/System/Library/Fonts/Menlo.ttc", "Menlo"],
  ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "DejaVu Sans Mono"],
  ["/usr/share/fonts/TTF/DejaVuSansMono.ttf", "DejaVu Sans Mono"],
  [
    "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono.ttf",
    "DejaVu Sans Mono",
  ],
] as const;

async function firstFont(list: readonly (readonly [string, string])[]) {
  for (const [path, family] of list) {
    const f = Bun.file(path);

    if (await f.exists())
      return { bytes: new Uint8Array(await f.arrayBuffer()), family };
  }

  return null;
}

async function fonts() {
  const sans = await firstFont(SANS);

  if (!sans)
    throw new Error(
      `no font to draw text with; looked for ${SANS.map(([p]) => p).join(", ")}`,
    );
  const mono = await firstFont(MONO);

  return {
    fontBuffers: mono ? [sans.bytes, mono.bytes] : [sans.bytes],
    defaultFontFamily: sans.family,
    sansSerifFamily: sans.family,
    monospaceFamily: mono?.family ?? sans.family,
  };
}

type Font = Awaited<ReturnType<typeof fonts>>;

const png = (svg: string, font: Font | undefined) =>
  new Resvg(svg, font ? { font } : { font: { loadSystemFonts: false } })
    .render()
    .asPng();

/** PNG bytes from `draw(scale)`, the scale shrunk until they fit `MAX_BYTES`. */
function underCap(draw: (scale: number) => Uint8Array): Uint8Array {
  let scale = 1;

  for (let tries = 0; tries < 6; tries++) {
    const bytes = draw(scale);

    if (bytes.length <= MAX_BYTES) return bytes;
    scale *= Math.sqrt(MAX_BYTES / bytes.length) * 0.95;
  }

  throw new Error(`the PNG stays over ${MAX_BYTES} bytes`);
}

async function mermaid(
  theme: string,
): Promise<{ bytes: Uint8Array; box: Box }> {
  const source = await Bun.stdin.text();
  const drawn = render(source);
  const svg = resolveVars(drawn.svg, themeVars(theme));

  if (svg.includes("var(")) throw new Error("a var() is left after resolving");
  const box = diagramBox(drawn.width, drawn.height);
  const px = boxPixels(box);
  const font = await fonts();
  const bytes = underCap((s) =>
    png(
      sizeSvg(
        svg,
        Math.max(1, Math.floor(px.width * s)),
        Math.max(1, Math.floor(px.height * s)),
      ),
      font,
    ),
  );

  return { bytes, box };
}

async function picture(file: string): Promise<{ bytes: Uint8Array; box: Box }> {
  const input = new Uint8Array(await Bun.file(file).arrayBuffer());

  if (/\.svg$/i.test(file)) {
    const svg = new TextDecoder().decode(input);
    const font = await fonts();
    const natural = new Resvg(svg, { font });
    const shrink = Math.min(
      2,
      Math.sqrt(MAX_PIXELS / (natural.width * natural.height)),
    );
    const bytes = underCap((s) =>
      new Resvg(svg, { font, fitTo: { mode: "zoom", value: shrink * s } })
        .render()
        .asPng(),
    );
    const out = rasterOf(bytes)!;

    return { bytes, box: pictureBox(out.width, out.height) };
  }

  const raster = rasterOf(input);

  if (!raster) throw new Error(`${file} is not a PNG, JPEG or GIF`);
  const { mime, width, height } = raster;

  if (
    mime === "png" &&
    input.length <= MAX_BYTES &&
    width * height <= MAX_PIXELS
  )
    return { bytes: input, box: pictureBox(width, height) };

  const href = `data:image/${mime};base64,${input.toBase64()}`;
  const fit = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)));
  const bytes = underCap((s) => {
    const w = Math.max(1, Math.floor(width * fit * s));
    const h = Math.max(1, Math.floor(height * fit * s));

    return png(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image width="${w}" height="${h}" href="${href}"/></svg>`,
      undefined,
    );
  });
  const out = rasterOf(bytes)!;

  return { bytes, box: pictureBox(out.width, out.height) };
}

async function main(argv: string[]) {
  const [kind, arg, out] = argv;

  if ((kind !== "mermaid" && kind !== "picture") || !arg || !out)
    throw new Error(
      "usage: draw.ts mermaid <theme> <out.png> | draw.ts picture <file> <out.png>",
    );
  await initWasm(
    Bun.file(`${import.meta.dir}/vendor/resvg.wasm`).arrayBuffer(),
  );
  const { bytes, box } =
    kind === "mermaid" ? await mermaid(arg) : await picture(arg);

  await mkdir(dirname(out), { recursive: true });
  await Bun.write(out, bytes);
  process.stdout.write(JSON.stringify(box));
}

if (import.meta.main)
  await main(process.argv.slice(2)).catch((err: unknown) => {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
