import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { runChecks } from "../src/worker/checks.ts";

test("a check whose child holds its output past the limit fails at the limit, naming itself", async () => {
	expect(await runChecks(["sleep 30; true"], tmpdir(), { timeoutMs: 200 })).toContain("`sh -c sleep 30; true` ran longer than 0.2 seconds");
});

test("a check runs code a run wrote, so it never holds the GitHub tokens hum pushes with", async () => {
	expect(await runChecks(['test -z "$GH_TOKEN" && test -z "$GITHUB_TOKEN" && test "$HUM_KEPT" = yes'], tmpdir(), { timeoutMs: 5000, env: { GH_TOKEN: "ghs_app", GITHUB_TOKEN: "ghs_workflow", HUM_KEPT: "yes" } })).toBeUndefined();
});
