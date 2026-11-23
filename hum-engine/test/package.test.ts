import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import plugin from "../../hum/.claude-plugin/plugin.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

const Shrinkwrap = z.looseObject({
	packages: z.record(z.string(), z.looseObject({ dev: z.boolean().optional(), integrity: z.string().optional(), hasInstallScript: z.boolean().optional(), dependencies: z.record(z.string(), z.string()).optional(), devDependencies: z.record(z.string(), z.string()).optional() })),
});

test("the plugin and the engine share one version", () => {
	expect(plugin.version).toBe(pkg.version);
});

test("the shipped shrinkwrap pins only the dependencies package.json names, each package it installs with an integrity hash and no install script, and no dev package; bun run shrinkwrap writes it again", () => {
	const { packages } = Shrinkwrap.parse(JSON.parse(readFileSync(join(import.meta.dir, "..", "npm-shrinkwrap.json"), "utf8")));
	const installed = Object.entries(packages).filter(([path]) => path !== "");

	expect(packages[""]?.dependencies).toEqual(pkg.dependencies);
	expect(packages[""]?.devDependencies).toBeUndefined();
	expect(installed.length).toBeGreaterThan(Object.keys(pkg.dependencies).length);
	expect(installed.flatMap(([path, { dev }]) => (dev ? [path] : []))).toEqual([]);
	expect(installed.flatMap(([path, { integrity, hasInstallScript }]) => (integrity === undefined || hasInstallScript ? [path] : []))).toEqual([]);
});
