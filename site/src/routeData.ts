import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

// No page has a sidebar: the top bar's Chains and Moves menus (TopBar.astro)
// list every chain and move page, so a demo gets the
// page's full width.
//
// The 404 page names no address of its own: Starlight would point its
// canonical and og:url at /404/, which GitHub Pages answers with a 404.
export const onRequest = defineRouteMiddleware(({ locals }) => {
  const route = locals.starlightRoute;
  route.hasSidebar = false;
  if (route.id === "404") {
    route.head = route.head.filter(
      ({ attrs }) => attrs?.rel !== "canonical" && attrs?.property !== "og:url",
    );
  }
});
