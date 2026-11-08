import { build } from "plist";
import type { UnitBuilder } from "./unit.ts";

/** A launchd job that starts at load and again after a failure only: the start script exits 0 when it gives up. */
export const launchdUnit: UnitBuilder = ({ label, repo, command, path, env, log }, restartDelaySeconds) =>
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
