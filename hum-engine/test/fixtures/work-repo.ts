import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { OWNER } from "./identity.ts";

/** The markdown adapter's settings as hum ships them. */
export const markdownSettings = {
	claimPrefix: SHIPPED_DEFAULTS.claimPrefix,
	itemsDir: SHIPPED_DEFAULTS.itemsDir,
	identity: OWNER,
	writeRaceRetries: SHIPPED_DEFAULTS.writeRaceRetries,
	itemReadsAtOnce: SHIPPED_DEFAULTS.itemReadsAtOnce,
	mergeMethod: SHIPPED_DEFAULTS.mergeMethod,
	ownerBranchPrefix: SHIPPED_DEFAULTS.ownerBranchPrefix,
};

const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

const git = (cwd: string, args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...ENV } });

export const sh = (cwd: string, args: string[]): string => {
	const result = git(cwd, args);

	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);

	return result.stdout;
};

export const itemFile = (title: string, state = "ready", body = "body") => `---\ntitle: ${JSON.stringify(title)}\nstate: ${state}\n---\n\n${body}\n`;

let built: string | undefined;

/** A bare remote and its owner's clone holding the first commit, built once per process: a copy costs a tenth of the init, clone, commit and push it stands for. */
const firstWorld = (): string => (built ??= buildFirstWorld());

const buildFirstWorld = (): string => {
	const world = mkdtempSync(join(tmpdir(), "hum-work-first-"));
	const remote = join(world, "remote.git");
	const owner = join(world, "owner");

	sh(world, ["init", "--bare", "-b", "main", remote]);
	sh(world, ["clone", "-q", remote, owner]);
	sh(owner, ["checkout", "-q", "-b", "main"]);
	mkdirSync(join(owner, ".hum", "work"), { recursive: true });
	writeFileSync(join(owner, ".hum", "work", ".gitkeep"), "");
	sh(owner, ["add", "-A"]);
	sh(owner, ["commit", "-q", "-m", "init"]);
	sh(owner, ["push", "-q", "origin", "main"]);
	sh(remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);

	return world;
};

/** A temp bare remote, one seeding clone that plays the owner, and worker clones. Nothing leaves the temp folder. */
export class WorkRepo {
	readonly root = mkdtempSync(join(tmpdir(), "hum-work-"));
	readonly remote = join(this.root, "remote.git");
	readonly owner = join(this.root, "owner");
	#count = 0;

	constructor() {
		cpSync(firstWorld(), this.root, { recursive: true });
		sh(this.owner, ["remote", "set-url", "origin", this.remote]);
	}

	commit(message: string): void {
		sh(this.owner, ["add", "-A"]);
		sh(this.owner, ["commit", "-q", "-m", message]);
	}

	/** The owner commits an item file and pushes it. */
	add(id: string, content: string): string {
		this.put(`.hum/work/${id}.md`, content, `add ${id}`);

		return id;
	}

	/** The owner commits a file and pushes it, rebasing onto the remote's main first only when a worker moved it. */
	put(path: string, content: string, message = `put ${path}`): void {
		mkdirSync(join(this.owner, dirname(path)), { recursive: true });
		writeFileSync(join(this.owner, path), content);
		this.commit(message);

		if (git(this.owner, ["push", "-q", "origin", "main"]).status !== 0) {
			sh(this.owner, ["pull", "-q", "--rebase", "origin", "main"]);
			sh(this.owner, ["push", "-q", "origin", "main"]);
		}
	}

	seed(title: string): string {
		return this.add(`seed-${++this.#count}`, itemFile(title));
	}

	/** A worker's clone of the remote. */
	worker(name: string): string {
		const path = join(this.root, name);

		sh(this.root, ["clone", "-q", this.remote, path]);

		return path;
	}

	/** The remote refuses every push to main, saying `said`: by default that another writer moved it. Returns how many pushes it has refused. */
	refuseMainPushes(said = "fetch first"): () => number {
		const refused = join(this.root, "refused-pushes");
		const hook = join(this.remote, "hooks", "pre-receive");

		mkdirSync(join(this.remote, "hooks"), { recursive: true });
		writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do\n\tif [ "$ref" = "refs/heads/main" ]; then echo x >> ${refused}; echo "${said}" >&2; exit 1; fi\ndone\n`);
		chmodSync(hook, 0o755);

		return () => (existsSync(refused) ? readFileSync(refused, "utf8").split("\n").filter(Boolean).length : 0);
	}

	/** The item file as the remote holds it on main. */
	show(id: string): string {
		return sh(this.remote, ["show", `main:.hum/work/${id}.md`]);
	}
}
