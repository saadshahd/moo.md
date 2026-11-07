#!/usr/bin/env bun
import { runCli } from "./ops.ts";

process.exitCode = await runCli(process.argv.slice(2), {
	cwd: process.cwd(),
	stdout: (text) => void process.stdout.write(text),
	stderr: (text) => void process.stderr.write(text),
});
