#!/usr/bin/env bun
import pkg from "../../package.json" with { type: "json" };
import { commands, isOp } from "./commands.ts";
import { runOp } from "./ops.ts";

const [op, ...argv] = process.argv.slice(2);
const io = { cwd: process.cwd(), stdout: (text: string) => void process.stdout.write(text), stderr: (text: string) => void process.stderr.write(text) };

if (op === "--version") {
	console.log(pkg.version);
} else if (op === "help") {
	console.log(argv.includes("--json") ? JSON.stringify(commands) : Object.values(commands).map((c) => c.usage).join("\n"));
} else if (isOp(op)) {
	process.exitCode = await runOp(op, argv, io);
} else {
	console.error(`hum: unknown op "${op ?? ""}"; ops: ${Object.keys(commands).join(", ")}`);
	process.exit(2);
}
