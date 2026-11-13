import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installPlugins, pluginCommands, RepoPlugins, shippedCommit } from "../src/service/plugins.ts";
import { sh } from "./fixtures/work-repo.ts";
import { tempDir } from "./fixtures/temp.ts";

/** A repo's settings: its own moo.md, three other marketplaces, plugins on and one off. */
const SETTINGS = {
	outputStyle: "hold:Plain",
	extraKnownMarketplaces: {
		"moo.md": { source: { source: "github", repo: "saadshahd/moo.md" } },
		skills: { source: { source: "github", repo: "humanlayer/skills", ref: "3f1c2a9" } },
		pinned: { source: { source: "git", url: "https://example.com/plugins.git", ref: "v2" } },
		local: { source: { source: "directory", path: "tools/plugins" } },
	},
	enabledPlugins: { "hope@moo.md": true, "sound@moo.md": true, "show-me@skills": true, "old@skills": false },
};

test("hope comes from moo.md at the shipped commit, in place of the moo.md the repo declares; each other marketplace is added, and each enabled plugin installed", () => {
	expect(pluginCommands(RepoPlugins.parse(SETTINGS), { repo: "/repo", mooFolder: "/tmp/moo" })).toEqual([
		["plugin", "marketplace", "add", "/tmp/moo"],
		["plugin", "marketplace", "add", "humanlayer/skills#3f1c2a9"],
		["plugin", "marketplace", "add", "https://example.com/plugins.git#v2"],
		["plugin", "marketplace", "add", "/repo/tools/plugins"],
		["plugin", "install", "hope@moo.md"],
		["plugin", "install", "sound@moo.md"],
		["plugin", "install", "show-me@skills"],
	]);
});

test("a repo with no settings file gets hope alone", async () => {
	const ran: string[] = [];
	const commands = await installPlugins({ repo: tempDir("no-settings"), env: {}, mooFolder: "/tmp/moo", claude: async (args) => (ran.push(args.join(" ")), { exitCode: 0, stdout: "", stderr: "" }) });

	expect(commands).toEqual([["plugin", "marketplace", "add", "/tmp/moo"], ["plugin", "install", "hope@moo.md"]]);
	expect(ran).toEqual(["plugin marketplace add /tmp/moo", "plugin install hope@moo.md"]);
});

test("the first command claude refuses stops the install, naming the command and what claude said", async () => {
	const repo = tempDir("settings");

	mkdirSync(join(repo, ".claude"), { recursive: true });
	writeFileSync(join(repo, ".claude", "settings.json"), JSON.stringify(SETTINGS));

	const ran: string[] = [];
	const claude = async (args: readonly string[]) => (ran.push(args.join(" ")), args[1] === "install" ? { exitCode: 1, stdout: "", stderr: "no plugin hope in moo.md" } : { exitCode: 0, stdout: "", stderr: "" });

	await expect(installPlugins({ repo, env: {}, mooFolder: "/tmp/moo", claude })).rejects.toThrow("claude plugin install hope@moo.md exited 1: no plugin hope in moo.md");
	expect(ran.at(-1)).toBe("plugin install hope@moo.md");
});

test("a marketplace from a repo with no ref is refused, naming it, before any command runs", () => {
	const settings = RepoPlugins.parse({ extraKnownMarketplaces: { ...SETTINGS.extraKnownMarketplaces, floating: { source: { source: "git", url: "https://example.com/floating.git" } } } });

	expect(() => pluginCommands(settings, { repo: "/repo", mooFolder: "/tmp/moo" })).toThrow('the marketplaces floating in .claude/settings.json name no "ref"');
});

test("a marketplace kept in a folder of a repo is refused, which claude plugin marketplace add cannot take", () => {
	expect(RepoPlugins.safeParse({ extraKnownMarketplaces: { sub: { source: { source: "github", repo: "o/r", path: "plugins" } } } }).success).toBe(false);
});

test("an engine in a moo.md checkout ships with the checkout's commit", async () => {
	expect(await shippedCommit()).toBe(sh(join(import.meta.dir, ".."), ["rev-parse", "HEAD"]).trim());
});
