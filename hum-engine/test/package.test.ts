import { expect, test } from "bun:test";
import plugin from "../../hum/.claude-plugin/plugin.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

test("the plugin and the engine share one version", () => {
	expect(plugin.version).toBe(pkg.version);
});
