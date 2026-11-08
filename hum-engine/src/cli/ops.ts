import { Command, CommanderError, Option } from "commander";
import { x } from "tinyexec";
import { z } from "zod";
import { type ClaimResult, type Item, type ItemRef, PermanentError, Watch } from "../adapter-api.ts";
import { pushArgs } from "../adapters/git.ts";
import { resolveAdapters, type Slot } from "../adapters/registry.ts";
import { readSettings } from "../config/settings.ts";
import { HumConfig } from "../config/schema.ts";
import { dropInto } from "../state/fs.ts";
import { defaultStateDir, openState } from "../state/open.ts";
import pkg from "../../package.json" with { type: "json" };
import { type OpName, commands, type Flag, opSpecs } from "./commands.ts";
import { addServiceCommands } from "./service.ts";
import { sharedWatch } from "./shared-watch.ts";
import { SECOND_MS } from "../time.ts";

type Printable = ItemRef[] | ItemRef | Item | ClaimResult | Watch | { readonly ok: true };

export type Io = {
	readonly cwd: string;
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
};

const EXIT_FAILED = 1;
const EXIT_MISUSED = 2;

const OK = { ok: true } as const;

const CliSettings = z.looseObject({
	claimExpirySeconds: HumConfig.shape.claimExpirySeconds,
	watchCacheSeconds: HumConfig.shape.watchCacheSeconds,
	watchLockSeconds: HumConfig.shape.watchLockSeconds,
});

type CliSettings = z.infer<typeof CliSettings>;

type Flags = { ttl?: number; renew?: boolean; option?: string | string[]; since?: string; body?: string };

type Adapters = Awaited<ReturnType<typeof resolveAdapters>>;

/** What every op reads: its positional arguments, flags and the integrations `hum.json` names. */
type Call = {
	/** The first positional argument. */
	readonly item: string;
	/** The second positional argument. */
	readonly second: string;
	/** Every positional argument after the first, as one text. */
	readonly text: string;
	readonly flags: Flags;
	readonly options: readonly string[];
	readonly stateDir: string;
	/** The folder the worker reads item ids from at once. */
	readonly inbox: string;
	readonly settings: CliSettings;
	/** The integration role of a slot; throws when none is set up. */
	readonly slot: <T>(name: Slot, role: (adapter: NonNullable<Adapters[Slot]>) => T | undefined) => T;
};

const performed = async (action: Promise<void>): Promise<Printable> => {
	await action;

	return OK;
};

type Handler = (call: Call) => Promise<Printable>;

const handlers = {
	"list-ready": ({ slot }) => slot("work-source", (a) => a.workSource).listReady(),
	claim: ({ slot, item, second: holder, flags, settings }) => {
		const source = slot("work-source", (a) => a.workSource);
		const ttlMs = (flags.ttl ?? settings.claimExpirySeconds) * SECOND_MS;

		return (flags.renew ? source.renew : source.claim)(item, holder, ttlMs);
	},
	read: ({ slot, item }) => slot("work-source", (a) => a.workSource).read(item),
	comment: ({ slot, item, text }) => performed(slot("work-source", (a) => a.workSource).comment(item, text)),
	ask: ({ slot, item, text, options }) => performed(slot("questions", (a) => a.questions).ask(item, { text: text, options: options.length > 0 ? options : undefined })),
	answer: async ({ slot, item, text, options, inbox }) => {
		await slot("answers", (a) => a.answers).answer(item, { text, option: options[0] });
		dropInto(inbox, item);

		return OK;
	},
	watch: ({ slot, stateDir, inbox, flags, settings }) => {
		const answers = slot("answers", (a) => a.answers);

		if (flags.since !== undefined) return answers.watch(flags.since).then((found) => Watch.parse(found));

		return sharedWatch({
			stateDir,
			now: Date.now,
			cacheMs: settings.watchCacheSeconds * SECOND_MS,
			lockMs: settings.watchLockSeconds * SECOND_MS,
			read: async (since) => Watch.parse(await answers.watch(since)),
			changed: () => dropInto(inbox, ""),
		});
	},
	"file-follow-up": ({ slot, item, second, flags }) => slot("work-source", (a) => a.workSource).fileFollowUp(item, { title: second, body: flags.body ?? "" }),
	decide: ({ slot, item, text }) => performed(slot("questions", (a) => a.questions).decide(item, text)),
	publish: ({ slot, item, second }) => performed(slot("release", (a) => a.release).publish(item, second)),
	release: ({ slot, item, second }) => performed(slot("release", (a) => a.release).release(item, second)),
} as const satisfies Record<Exclude<OpName, "push">, Handler>;

const callOf = async (positionals: readonly string[], flags: Flags, io: Io): Promise<Call> => {
	const stateDir = await defaultStateDir(io.cwd);
	const state = openState(stateDir);
	const settings = readSettings(io.cwd, CliSettings);

	const adapters = await resolveAdapters(io.cwd, {
		faults: state.faults,
		guard: {},
		context: { report: (fault) => void state.faults.raise(fault), now: Date.now },
	});

	const [item = "", ...rest] = positionals;

	return {
		item,
		second: rest[0] ?? "",
		text: rest.join(" "),
		flags,
		options: [flags.option ?? []].flat(),
		stateDir,
		inbox: state.inbox,
		settings,
		slot: (name, role) => {
			const adapter = adapters[name];
			const found = adapter && role(adapter);

			if (!found) throw new PermanentError(`no ${name} integration is set up; name one under "integrations" in .hum/hum.json`);

			return found;
		},
	};
};

/** Runs one parsed `hum <op>` and returns its exit code: 0 done, 1 failed, 2 misused. */
const perform = async (op: OpName, positionals: readonly string[], flags: Flags, io: Io): Promise<number> => {
	if (op === "push") return (await x("git", pushArgs(positionals), { nodeOptions: { cwd: io.cwd, stdio: "inherit" } })).exitCode ?? EXIT_FAILED;

	try {
		const printed = await handlers[op](await callOf(positionals, flags, io));

		io.stdout(`${JSON.stringify(printed)}\n`);

		return 0;
	} catch (error) {
		io.stderr(`hum ${op}: ${error instanceof Error ? error.message : String(error)}\n`);

		return EXIT_FAILED;
	}
};

const optionOf = ({ flag, repeats, parse }: Flag): Option => {
	const option = new Option(flag);

	if (repeats) return option.default([]).argParser((word: string, seen: string[]) => [...seen, word]);

	return parse ? option.argParser(parse) : option;
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

		for (const flag of spec.flags ?? []) op.addOption(optionOf(flag));

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
		if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : EXIT_MISUSED;

		io.stderr(`hum ${argv[0] ?? ""}: ${error instanceof Error ? error.message : String(error)}\n`);

		return EXIT_FAILED;
	}

	return code;
};

/** Runs one `hum <op>` and returns its exit code: 0 done, 1 failed, 2 misused. */
export const runOp = (op: OpName, argv: readonly string[], io: Io): Promise<number> => runCli([op, ...argv], io);
