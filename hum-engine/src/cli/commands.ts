/** One `hum <op>`, as `hum help --json` prints it. */
export type Command = { readonly summary: string };

/** Every `hum <op>`, keyed by its name. */
export const commands: ReadonlyMap<string, Command> = new Map();
