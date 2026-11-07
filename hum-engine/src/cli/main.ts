#!/usr/bin/env bun
import pkg from "../../package.json" with { type: "json" };
import { commands } from "./commands.ts";

const op = process.argv[2];

if (op === "--version") {
	console.log(pkg.version);
} else {
	const ops = [...commands.keys()].join(", ") || "none yet";
	console.error(`hum: unknown op "${op ?? ""}"; ops: ${ops}`);
	process.exit(2);
}
