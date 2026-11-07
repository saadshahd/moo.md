import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Behavior } from "./shim.ts";

/**
 * A stand-in for the `claude` binary. HUM_SHIM holds JSON: `{version, log, script}`.
 * Each `-p` call takes the next behavior of `script` (the last one repeats) and logs one JSON line:
 * its argv, the SHA-256 and size of its stdin, and its pid.
 */

// SAFETY: the test that starts this shim wrote HUM_SHIM as JSON of this shape.
const spec = JSON.parse(process.env.HUM_SHIM ?? "{}") as {
	version?: string;
	log?: string;
	script?: Behavior[];
	/** A behavior per item id, for runs that go at the same time and cannot be told apart by their order. */
	items?: Record<string, Behavior>;
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

const prompt = new TextDecoder().decode(stdin);
const itemId = /^# Item (\S+):/m.exec(prompt)?.[1];

appendFileSync(
	log,
	`${JSON.stringify({ at: Date.now(), itemId, argv: process.argv.slice(2), stdinBytes: stdin.length, stdinSha: createHash("sha256").update(stdin).digest("hex"), pid: process.pid, cwd: process.cwd() })}\n`,
);

const script = spec.script ?? [{}];
const step = (itemId && spec.items?.[itemId]) || script[Math.min(calls, script.length - 1)] || {};

const session =
	process.argv[process.argv.indexOf("--session-id") + 1] ?? "no-session";

// A stand-in speaks whatever shape the test needs; the runner under test parses it.
type Emitted = { type: string } & Record<string, string | number | boolean | object | undefined>; // oxlint-disable-line anti-slop/no-unsafe-dictionary-type

const out = (event: Emitted) =>
	console.log(JSON.stringify({ session_id: session, ...event }));

const outSplit = async (event: Emitted) => {
	const line = `${JSON.stringify({ session_id: session, ...event })}\n`;
	const half = Math.floor(line.length / 2);

	await new Promise((resolve) => process.stdout.write(line.slice(0, half), resolve));
	await new Promise((resolve) => process.stderr.write("noise on stderr\n", resolve));
	await new Promise((resolve) => process.stdout.write(line.slice(half), resolve));
};

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

if (step.beforeToken) await new Promise((resolve) => setTimeout(resolve, step.beforeToken));

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

if (step.sleep) await new Promise((resolve) => setTimeout(resolve, step.sleep));

if (step.hang) await new Promise((resolve) => setTimeout(resolve, 60_000));

if (step.commitForItem && itemId) {
	mkdirSync(join(process.cwd(), "docs"), { recursive: true });
	appendFileSync(join(process.cwd(), "docs", `${itemId}.md`), `from ${itemId}\n`);
	spawnSync("git", ["add", "-A"]);
	spawnSync("git", ["-c", "user.name=shim", "-c", "user.email=shim@t", "commit", "-q", "-m", `shim: ${itemId}`]);
}

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

appendFileSync(`${log}.ends`, `${JSON.stringify({ pid: process.pid, at: Date.now() })}\n`);

await (step.stderrNoise ? outSplit : out)({
	type: "result",
	subtype: step.subtype ?? (step.error ? "error_during_execution" : "success"),
	is_error: step.error !== undefined,
	result: step.error ?? '{"ok":true}',
	structured_output: step.askUnlessAnswered && !prompt.includes("## The owner answered") ? { status: "needs-owner", question: step.askUnlessAnswered, plan: "Plan A" } : (step.structured ?? { ok: true }),
	modelUsage: {
		"claude-haiku-5-5": {
			inputTokens: 1,
			outputTokens: tokens,
			cacheCreationInputTokens: 0,
		},
	},
});
