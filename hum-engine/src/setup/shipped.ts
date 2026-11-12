import { join } from "node:path";
import { type RawConfig, readConfigDir } from "../config/load.ts";
import { DefaultsConfig, Kind } from "../config/schema.ts";

/** Where the shipped defaults sit, in the package or in the owner's `node_modules`. */
const DEFAULTS_DIR = join(import.meta.dir, "..", "..", "defaults");

export const shippedRaw = (): RawConfig => readConfigDir(DEFAULTS_DIR);

/** The config hum ships with, parsed: its settings and its kinds. */
export const shippedConfig = () => {
	const raw = shippedRaw();

	return { hum: DefaultsConfig.parse(raw.hum), kinds: Object.fromEntries(Object.entries(raw.kinds).map(([name, file]) => [name, Kind.parse(file)])) };
};
