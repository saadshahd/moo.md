/**
 * The @resvg/resvg-wasm exports the draw script uses. `bun run vendor` bundles them into
 * resvg.js and copies the WebAssembly beside it as resvg.wasm, both committed; types come from
 * the pinned package.
 */
export { initWasm, Resvg } from "@resvg/resvg-wasm";
