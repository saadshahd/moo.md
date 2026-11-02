// Fetches Switzer Semibold, the heading face, from Fontshare into src/fonts/
// before a build. Its licence (ITF Free Font License) lets the site serve it
// from its own pages but not redistribute it, so the file stays out of the
// repository (src/fonts/ is ignored) and every build fetches it. A failed
// fetch fails the build.
import { mkdir, writeFile, access } from "node:fs/promises";

const out = new URL("../src/fonts/switzer-600.woff2", import.meta.url);
const exists = await access(out).then(() => true, () => false);
if (!exists) {
  const css = await (await fetch("https://api.fontshare.com/v2/css?f[]=switzer@600&display=swap")).text();
  const src = css.match(/url\('([^']+\.woff2)'\)/)?.[1];
  if (!src) throw new Error(`fetch-fonts: no woff2 in Fontshare's CSS for Switzer 600:\n${css.slice(0, 300)}`);
  const res = await fetch(src.startsWith("//") ? `https:${src}` : src);
  if (!res.ok) throw new Error(`fetch-fonts: ${res.status} for ${src}`);
  await mkdir(new URL(".", out), { recursive: true });
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log(`fetch-fonts: Switzer 600 → ${out.pathname}`);
}
