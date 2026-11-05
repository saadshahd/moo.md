// Every demo page, read from its own page file: the pair it plays (scenes.ts)
// and the line under its title (its description). The front page plays the
// Double charge pair, so it adds no page here.
import { readdirSync, readFileSync } from "node:fs";
import * as S from "../src/demo/scenes.ts";
import type { Pair } from "../src/demo/types.ts";

const DOCS = new URL("../src/content/docs/", import.meta.url);

export type Page = {
  /** The page file's name, e.g. "clarify"; on a move page, the move. */
  slug: string;
  /** The page's folder: "moves", "start" or "chains". */
  group: string;
  line: string;
  pair: Pair;
};

export function pages(): Page[] {
  return readdirSync(DOCS, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".mdx") && f.includes("/"))
    .sort()
    .flatMap((f): Page[] => {
      const text = readFileSync(new URL(f, DOCS), "utf8");
      const name = /scene=\{(\w+)\}/.exec(text)?.[1];
      if (!name) return [];
      const pair = (S as Record<string, Pair>)[name];
      if (!pair) throw new Error(`${f}: plays ${name}, which scenes.ts does not export`);
      const line = /^description: "(.*)"$/m.exec(text)?.[1];
      if (!line) throw new Error(`${f}: a demo page with no description line`);
      const [group, file] = f.split("/");
      return [{ slug: file.replace(/\.mdx$/, ""), group, line, pair }];
    });
}

/** The prompt the moo-on pane must type, by rule 2 of the plan: the moo-off
 * words with only `/hope:<move> ` in front, and `/hope:compose ` on a chain page. */
export const onPrompt = (page: Page, off: string) =>
  `/hope:${page.group === "chains" ? "compose" : page.slug} ${off}`;

/** Whether the page's two first prompts match by rule 2, and why not. */
export function promptMatch(page: Page): { ok: boolean; why?: string } {
  const [off, on] = [page.pair.off.turns[0]?.user, page.pair.on.turns[0]?.user];
  if (off === undefined) return { ok: false, why: "no moo-off take" };
  const want = onPrompt(page, off);
  return on === want ? { ok: true } : { ok: false, why: `moo on types "${on}"; rule 2 wants "${want}"` };
}
