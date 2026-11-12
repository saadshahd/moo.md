import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Bun's bundle opens each module it holds with a `// <path>` line, the path from the hum folder `bun run vendor` runs in. */
const bundled = [...readFileSync(join(import.meta.dir, "..", "..", "..", "hum", "mod", "vendor", "libs.js"), "utf8").matchAll(/^\/\/ (\S+)$/gm)].map(([, path]) => path ?? "");

test("the mod's vendored bundle takes the status format alone from the engine, with zod's mini build", () => {
	expect(bundled.filter((path) => path.startsWith("../hum-engine/") && !path.includes("/node_modules/")).sort()).toEqual(["../hum-engine/src/status/format.ts", "../hum-engine/src/status/version.ts"]);
	expect(bundled.filter((path) => path.includes("zod/v4/classic"))).toEqual([]);
});
