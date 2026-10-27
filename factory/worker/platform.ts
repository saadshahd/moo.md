/**
 * What differs between the machines a worker runs on, as data, chosen by `process.platform`.
 * The worker logs to stdout; launchd or the systemd user unit setup writes names its file.
 */

export type Platform = {
  /** The command that prints this machine's stable id, and how to read the id from its output. */
  machineId: { argv: readonly string[]; read: (out: string) => string | undefined };
  /** The command that keeps the machine from sleeping until process `pid` exits. */
  awake: (pid: number) => string[];
};

const PLATFORMS = {
  darwin: {
    machineId: {
      argv: ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
      read: (out) => /"IOPlatformUUID" = "([^"]+)"/.exec(out)?.[1],
    },
    awake: (pid) => ["caffeinate", "-i", "-w", String(pid)],
  },
  linux: {
    machineId: { argv: ["cat", "/etc/machine-id"], read: (out) => out.trim() || undefined },
    awake: (pid) => [
      "systemd-inhibit",
      "--what=sleep:idle",
      "--who=factory",
      "--why=a factory run is working",
      "tail",
      `--pid=${pid}`,
      "-f",
      "/dev/null",
    ],
  },
} satisfies { [P in "darwin" | "linux"]: Platform };

export const platformOf = (p: string): Platform | null =>
  p === "darwin" || p === "linux" ? PLATFORMS[p] : null;
