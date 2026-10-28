/**
 * What differs between the machines a worker runs on, as data, chosen by `process.platform`.
 * The worker logs to stdout; launchd or the systemd user unit setup writes names its file.
 */

import type { Run } from "../lib/github.ts";

type IdSource = { argv: readonly string[]; read: (out: string) => string | undefined };

export type Platform = {
  /** Commands that print this machine's stable id, tried in order until one reads an id. */
  machineId: readonly IdSource[];
  /**
   * The command that keeps the machine from sleeping until process `pid` exits, or null where
   * the worker can't hold it: on Linux, `systemd-inhibit` from a user unit is denied by polkit.
   */
  awake: ((pid: number) => string[]) | null;
};

const fileId = (path: string): IdSource => ({ argv: ["cat", path], read: (out) => out.trim() || undefined });

const PLATFORMS = {
  darwin: {
    machineId: [
      {
        argv: ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
        read: (out) => /"IOPlatformUUID" = "([^"]+)"/.exec(out)?.[1],
      },
    ],
    awake: (pid) => ["caffeinate", "-i", "-w", String(pid)],
  },
  linux: {
    machineId: [fileId("/etc/machine-id"), fileId("/var/lib/dbus/machine-id")],
    awake: null,
  },
} satisfies { [P in "darwin" | "linux"]: Platform };

export const platformOf = (p: string): Platform | null =>
  p === "darwin" || p === "linux" ? PLATFORMS[p] : null;

/** The first id any source reads; a machine with none fails naming every source it tried. */
export async function machineId(run: Run, p: Platform): Promise<string> {
  const failed: string[] = [];

  for (const s of p.machineId) {
    const r = await run(s.argv);
    const id = r.exitCode === 0 ? s.read(r.stdout) : undefined;

    if (id !== undefined) return id;
    failed.push(`\`${s.argv.join(" ")}\` ${r.exitCode === 0 ? "printed no id" : `failed: ${r.stderr.trim()}`}`);
  }

  throw new Error(`no machine id: ${failed.join("; ")}`);
}
