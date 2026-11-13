import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import plugin from "../../hum/.claude-plugin/plugin.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

const Shrinkwrap = z.looseObject({
	packages: z.record(z.string(), z.looseObject({ dev: z.boolean().optional(), integrity: z.string().optional(), hasInstallScript: z.boolean().optional(), dependencies: z.record(z.string(), z.string()).optional() })),
});

test("the plugin and the engine share one version", () => {
	expect(plugin.version).toBe(pkg.version);
});

test("the shipped shrinkwrap pins the dependencies package.json names, each package it installs with an integrity hash and no install script; bun run shrinkwrap writes it again", () => {
	const { packages } = Shrinkwrap.parse(JSON.parse(readFileSync(join(import.meta.dir, "..", "npm-shrinkwrap.json"), "utf8")));
	const installed = Object.entries(packages).filter(([path, { dev }]) => path !== "" && dev !== true);

	expect(packages[""]?.dependencies).toEqual(pkg.dependencies);
	expect(installed.length).toBeGreaterThan(Object.keys(pkg.dependencies).length);
	expect(installed.flatMap(([path, { integrity, hasInstallScript }]) => (integrity === undefined || hasInstallScript ? [path] : []))).toEqual([]);
});
