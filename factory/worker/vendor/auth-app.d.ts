/**
 * The @octokit/auth-app export the worker uses. `bun run vendor` bundles it into auth-app.js,
 * committed, so the plugin runs from a clone with no `bun install`; types come from the pinned
 * package.
 */
export { createAppAuth } from "@octokit/auth-app";
