import { expect, test } from "bun:test";
import { PermanentError } from "../src/adapter-api.ts";
import { methodFor } from "../src/adapters/pull-requests.ts";
import { FakeGitHub } from "./fixtures/fake-github.ts";

const change = { head: "hum/run/1", base: "main", title: "hum: one", body: "Item 1." };

test("a pull request whose checks already passed takes no auto-merge, so it merges now", async () => {
	const github = new FakeGitHub();
	const pulls = github.client();
	const opened = await pulls.open(change);

	github.checksPass(opened.number);

	const ready = await pulls.find(change.head);

	expect(ready && (await pulls.autoMerge(ready, true, "squash"))).toBe("merged");
	expect(github.pulls()).toMatchObject([{ state: "MERGED" }]);
});

test("a repo that allows no auto-merge refuses it for good, and turning it off on an unarmed pull request asks nothing", async () => {
	const github = new FakeGitHub();
	const pulls = github.client();
	const opened = await pulls.open(change);

	github.allowAutoMerge = false;
	await expect(pulls.autoMerge(opened, true, "squash")).rejects.toBeInstanceOf(PermanentError);
	expect(await pulls.autoMerge(opened, false, "squash")).toBe("off");
	expect(github.requests.filter((r) => r.includes("DisableAutoMerge"))).toEqual([]);
});

test("the owner's merge method is used when the branch's rules allow it, else the first they allow", () => {
	expect([methodFor("squash", undefined), methodFor("squash", ["merge", "squash"]), methodFor("rebase", ["merge", "squash"])]).toEqual(["squash", "squash", "merge"]);
});
