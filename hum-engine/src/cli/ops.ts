import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { type ClaimResult, type Item, type ItemRef, PermanentError, Watch } from "../adapter-api.ts";
import { pushArgs } from "../adapters/git.ts";
import { resolveAdapters, type Slot } from "../adapters/registry.ts";
import { atomicWrite } from "../state/fs.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import { type OpName, commands } from "./commands.ts";

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

/** Runs one `hum <op>` and returns its exit code: 0 done, 1 failed, 2 misused. */
export const runOp = async (op: OpName, argv: readonly string[], io: Io): Promise<number> => {
	const usage = `usage: ${commands[op].usage}`;

	if (op === "push") {
		// C1: every argument goes to git; hooks are off whatever the clone's config says.
		return spawnSync("git", pushArgs(argv), { cwd: io.cwd, stdio: "inherit" }).status ?? 1;
	}

	try {
		const { values, positionals } = parseArgs({
			args: [...argv],
			allowPositionals: true,
			options: { ttl: { type: "string" }, renew: { type: "boolean" }, option: { type: "string", multiple: true }, since: { type: "string" }, body: { type: "string" } },
		});

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
				await slot("questions", (a) => a.questions).ask(need(item, usage), { text: need(text, usage), options: values.option });
				print({ ok: true });
				break;
			case "answer":
				await slot("answers", (a) => a.answers).answer(need(item, usage), values.option?.[0] === undefined ? { text: need(text, usage) } : { text: need(text, usage), option: values.option[0] });
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
		if (error instanceof UsageError || (error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"))) {
			io.stderr(`hum ${op}: ${error.message}\n`);

			return 2;
		}

		io.stderr(`hum ${op}: ${error instanceof Error ? error.message : String(error)}\n`);

		return 1;
	}

	return 0;
};

/** The token the last `hum watch` saw; none on the first call. */
const savedToken = (file: string): string | undefined => {
	try {
		return z.object({ token: z.string() }).parse(JSON.parse(readFileSync(file, "utf8"))).token;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;

		throw error;
	}
};
