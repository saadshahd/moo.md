/**
 * The pele export the draw script uses. `bun run vendor` bundles it into pele.js, committed, so
 * the plugin runs from a clone with no `bun install`; types come from the pinned package.
 */
export { render } from "pele";
