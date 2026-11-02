import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

// No page has a sidebar: the top bar's Chains and Moves menus (TopBar.astro)
// list every chain and move page, so a demo gets the
// page's full width.
export const onRequest = defineRouteMiddleware(({ locals }) => {
  locals.starlightRoute.hasSidebar = false;
});
