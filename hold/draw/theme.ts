/**
 * pele's colour variables in Claude Code's own colours, per theme. The values are copied from
 * Claude Code 2.1.316's theme tables (`text`, `inactive`, `promptBorder`, `claude`,
 * `userMessageBackground`, `userMessageBackgroundHover`, the `rainbow_*` series); a theme the
 * table lacks (`*-ansi`, a custom one) takes the dark or light one its name says.
 */
type Palette = {
  text: string;
  inactive: string;
  border: string;
  accent: string;
  surface: string;
  surfaceAlt: string;
  /** Behind a label that sits on a line: the terminal's own ground is unknown, so close to it. */
  ground: string;
};

const DARK: Palette = {
  text: "rgb(255,255,255)",
  inactive: "rgb(153,153,153)",
  border: "rgb(136,136,136)",
  accent: "rgb(215,119,87)",
  surface: "rgb(55,55,55)",
  surfaceAlt: "rgb(70,70,70)",
  ground: "rgb(30,30,30)",
};

const LIGHT: Palette = {
  text: "rgb(0,0,0)",
  inactive: "rgb(102,102,102)",
  border: "rgb(138,138,138)",
  accent: "rgb(215,119,87)",
  surface: "rgb(240,240,240)",
  surfaceAlt: "rgb(252,252,252)",
  ground: "rgb(255,255,255)",
};

const PALETTES: Record<string, Palette> = {
  dark: DARK,
  light: LIGHT,
  "dark-daltonized": { ...DARK, accent: "rgb(255,153,51)" },
  "light-daltonized": { ...LIGHT, accent: "rgb(255,153,51)" },
};

const SERIES = [
  "rgb(130,170,220)",
  "rgb(245,139,87)",
  "rgb(145,200,130)",
  "rgb(155,130,200)",
  "rgb(250,195,95)",
  "rgb(235,95,87)",
  "rgb(200,130,180)",
  "rgb(215,119,87)",
];

/** The `--pele-*` values for theme `name`; the font is resvg's generic family, mapped to a loaded one. */
export function themeVars(name: string): Record<string, string> {
  const p = PALETTES[name] ?? (name.includes("light") ? LIGHT : DARK);

  return {
    "--pele-bg": p.ground,
    "--pele-fg": p.text,
    "--pele-muted": p.inactive,
    "--pele-line": p.inactive,
    "--pele-surface": p.surface,
    "--pele-surface-alt": p.surfaceAlt,
    "--pele-border": p.border,
    "--pele-accent": p.accent,
    "--pele-font": "sans-serif",
    "--pele-font-mono": "monospace",
    ...Object.fromEntries(SERIES.map((c, i) => [`--pele-series-${i + 1}`, c])),
  };
}
