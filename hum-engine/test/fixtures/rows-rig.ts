import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { x } from "tinyexec";
import { z } from "zod";
import { type RoundupClient, roundupRpc } from "../../src/adapters/roundup-rpc.ts";
import { Json } from "../../src/config/json.ts";
import { runTempDir } from "./temp.ts";

/** The installed roundup app, whose Daemon the rig starts on a throwaway data folder. */
export const ROUNDUP_APP = "/Applications/roundup.app/Contents/MacOS";

const STUB = join(import.meta.dir, "rows-claude.ts");

const DRIVER = join(import.meta.dir, "rows-driver.ts");

/** The program that runs hum's items scenarios on the rig. */
export const ITEMS_DRIVER = join(import.meta.dir, "items-driver.ts");

const CLI = join(import.meta.dir, "..", "..", "src", "cli", "main.ts");

/** The run slots the rig's repo holds, one per scenario, each a worktree on a branch of its own. */
const SLOTS = 7;

export const SLOTS_DIR = ".hum-slots";

const Event = z.looseObject({ name: z.string(), data: z.looseObject({}).optional() });

export type RigEvent = z.infer<typeof Event>;

export type Rig = {
	readonly dir: string;
	/** hum's state folder for the driver, where the run folders and the secret live. */
	readonly stateDir: string;
	/** Calls as the user: no name claimed, from outside every Agent's process tree. */
	readonly user: RoundupClient;
	/** Runs `scenario` as the Project's program, and reads the result it writes. */
	readonly runProgram: (scenario: string) => Promise<void>;
	readonly stopProgram: () => Promise<void>;
	/** The outcome a program wrote for `scenario`: its result, or what it wrote when stopped mid-run. */
	readonly resultOf: (scenario: string, timeoutMs?: number, kind?: "result" | "aborted") => Promise<Json>;
	readonly events: () => Promise<RigEvent[]>;
	readonly stop: () => Promise<void>;
};

const git = async (cwd: string, args: string[]): Promise<void> => {
	await x("git", args, { nodeOptions: { cwd }, throwOnError: true });
};

const waitFor = async (found: () => boolean, timeoutMs: number, what: string): Promise<void> => {
	const deadline = Date.now() + timeoutMs;

	while (!found()) {
		if (Date.now() > deadline) throw new Error(`the rig timed out waiting for ${what}`);

		await Bun.sleep(100);
	}
};

/** A scratch repo with an origin and the run slots, a stub claude, and a roundup Daemon on a fresh data folder, whose program runs `driver`. */
export const startRig = async (driver = DRIVER): Promise<Rig> => {
	const dir = runTempDir("rows");
	const repo = join(dir, "repo");
	const socket = join(dir, "rupd.sock");
	const stateDir = join(dir, "state");
	const claude = Bun.which("claude");

	if (claude === null) throw new Error("the rig's stub hands claude's own plugin and version checks to the real claude, and none is on PATH");

	await x("git", ["init", "-q", "--bare", "-b", "main", join(dir, "origin.git")], { throwOnError: true });
	await x("git", ["init", "-q", "-b", "main", repo], { throwOnError: true });
	writeFileSync(join(repo, "README.md"), "# rig\n");
	writeFileSync(join(repo, ".git", "info", "exclude"), `${SLOTS_DIR}/\n`);

	for (const args of [["config", "user.name", "rig"], ["config", "user.email", "rig@example.invalid"], ["add", "README.md"], ["commit", "-qm", "init"], ["remote", "add", "origin", join(dir, "origin.git")], ["push", "-q", "origin", "main"]]) await git(repo, args);

	for (let slot = 1; slot <= SLOTS; slot++) await git(repo, ["worktree", "add", "-q", join(SLOTS_DIR, `s${slot}`), "-b", `hum/slot-${slot}`]);

	const stub = join(dir, "claude");

	writeFileSync(stub, `#!/bin/sh\nexec ${process.execPath} ${STUB} "$@"\n`, { mode: 0o755 });

	const home = process.env.HOME ?? "";

	const daemon = Bun.spawn([join(ROUNDUP_APP, "rupd"), repo], {
		env: {
			HOME: home,
			USER: process.env.USER ?? "",
			TMPDIR: process.env.TMPDIR ?? "/tmp",
			PATH: [join(home, ".local", "bin"), join(home, ".bun", "bin"), "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
			ROUNDUP_DATA_DIR: join(dir, "data"),
			RUPD_SOCKET: socket,
			ROUNDUP_CLAUDE_BIN: stub,
			HUM_ROWS_RIG: dir,
			HUM_ROWS_CLI: CLI,
			HUM_ROWS_CLAUDE: claude,
		},
		stdout: Bun.file(join(dir, "rupd.log")),
		stderr: Bun.file(join(dir, "rupd.err")),
	});

	await waitFor(() => existsSync(socket), 10_000, "the Daemon's socket");

	const user = roundupRpc(socket, null);

	const stopProgram = async (): Promise<void> => {
		await user.call("project.stopProgram").catch(() => undefined);
	};

	const runProgram = async (scenario: string): Promise<void> => {
		await stopProgram();
		await user.call("project.setProgram", { argv: [process.execPath, driver, scenario, dir], dir: ".", adoptDir: SLOTS_DIR });
		await user.call("project.startProgram");
	};

	const resultOf = async (scenario: string, timeoutMs = 60_000, kind: "result" | "aborted" = "result"): Promise<Json> => {
		const file = join(dir, `${kind}-${scenario}.json`);

		await waitFor(() => existsSync(file), timeoutMs, `the ${scenario} result`);

		return Json.parse(JSON.parse(readFileSync(file, "utf8")));
	};

	const events = async (): Promise<RigEvent[]> => {
		const { stdout } = await x(join(ROUNDUP_APP, "rup"), ["events", "--after", "0", "--json"], { nodeOptions: { env: { PATH: process.env.PATH, HOME: home, RUPD_SOCKET: socket } } });

		return stdout
			.split("\n")
			.filter(Boolean)
			.map((line) => Event.parse(JSON.parse(line)));
	};

	/** Stops every Agent and the program, then the Daemon, then anything of the rig's still running. */
	const stop = async (): Promise<void> => {
		const nodes = z.array(z.looseObject({ id: z.string(), kind: z.string() })).parse(await user.call("rail.tree").catch(() => []));

		for (const node of nodes.filter(({ kind }) => kind === "agent")) await user.call("agent.stop", { id: node.id }).catch(() => undefined);

		await stopProgram();
		user.close();
		daemon.kill("SIGTERM");
		await daemon.exited;
		await x("pkill", ["-f", dir]);
	};

	return { dir, stateDir, user, runProgram, stopProgram, resultOf, events, stop };
};
