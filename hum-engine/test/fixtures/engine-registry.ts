import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { ENGINE_NAME } from "../../src/engine.ts";
import { tempDir } from "./temp.ts";

/** A stand-in engine's CLI: `hum setup upgrade` writes `.hum/engine.txt` and says so, and any other command prints its version and arguments. */
export const upgradingCli = (version: string): string =>
	[
		'import { writeFileSync } from "node:fs";',
		"const args = process.argv.slice(2);",
		`if (args.join(" ") === "setup upgrade") { writeFileSync(".hum/engine.txt", "${version}\\n"); console.log(JSON.stringify({ written: [".hum/engine.txt"] })); }`,
		`else console.log(\`hum ${version} \${args.join(" ")}\`);`,
	].join("\n");

/** A stand-in engine's CLI whose `hum setup upgrade` refuses with `refused`, as an engine whose settings need the owner's answer does. */
export const refusingCli = (refused: string): string => `console.log(JSON.stringify({ refused: ${JSON.stringify(refused)} }));\nprocess.exit(1);\n`;

/** One version's tarball as npm packs it: every file under `package/`. */
const tarball = (version: string, cli: string): Uint8Array => {
	const folder = tempDir("engine-package");
	const root = join(folder, "package");
	mkdirSync(dirname(join(root, pkg.bin.hum)), { recursive: true });
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: ENGINE_NAME, version, bin: pkg.bin }));
	writeFileSync(join(root, pkg.bin.hum), cli);

	const packed = Bun.spawnSync(["tar", "-czf", join(folder, "engine.tgz"), "-C", folder, "package"]);

	if (packed.exitCode !== 0) throw new Error(`tar failed: ${packed.stderr.toString()}`);

	return readFileSync(join(folder, "engine.tgz"));
};

/**
 * A package registry on localhost holding `@moo.md/hum` at each version given, each a stand-in engine with the CLI
 * given; a package manager installs from it as from npm, so nothing leaves the machine. It counts each tarball fetched.
 */
export const engineRegistry = (engines: Readonly<Record<string, string>>) => {
	const tarballs = new Map(Object.entries(engines).map(([version, cli]) => [version, tarball(version, cli)]));
	const fetched = new Map<string, number>();
	const versions = [...tarballs.keys()];

	const server = Bun.serve({
		port: 0,
		fetch: (request: Request): Response => {
			const path = decodeURIComponent(new URL(request.url).pathname);
			const version = /^\/tarballs\/(.+)\.tgz$/.exec(path)?.[1];
			const bytes = version === undefined ? undefined : tarballs.get(version);

			if (version !== undefined && bytes !== undefined) {
				fetched.set(version, (fetched.get(version) ?? 0) + 1);

				return new Response(bytes);
			}

			if (path !== `/${ENGINE_NAME}`) return new Response("not found", { status: 404 });

			return Response.json({
				name: ENGINE_NAME,
				"dist-tags": { latest: versions.at(-1) },
				versions: Object.fromEntries(
					[...tarballs].map(([each, packed]) => [
						each,
						{
							name: ENGINE_NAME,
							version: each,
							bin: pkg.bin,
							dist: { tarball: `${server.url}tarballs/${each}.tgz`, integrity: `sha512-${createHash("sha512").update(packed).digest("base64")}`, shasum: createHash("sha1").update(packed).digest("hex") },
						},
					]),
				),
			});
		},
	});

	return {
		/** The registry's address, as a package manager's config names it. */
		url: server.url.href,
		fetched: (version: string): number => fetched.get(version) ?? 0,
		stop: () => server.stop(true),
	};
};
