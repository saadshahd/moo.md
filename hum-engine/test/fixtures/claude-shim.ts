import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * A stand-in for the `claude` binary. HUM_SHIM holds JSON: `{version, log, script}`.
 * Each `-p` call takes the next behavior of `script` (the last one repeats) and logs one JSON line:
 * its argv, the SHA-256 and size of its stdin, and its pid.
 */
type Behavior = {
	/** Files to write and commit in the working directory. */
	commit?: Record<string, string>;
	/** A structured result. */
	structured?: unknown;
	plugins?: string[];
	keySource?: string;
	/** An error result with this text. */
	error?: string;
	/** A rate_limit_event that rejects, with `resetsAt` in epoch seconds. */
	rejectUntil?: number;
	/** One assistant message with this many output tokens, then the shim sleeps. */
	spend?: number;
	hang?: boolean;
	modelTokens?: number;
	/** A file the shim writes its stdin to. */
	saveStdin?: string;
	subtype?: string;
};

// SAFETY: the test that starts this shim wrote HUM_SHIM as JSON of this shape.
const spec = JSON.parse(process.env.HUM_SHIM ?? "{}") as {
	version?: string;
	log?: string;
	script?: Behavior[];
};

if (process.argv.includes("--version")) {
	console.log(`${spec.version ?? "2.1.316"} (Claude Code)`);
	process.exit(0);
}

const stdin = await Bun.stdin.bytes();
const log = spec.log ?? "/dev/null";

mkdirSync(dirname(log), { recursive: true });

const calls = (() => {
	try {
		return readFileSync(log, "utf8").split("\n").filter(Boolean).length;
	} catch {
		return 0;
	}
})();

appendFileSync(
	log,
	`${JSON.stringify({ argv: process.argv.slice(2), stdinBytes: stdin.length, stdinSha: createHash("sha256").update(stdin).digest("hex"), pid: process.pid, cwd: process.cwd() })}\n`,
);

const script = spec.script ?? [{}];
const step = script[Math.min(calls, script.length - 1)] ?? {};

const session =
	process.argv[process.argv.indexOf("--session-id") + 1] ?? "no-session";

// A stand-in speaks whatever shape the test needs; the runner under test parses it.
type Emitted = { type: string } & Record<string, string | number | boolean | object | undefined>; // oxlint-disable-line anti-slop/no-unsafe-dictionary-type

const out = (event: Emitted) =>
	console.log(JSON.stringify({ session_id: session, ...event }));

if (step.saveStdin) writeFileSync(step.saveStdin, stdin);

out({
	type: "system",
	subtype: "init",
	apiKeySource: step.keySource ?? "none",
	plugins: (step.plugins ?? ["hope"]).map((name) => ({ name })),
});

if (step.rejectUntil !== undefined) {
	out({
		type: "rate_limit_event",
		rate_limit_info: { status: "rejected", resetsAt: step.rejectUntil },
	});
}

if (step.spend !== undefined) {
	out({
		type: "assistant",
		message: {
			id: `msg_${calls}`,
			usage: {
				input_tokens: 1,
				output_tokens: step.spend,
				cache_creation_input_tokens: 0,
			},
		},
	});
}

if (step.hang) await new Promise((resolve) => setTimeout(resolve, 60_000));

if (step.commit) {
	for (const [path, content] of Object.entries(step.commit)) {
		mkdirSync(dirname(join(process.cwd(), path)), { recursive: true });
		writeFileSync(join(process.cwd(), path), content);
	}

	spawnSync("git", ["add", "-A"]);
	spawnSync("git", [
		"-c",
		"user.name=shim",
		"-c",
		"user.email=shim@t",
		"commit",
		"-q",
		"-m",
		"shim: the change",
	]);
}

const tokens = step.modelTokens ?? 10;

out({
	type: "result",
	subtype: step.subtype ?? (step.error ? "error_during_execution" : "success"),
	is_error: step.error !== undefined,
	result: step.error ?? '{"ok":true}',
	structured_output: step.structured ?? { ok: true },
	modelUsage: {
		"claude-haiku-5-5": {
			inputTokens: 1,
			outputTokens: tokens,
			cacheCreationInputTokens: 0,
		},
	},
});
