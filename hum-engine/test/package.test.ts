import { expect, test } from "bun:test";
import { join } from "node:path";
import plugin from "../../hum/.claude-plugin/plugin.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

const root = join(import.meta.dir, "..");
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

test("the plugin and the engine share one version", () => {
	expect(plugin.version).toBe(pkg.version);
});

test("hum --version prints the engine's version", () => {
	const run = Bun.spawnSync([join(root, pkg.bin.hum), "--version"]);

	expect(text(run.stdout)).toBe(`${pkg.version}\n`);
	expect(run.exitCode).toBe(0);
});

test("the dependency tree holds one xstate", () => {
	const run = Bun.spawnSync(["bun", "pm", "ls", "--all"], { cwd: root });
	const versions = new Set(Bun.stripANSI(text(run.stdout)).match(/(?<=\bxstate@)\S+/g));

	expect(run.exitCode).toBe(0);
	expect([...versions]).toEqual([pkg.dependencies.xstate]);
});
