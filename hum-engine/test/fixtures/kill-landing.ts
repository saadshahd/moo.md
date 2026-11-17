/** Child process for the landing kill test: publishes one pass's outbox as a Mac does, and the remote kills it once the push moved the base. */
import { readFileSync, writeFileSync } from "node:fs";
import { Holder } from "../../src/adapter-api.ts";
import { type GatherTrust, type PassOutbox, publishPass } from "../../src/publish/publisher.ts";
import { openState } from "../../src/state/open.ts";
import { publisherOf } from "../../src/worker/thin-path.ts";
import { configWith } from "./config.ts";
import { docsJudge } from "./judge.ts";
import { markdownOn } from "./work-repo.ts";

/** What the test hands the child: the state folder, the remote, the work source's clone, the file the remote's hook reads the child's id from, and the pass to publish. */
type KillWorld = { readonly dir: string; readonly remote: string; readonly clone: string; readonly pidFile: string; readonly trust: GatherTrust; readonly outbox: PassOutbox };

const [file] = process.argv.slice(2);

if (!file) throw new Error("usage: kill-landing.ts <world.json>");

const world: KillWorld = JSON.parse(readFileSync(file, "utf8"));
const state = openState(world.dir, { now: Date.now });
const { workSource, questions } = markdownOn(world.clone, state.faults);
const runner = { run: () => Promise.reject(new Error("a landing runs no model")), limitedUntil: () => 0 };

writeFileSync(world.pidFile, String(process.pid));

await publishPass(publisherOf({ state, config: configWith(), workSource: workSource!, questions: questions!, runner, holder: Holder.parse("worker-1"), now: Date.now, remote: world.remote }, docsJudge), world.trust, world.outbox);
