// Child process for the slot fault test: take a slot for an item and die before any run starts.
import { SlotPool } from "../../src/slots/pool.ts";
import { openState } from "../../src/state/open.ts";
import { BASE, poolConfig } from "./slot-world.ts";

const [stateDir, repo, remote, pool, item] = process.argv.slice(2);

if (!stateDir || !repo || !remote || !pool || !item) throw new Error("usage: take-and-die.ts <state dir> <repo> <remote> <pool> <item>");

const slots = new SlotPool({ repo, state: openState(stateDir), config: poolConfig(pool, { runners: 1 }), base: BASE, now: Date.now });

await slots.checkout({ remote, base: BASE, item, signal: undefined });

process.kill(process.pid, "SIGKILL");
