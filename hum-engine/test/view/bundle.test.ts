import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LIBS = join(import.meta.dir, "..", "..", "..", "hum", "mod", "vendor", "libs.js");

/** Bun's bundle opens each module it holds with a `// <path>` line, the path from the hum folder `bun run vendor` runs in. */
const bundled = [...readFileSync(LIBS, "utf8").matchAll(/^\/\/ (\S+)$/gm)].map(([, path]) => path ?? "");

test("the mod's vendored bundle takes the status format alone from the engine, with zod's mini build", () => {
	expect(bundled.filter((path) => path.startsWith("../hum-engine/") && !path.includes("/node_modules/")).sort()).toEqual(["../hum-engine/src/status/format.ts", "../hum-engine/src/status/version.ts"]);
	expect(bundled.filter((path) => path.includes("zod/v4/classic"))).toEqual([]);
});

test("the bundle's status reader says what a field holds wrong, in a process that loads nothing else", () => {
	const read = Bun.spawnSync([process.execPath, "-e", `const { Status } = await import(${JSON.stringify(LIBS)}); console.log(JSON.stringify(Status.safeParse({ format: 2, writtenAt: "x" }).error?.issues[0]?.message))`]);

	expect(JSON.parse(read.stdout.toString())).toBe("Invalid input: expected number, received string");
});
