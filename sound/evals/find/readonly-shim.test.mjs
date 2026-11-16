import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, copyFileSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = mkdtempSync(join(tmpdir(), "shim-test-"));
const real = join(root, "real"), shim = join(root, "shim");
for (const d of [real, shim]) Bun.spawnSync(["mkdir", "-p", d]);
for (const tool of ["gh", "curl"]) {
  writeFileSync(join(real, tool), "#!/bin/sh\necho ran\n"); chmodSync(join(real, tool), 0o755);
  copyFileSync(join(here, "readonly-shim.sh"), join(shim, tool)); chmodSync(join(shim, tool), 0o755);
}
const run = (tool, args) => Bun.spawnSync([join(shim, tool), ...args], { env: { PATH: "/usr/bin:/bin", REAL_PATH: real } });

const reads = [
  ["gh", ["api", "repos/o/r"]],
  ["gh", ["api", "repos/o/r/contributors?per_page=1", "--jq", ".[0]"]],
  ["gh", ["api", "-X", "GET", "search/repositories", "-f", "q=agent"]],
  ["gh", ["api", "--method=get", "search/repositories", "-F", "per_page=5"]],
  ["gh", ["search", "repos", "agent"]],
  ["gh", ["repo", "view", "o/r"]],
  ["curl", ["-sL", "https://registry.npmjs.org/x"]],
  ["curl", ["-s", "-H", "Accept: application/json", "-A", "ua", "https://pypi.org/pypi/x/json"]],
  ["curl", ["-X", "GET", "https://example.com"]],
];
const refused = [
  ["gh", ["api", "-X", "DELETE", "repos/o/r"]],
  ["gh", ["api", "-XPOST", "repos/o/r/forks"]],
  ["gh", ["api", "--method", "PATCH", "repos/o/r"]],
  ["gh", ["api", "--method=PUT", "repos/o/r"]],
  ["gh", ["api", "repos/o/r/issues", "-f", "title=x"]],
  ["gh", ["api", "repos/o/r/issues", "--field", "title=x"]],
  ["gh", ["api", "repos/o/r/issues", "--input", "body.json"]],
  ["gh", ["api", "graphql", "-f", "query=x"]],
  ["gh", ["repo", "delete", "o/r"]],
  ["gh", ["auth", "token"]],
  ["gh", ["pr", "merge", "1"]],
  ["curl", ["-X", "DELETE", "https://api.github.com/repos/o/r"]],
  ["curl", ["--request=POST", "https://example.com"]],
  ["curl", ["-d", "x=1", "https://example.com"]],
  ["curl", ["--data-binary", "@file", "https://example.com"]],
  ["curl", ["-sd", "x=1", "https://example.com"]],
  ["curl", ["-T", "file", "https://example.com"]],
  ["curl", ["--json", "{}", "https://example.com"]],
];

test.each(reads)("%s %j runs", (tool, args) => {
  const r = run(tool, args);
  expect(r.exitCode).toBe(0);
  expect(r.stdout.toString()).toBe("ran\n");
});
test.each(refused)("%s %j is refused", (tool, args) => {
  const r = run(tool, args);
  expect(r.exitCode).toBe(126);
  expect(r.stdout.toString()).toBe("");
});
