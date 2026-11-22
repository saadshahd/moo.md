import { build } from "plist";
import type { UnitBuilder } from "./unit.ts";

/** A launchd job that starts at load and again after any exit but 0: the start script exits 0 only once stopped, and 75 for an update. */
export const launchdUnit: UnitBuilder = ({ label, repo, command, path, env, log, restartDelaySeconds }) =>
	build({
		Label: label,
		ProgramArguments: [...command],
		WorkingDirectory: repo,
		EnvironmentVariables: { PATH: path, ...env },
		RunAtLoad: true,
		KeepAlive: { SuccessfulExit: false },
		ThrottleInterval: restartDelaySeconds,
		StandardOutPath: log,
		StandardErrorPath: log,
	});
