/** A line the mod shows the owner, led by its name. */
export const humSays = (message: string): string => `hum: ${message}`;

/** What a failed hum said, without its own `hum <op>:` lead. */
export const failureOf = ({ exitCode, stderr }: { readonly exitCode: number; readonly stderr: string }): string => stderr.trim().replace(/^hum [\w-]+: /, "") || `exited ${exitCode}`;
