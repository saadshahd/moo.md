/** WebP is left out: resvg, which turns pictures into the PNG an Image takes, reads no WebP. */
const isPicture = (path: string) => /\.(png|jpe?g|gif|svg)$/i.test(path);

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const rec = (v: unknown) =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * The pictures a finished tool call read or changed, each once, in order:
 * Read, Write and Edit name theirs in `file_path`; Bash in the files its command changed.
 */
export function viewable(
  tool: string,
  input: unknown,
  output: unknown,
): string[] {
  const paths: (string | undefined)[] = [];

  if (
    tool === "Read" ||
    tool === "Write" ||
    tool === "Edit" ||
    tool === "MultiEdit"
  )
    paths.push(str(rec(input).file_path), str(rec(output).filePath));

  if (tool === "Bash") {
    const diff = rec(rec(output).bashEditDiff);
    const files = Array.isArray(diff.files) ? diff.files : [];
    const changed = Array.isArray(diff.changedFiles) ? diff.changedFiles : [];

    for (const f of files)
      if (!rec(f).deleted) paths.push(str(rec(f).filePath));
    paths.push(...changed.map(str));
  }

  return [
    ...new Set(
      paths.filter((p): p is string => p !== undefined && isPicture(p)),
    ),
  ];
}

/** The last part of a path: the file's name. */
export const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * The file's name on its [view], cut at its first dot. roundup opens a printed file name on a
 * plain click and keeps the click from Claude Code, so a label holds no dot and no slash.
 */
export const labelOf = (path: string) =>
  nameOf(path).replace(/^\.+/, "").split(".")[0] || "file";
