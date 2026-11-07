import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

export const sh = (cwd: string, args: string[]): string => {
	const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...ENV } });

	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);

	return result.stdout;
};

export const itemFile = (title: string, state = "ready", body = "body") => `---\ntitle: ${JSON.stringify(title)}\nstate: ${state}\n---\n\n${body}\n`;

/** A temp bare remote, one seeding clone that plays the owner, and worker clones. Nothing leaves the temp folder. */
export class WorkRepo {
	readonly root = mkdtempSync(join(tmpdir(), "hum-work-"));
	readonly remote = join(this.root, "remote.git");
	readonly owner = join(this.root, "owner");
	#count = 0;

	constructor() {
		sh(this.root, ["init", "--bare", "-b", "main", this.remote]);
		sh(this.root, ["clone", "-q", this.remote, this.owner]);
		sh(this.owner, ["checkout", "-q", "-b", "main"]);
		mkdirSync(join(this.owner, ".hum", "work"), { recursive: true });
		writeFileSync(join(this.owner, ".hum", "work", ".gitkeep"), "");
		this.commit("init");
		sh(this.owner, ["push", "-q", "origin", "main"]);
		sh(this.remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);
	}

	commit(message: string): void {
		sh(this.owner, ["add", "-A"]);
		sh(this.owner, ["commit", "-q", "-m", message]);
	}

	/** The owner commits an item file and pushes it. */
	add(id: string, content: string): string {
		writeFileSync(join(this.owner, ".hum", "work", `${id}.md`), content);
		this.commit(`add ${id}`);
		sh(this.owner, ["pull", "-q", "--rebase", "origin", "main"]);
		sh(this.owner, ["push", "-q", "origin", "main"]);

		return id;
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

	/** The item file as the remote holds it on main. */
	show(id: string): string {
		return sh(this.remote, ["show", `main:.hum/work/${id}.md`]);
	}
}
