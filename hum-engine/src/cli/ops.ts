import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command, CommanderError } from "commander";
import { z } from "zod";
import { type ClaimResult, type Item, type ItemRef, PermanentError, Watch } from "../adapter-api.ts";
import { pushArgs } from "../adapters/git.ts";
import { resolveAdapters, type Slot } from "../adapters/registry.ts";
import { atomicWrite } from "../state/fs.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import pkg from "../../package.json" with { type: "json" };
import { type OpName, commands, opSpecs } from "./commands.ts";
import { addServiceCommands } from "./service.ts";

type Printable = ItemRef[] | ItemRef | Item | ClaimResult | Watch | { readonly ok: true };

export type Io = {
	readonly cwd: string;
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
};

const TIMEOUT_MS = 30_000;
const DEFAULT_TTL_S = 900;

const need = (value: string | undefined, usage: string): string => {
	if (value === undefined || value === "") throw new UsageError(usage);

	return value;
};

export class UsageError extends Error {
	override name = "UsageError";
}

type Flags = { ttl?: string; renew?: boolean; option?: string | string[]; since?: string; body?: string };

/** Runs one parsed `hum <op>` and returns its exit code: 0 done, 1 failed, 2 misused. */
const perform = async (op: OpName, positionals: readonly string[], values: Flags, io: Io): Promise<number> => {
	const usage = `usage: ${commands[op].usage}`;

	if (op === "push") {
		// C1: every argument goes to git; hooks are off whatever the clone's config says.
		return spawnSync("git", pushArgs(positionals), { cwd: io.cwd, stdio: "inherit" }).status ?? 1;
	}

	try {
		const state = openState(defaultStateDir(io.cwd));

		const adapters = await resolveAdapters(io.cwd, {
			faults: state.faults,
			guard: { timeoutMs: TIMEOUT_MS },
			context: { report: (fault) => void state.faults.raise(fault), now: Date.now },
		});

		const slot = <T>(name: Slot, role: (adapter: NonNullable<(typeof adapters)[Slot]>) => T | undefined): T => {
			const adapter = adapters[name];
			const found = adapter && role(adapter);

			if (!found) throw new PermanentError(`no ${name} integration is set up; name one under "integrations" in .hum/hum.json`);

			return found;
		};

		const [item, ...rest] = positionals;
		const text = rest.join(" ");
		const words = [values.option ?? []].flat();
		const print = (value: Printable) => io.stdout(`${JSON.stringify(value)}\n`);

		switch (op) {
			case "list-ready":
				print(await slot("work-source", (a) => a.workSource).listReady());
				break;
			case "claim": {
				const ws = slot("work-source", (a) => a.workSource);
				const seconds = Number(values.ttl ?? DEFAULT_TTL_S);

				if (!Number.isInteger(seconds) || seconds <= 0) throw new UsageError(`--ttl is a positive whole number of seconds; ${usage}`);

				const ttl = seconds * 1000;
				const holder = need(rest[0], usage);

				print(await (values.renew ? ws.renew : ws.claim)(need(item, usage), holder, ttl));
				break;
			}

			case "read":
				print(await slot("work-source", (a) => a.workSource).read(need(item, usage)));
				break;
			case "comment":
				await slot("work-source", (a) => a.workSource).comment(need(item, usage), need(text, usage));
				print({ ok: true });
				break;
			case "ask":
				await slot("questions", (a) => a.questions).ask(need(item, usage), { text: need(text, usage), options: words.length > 0 ? words : undefined });
				print({ ok: true });
				break;
			case "answer":
				await slot("answers", (a) => a.answers).answer(need(item, usage), words[0] === undefined ? { text: need(text, usage) } : { text: need(text, usage), option: words[0] });
				print({ ok: true });
				break;
			case "watch": {
				const file = join(state.dir, "watch.json");
				const seen = values.since ?? savedToken(file);
				const result = Watch.parse(await slot("answers", (a) => a.answers).watch(seen));

				atomicWrite(file, `${JSON.stringify({ token: result.token })}\n`);
				print(result);
				break;
			}

			case "file-follow-up":
				print(await slot("work-source", (a) => a.workSource).fileFollowUp(need(item, usage), { title: need(rest[0], usage), body: values.body ?? "" }));
				break;
			case "decide":
				await slot("questions", (a) => a.questions).decide(need(item, usage), need(text, usage));
				print({ ok: true });
				break;
			case "publish":
				await slot("release", (a) => a.release).publish(need(item, usage), need(rest[0], usage));
				print({ ok: true });
				break;
			case "release":
				await slot("release", (a) => a.release).release(need(item, usage), need(rest[0], usage));
				print({ ok: true });
				break;
		}
	} catch (error) {
		if (error instanceof UsageError) {
			io.stderr(`hum ${op}: ${error.message}\n`);

			return 2;
		}

		io.stderr(`hum ${op}: ${error instanceof Error ? error.message : String(error)}\n`);

		return 1;
	}

	return 0;
};

/** Runs `hum <argv>` (an op and its arguments) and returns its exit code: 0 done, 1 failed, 2 misused. */
export const runCli = async (argv: readonly string[], io: Io): Promise<number> => {
	let code = 0;

	const root = new Command("hum")
		.version(pkg.version)
		.enablePositionalOptions()
		.showHelpAfterError()
		.exitOverride()
		.configureOutput({ writeOut: io.stdout, writeErr: io.stderr });

	// SAFETY: `opSpecs` is a record keyed by `OpName`, so its entries are `OpName` pairs.
	for (const [name, spec] of Object.entries(opSpecs) as [OpName, (typeof opSpecs)[OpName]][]) {
		const op = root.command(`${name} ${spec.args}`).description(spec.summary);

		for (const { flag, repeats } of spec.flags ?? []) {
			if (repeats) op.option(flag, "", (word: string, seen: string[]) => [...seen, word], []);
			else op.option(flag);
		}

		// C1: `push` hands every argument, flags too, to git.
		if (name === "push") op.allowUnknownOption().allowExcessArguments().helpOption(false);

		op.action(async () => {
			code = await perform(name, op.processedArgs.flat(), op.opts(), io);
		});
	}

	root.command("help").description("Print every op's usage; --json prints the table roles read.").option("--json").action((flags: { json?: boolean }) => {
		io.stdout(`${flags.json ? JSON.stringify(commands) : Object.values(commands).map((c) => c.usage).join("\n")}\n`);
	});

	addServiceCommands(root, io, (exit) => {
		code = exit;
	});

	try {
		await root.parseAsync([...argv], { from: "user" });
	} catch (error) {
		if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2;

		// A service command failed before it could run: say why and fail loud.
		io.stderr(`hum ${argv[0] ?? ""}: ${error instanceof Error ? error.message : String(error)}\n`);

		return 1;
	}

	return code;
};

/** Runs one `hum <op>` and returns its exit code: 0 done, 1 failed, 2 misused. */
export const runOp = (op: OpName, argv: readonly string[], io: Io): Promise<number> => runCli([op, ...argv], io);

/** The token the last `hum watch` saw; none on the first call. */
const savedToken = (file: string): string | undefined => {
	try {
		return z.object({ token: z.string() }).parse(JSON.parse(readFileSync(file, "utf8"))).token;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;

		throw error;
	}
};
