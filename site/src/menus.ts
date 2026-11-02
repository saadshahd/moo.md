import { getCollection } from "astro:content";
import { href } from "./link";

/** The site's two lists, by title: every chain with its one line (its
 * description), and every move with what it does. The top bar's menus and the 404 page show
 * them. */
export const siteMenus = async () => {
  const byTitle = (a: { data: { title: string } }, b: { data: { title: string } }) => a.data.title.localeCompare(b.data.title);
  const pages = async (dir: string) => (await getCollection("docs", (e) => e.id.startsWith(`${dir}/`))).sort(byTitle);
  return [
    {
      id: "chains",
      label: "Chains",
      items: (await pages("chains")).map((e) => ({ href: href(e.id), label: e.data.title, note: e.data.description })),
    },
    {
      id: "moves",
      label: "Moves",
      items: (await pages("moves")).map((e) => ({ href: href(e.id), label: e.data.title, note: e.data.move })),
    },
  ];
};
