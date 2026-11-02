// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Served by GitHub Pages at saadshahd.github.io/moo.md.
export default defineConfig({
  site: "https://saadshahd.github.io",
  base: "/moo.md",
  integrations: [
    starlight({
      title: "moo.md",
      components: {
        // One top bar in place of Starlight's header and sidebar; it holds
        // the site's menus, search and GitHub link.
        Header: "./src/components/TopBar.astro",
        PageTitle: "./src/components/PageTitle.astro",
        Footer: "./src/components/Footer.astro",
      },
      customCss: [
        "@fontsource/instrument-sans/latin-400.css",
        "@fontsource/instrument-sans/latin-600.css",
        // Fira Code on every page: the mark and the commands are code.
        "@fontsource/fira-code/latin-400.css",
        "./src/styles/identity.css",
        "./src/styles/chrome.css",
      ],
      routeMiddleware: "./src/routeData.ts",
      // No Previous/Next cards: each page stands alone, and a demo page fits
      // the screen without scrolling.
      pagination: false,
    }),
  ],
});
