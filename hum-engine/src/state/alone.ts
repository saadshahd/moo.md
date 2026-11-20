import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { SECOND_MS } from "../time.ts";
import { hasCode } from "./fs.ts";

/** proper-lockfile refuses a staleness under two seconds. */
export const STALE_FLOOR_MS = 2000;

/**
 * A start asks for a held lock for longer than the lock takes to go stale: a process that was killed could not let
 * go, and its lock stands at most that long, so a start right after a kill takes it.
 */
const ASKS = { retries: 5, factor: 1, minTimeout: SECOND_MS };

/**
 * Runs `use` while this process alone holds `hum <name>` on the state folder `dir`, and lets go however `use` ended.
 * A second `hum <name>` on that folder is refused; `lost` is called if another process takes the lock over.
 */
export const alone = async <T>(dir: string, name: string, lost: (error: Error) => void, use: () => Promise<T>): Promise<T> => {
	mkdirSync(dir, { recursive: true });

	/* proper-lockfile keys a process's locks by the path it is given, so each name gets its own, apart from the state folder's watch lock. */
	const release = await lock(join(dir, name), { lockfilePath: join(dir, `${name}.lock`), realpath: false, stale: STALE_FLOOR_MS, retries: ASKS, onCompromised: lost }).catch((error: Error) => {
		throw hasCode(error, "ELOCKED") ? new Error(`another \`hum ${name}\` runs on ${dir}: stop it before starting this one`) : error;
	});

	try {
		return await use();
	} finally {
		await release().catch((error: Error) => {
			if (!hasCode(error, "ERELEASED")) throw error;
		});
	}
};
