import type { PluginOptions } from "claude-code";

export type ViewSettings = { readonly pollSeconds: number; readonly amberAfterSeconds: number };

const numberOption = (options: PluginOptions, key: keyof ViewSettings): number => {
	const seconds = Number(options[key]);

	if (!(seconds >= 1)) throw new Error(`hum: the option ${key} must be a number of at least 1 second, got ${JSON.stringify(options[key])}`);

	return seconds;
};

/** The manifest's `userConfig` fills the defaults; a value outside its rule fails the load. */
export const viewSettings = (options: PluginOptions): ViewSettings => ({
	pollSeconds: numberOption(options, "pollSeconds"),
	amberAfterSeconds: numberOption(options, "amberAfterSeconds"),
});
