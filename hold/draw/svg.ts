/**
 * resvg reads no CSS custom properties, and pele paints with them: the root declares
 * `--_fg:var(--pele-fg,#1f1f1f)` and a shape fills with `var(--_fg)`. `resolveVars` writes every
 * `var()` out as the value it stands for, `theme` first, then the SVG's own declarations, then
 * the fallback the `var()` carries.
 */
export function resolveVars(
  svg: string,
  theme: Record<string, string>,
): string {
  const declared = new Map<string, string>();

  for (const [, name, value] of svg.matchAll(/(--[\w-]+)\s*:\s*([^;"]+)/g)) {
    const v = value!.trim();
    const had = declared.get(name!);

    if (had !== undefined && had !== v)
      throw new Error(
        `${name} is declared twice with different values; one value per name is all this resolves`,
      );
    declared.set(name!, v);
  }

  const valueOf = (name: string) => theme[name] ?? declared.get(name);

  const resolve = (text: string, depth: number): string => {
    if (depth > 8)
      throw new Error("var() nests deeper than 8: a variable refers to itself");
    let out = "";
    let at = 0;

    for (;;) {
      const start = text.indexOf("var(", at);

      if (start < 0) return out + text.slice(at);
      let end = start + 4;

      for (let open = 1; open > 0; end++) {
        if (end >= text.length)
          throw new Error(`var() at ${start} never closes`);
        if (text[end] === "(") open++;
        else if (text[end] === ")") open--;
      }
      const inner = text.slice(start + 4, end - 1);
      const comma = inner.indexOf(",");
      const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
      const value =
        valueOf(name) ??
        (comma < 0 ? undefined : inner.slice(comma + 1).trim());

      if (value === undefined)
        throw new Error(`${name} has no value and no fallback`);
      out += text.slice(at, start) + resolve(value, depth + 1);
      at = end;
    }
  };

  return resolve(svg, 0);
}

/**
 * The root `<svg>` drawn `width` by `height` pixels: its viewBox fitted inside, kept to its
 * aspect, at the top left, so a box rounded up to whole cells leaves its slack at the right and
 * the bottom.
 */
export function sizeSvg(svg: string, width: number, height: number): string {
  const root = /<svg\b[^>]*>/.exec(svg);

  if (!root) throw new Error("no <svg> element");
  const tag = root[0]
    .replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, "")
    .replace(
      /^<svg/,
      `<svg width="${width}" height="${height}" preserveAspectRatio="xMinYMin meet"`,
    );

  return (
    svg.slice(0, root.index) + tag + svg.slice(root.index + root[0].length)
  );
}
