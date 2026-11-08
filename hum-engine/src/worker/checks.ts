import { x } from "tinyexec";

/** A check runs with no stdin and the worker's own PATH, as in the owner's shell; the clone's `node_modules/.bin` is not added. */
const shellOut = async (command: string, cwd: string): Promise<{ code: number | undefined; output: string }> => {
	const { exitCode, stdout, stderr } = await x("sh", ["-c", command], { nodePath: false, nodeOptions: { cwd, stdio: ["ignore", "pipe", "pipe"] } });

	return { code: exitCode, output: `${stdout}${stderr}` };
};

/** The first failing check as its command, exit code and output; undefined when all pass. */
export const runChecks = async (commands: readonly string[], cwd: string): Promise<string | undefined> => {
	for (const command of commands) {
		const ran = await shellOut(command, cwd);

		if (ran.code !== 0) return `${command} exited ${ran.code}:\n${ran.output}`;
	}

	return undefined;
};
