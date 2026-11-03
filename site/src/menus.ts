import { getCollection } from "astro:content";
import { href } from "./link";
import { MOVE_GROUPS } from "./move-groups";

/** The site's lists, in the menu's order, each a folder of pages by title:
 * a chain shows its one line (its description), a move its command alone,
 * and every other page its command and what it does (its move line). Groups
 * with no page yet are left out.
 * The top bar's menus and the 404 page show them. */
const GROUPS = [
  { id: "start", label: "Start" },
  { id: "moves", label: "Moves" },
  { id: "chains", label: "Chains" },
];
export const siteMenus = async () => {
  const byTitle = (a: { data: { title: string } }, b: { data: { title: string } }) => a.data.title.localeCompare(b.data.title);
  const pages = async (dir: string) => (await getCollection("docs", (e) => e.id.startsWith(`${dir}/`))).sort(byTitle);
  const menus = await Promise.all(
    GROUPS.map(async ({ id, label }) => ({
      id,
      label,
      look: id === "chains" ? "chains" : "commands",
      items: (await pages(id)).map((e) => ({
        name: e.id.slice(id.length + 1),
        href: href(e.id),
        label: e.data.title,
        note: id === "chains" ? e.data.description : id === "moves" ? undefined : e.data.move,
      })),
    })),
  );
  return menus.filter((m) => m.items.length).map((m) => (m.id === "moves" ? grouped(m) : m));
};

type Item = { name: string; href: string; label: string; note?: string };
/** The Moves menu in MOVE_GROUPS' order, its items listed group by group. A
 * move page in no group, or a group naming no page, fails the build. */
function grouped<M extends { items: Item[] }>(m: M) {
  const byName = new Map(m.items.map((i) => [i.name, i]));
  const groups = MOVE_GROUPS.map((g) => ({
    heading: g.heading,
    items: g.moves.map((n) => byName.get(n) ?? fail(`move-groups.ts names "${n}", which has no page in moves/`)),
  }));
  const placed = new Set(MOVE_GROUPS.flatMap((g) => g.moves));
  const loose = m.items.filter((i) => !placed.has(i.name)).map((i) => i.name);
  if (loose.length) fail(`moves/ pages in no group of move-groups.ts: ${loose.join(", ")}`);
  return { ...m, items: groups.flatMap((g) => g.items), groups };
}
const fail = (why: string): never => {
  throw new Error(why);
};
