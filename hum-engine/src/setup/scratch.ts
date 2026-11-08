import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitIn } from "../adapters/git.ts";
import { newItemFile } from "../adapters/item-file.ts";
import type { HumConfig } from "../config/schema.ts";
import { atomicWrite } from "../state/fs.ts";

/** What the owner's checkout contributes to a scratch copy beyond its commits: setup's files, which may not be committed yet. */
const SETUP_FILES = [".hum", ".github/workflows"] as const;

/**
 * A throwaway copy of the owner's repo with its own bare remote, so setup can run an item or a contract suite without
 * touching the owner's remote. The copy holds the owner's commits and their uncommitted `.hum/` and workflows.
 */
export class Scratch {
	readonly root = mkdtempSync(join(tmpdir(), "hum-prove-"));
	readonly remote = join(this.root, "remote.git");
	readonly owner = join(this.root, "owner");
	readonly #base: string;
	readonly #settings: Pick<HumConfig, "commitIdentity" | "itemsDir">;
	#workers = 0;

	private constructor(base: string, settings: Pick<HumConfig, "commitIdentity" | "itemsDir">) {
		this.#base = base;
		this.#settings = settings;
	}

	static async from(repo: string, base: string, settings: Pick<HumConfig, "commitIdentity" | "itemsDir">): Promise<Scratch> {
		const scratch = new Scratch(base, settings);
		const git = gitIn(scratch.root, { identity: settings.commitIdentity });

		await git.raw(["clone", "-q", "--bare", repo, scratch.remote]);
		await git.raw(["clone", "-q", scratch.remote, scratch.owner]);

		for (const file of SETUP_FILES) {
			if (existsSync(join(repo, file))) cpSync(join(repo, file), join(scratch.owner, file), { recursive: true });
		}

		await scratch.publish("scratch: the owner's setup files");

		return scratch;
	}

	async publish(message: string): Promise<void> {
		const git = gitIn(this.owner, { identity: this.#settings.commitIdentity });

		await git.raw(["add", "-A"]);
		await git.raw(["commit", "-q", "--allow-empty", "-m", message]);
		await git.raw(["pull", "-q", "--rebase", "origin", this.#base]);
		await git.raw(["push", "-q", "origin", `HEAD:refs/heads/${this.#base}`]);
	}

	/** A ready item on the scratch remote's base; returns its id. */
	async seed(id: string, title: string, body: string): Promise<string> {
		atomicWrite(join(this.owner, this.#settings.itemsDir, `${id}.md`), newItemFile(title, body));
		await this.publish(`scratch: item ${id}`);

		return id;
	}

	/** Another checkout of the scratch remote, for a second worker. */
	async worker(): Promise<string> {
		const folder = join(this.root, `worker-${++this.#workers}`);

		await gitIn(this.root).raw(["clone", "-q", this.remote, folder]);

		return folder;
	}

	dispose(): void {
		rmSync(this.root, { recursive: true, force: true });
	}
}
