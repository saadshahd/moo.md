import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { runChecks } from "../src/worker/checks.ts";

test("a check whose child holds its output past the limit fails at the limit, naming itself", async () => {
	expect(await runChecks(["sleep 30; true"], tmpdir(), { timeoutMs: 200 })).toContain("`sh -c sleep 30; true` ran longer than 0.2 seconds");
});
