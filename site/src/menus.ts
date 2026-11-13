import { getCollection } from "astro:content";
import { href } from "./link";
import { MOVE_GROUPS, START_GROUP, type MoveGroup } from "./move-groups";

/** The site's lists, in the menu's order, each a folder of pages by title:
 * a chain shows its one line (its description), a move its command alone,
 * and every other page its command and what it does (its move line). Groups
 * with no page yet are left out.
 * The top bar's menus and the 404 page show them. */
const GROUPS = [
  { id: "start", label: START_GROUP.heading },
  { id: "moves", label: "Moves" },
  { id: "chains", label: "Chains" },
  { id: "parts", label: "Parts" },
];
const byTitle = (a: { data: { title: string } }, b: { data: { title: string } }) => a.data.title.localeCompare(b.data.title);
const pages = async (dir: string) => (await getCollection("docs", (e) => e.id.startsWith(`${dir}/`))).sort(byTitle);
const pageName = (dir: string, id: string) => id.slice(dir.length + 1);

export const siteMenus = async () => {
  const menus = await Promise.all(
    GROUPS.map(async ({ id, label }) => ({
      id,
      label,
      look: id === "chains" ? "chains" : "commands",
      items: (await pages(id)).map((e) => ({
        name: pageName(id, e.id),
        href: href(e.id),
        label: e.data.title,
        note: id === "chains" ? e.data.description : id === "moves" ? undefined : e.data.move,
      })),
    })),
  );
  return menus.filter((m) => m.items.length).map((m) => (m.id === "moves" ? grouped(m) : m));
};

/** hope's moves, group by group: the Start pages, then the Moves menu's
 * groups. Each move shows its page's name and what it does (its move line),
 * and links to its page. */
export const hopeMoves = async () => {
  const moves = async (dir: string) =>
    (await pages(dir)).map((e) => ({ name: pageName(dir, e.id), href: href(e.id), label: pageName(dir, e.id), note: e.data.move }));
  return [...placed(await moves("start"), [START_GROUP], "start"), ...placed(await moves("moves"), MOVE_GROUPS, "moves")];
};

type Item = { name: string; href: string; label: string; note?: string };
/** A folder's items under its groups' headings, in the groups' order. A page
 * in no group, or a group naming no page, fails the build. */
function placed(items: Item[], groups: MoveGroup[], dir: string) {
  const byName = new Map(items.map((i) => [i.name, i]));
  const named = new Set(groups.flatMap((g) => g.moves));
  const loose = items.filter((i) => !named.has(i.name)).map((i) => i.name);
  if (loose.length) fail(`${dir}/ pages in no group of move-groups.ts: ${loose.join(", ")}`);
  return groups.map((g) => ({
    heading: g.heading,
    items: g.moves.map((n) => byName.get(n) ?? fail(`move-groups.ts names "${n}", which has no page in ${dir}/`)),
  }));
}
/** The Moves menu in MOVE_GROUPS' order, its items listed group by group. */
function grouped<M extends { items: Item[] }>(m: M) {
  const groups = placed(m.items, MOVE_GROUPS, "moves");
  return { ...m, items: groups.flatMap((g) => g.items), groups };
}
const fail = (why: string): never => {
  throw new Error(why);
};
