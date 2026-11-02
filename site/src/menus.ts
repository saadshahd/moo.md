import { getCollection } from "astro:content";
import { href } from "./link";

/** The site's lists, in the menu's order, each a folder of pages by title:
 * a chain shows its one line (its description), every other page its command
 * and what it does (its move line). Groups with no page yet are left out.
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
        href: href(e.id),
        label: e.data.title,
        note: id === "chains" ? e.data.description : e.data.move,
      })),
    })),
  );
  return menus.filter((m) => m.items.length);
};
