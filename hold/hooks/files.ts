/** What a [view] shows a file as: a picture, or a markdown document. */
export type Kind = "picture" | "markdown";

/** WebP is left out: resvg, which turns pictures into the PNG an Image takes, reads no WebP. */
export function kindOf(path: string): Kind | null {
  if (/\.(png|jpe?g|gif|svg)$/i.test(path)) return "picture";
  if (/\.(md|markdown|mdx)$/i.test(path)) return "markdown";

  return null;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const rec = (v: unknown) =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * The pictures and markdown files a finished tool call read or changed, each once, in order:
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
      paths.filter((p): p is string => p !== undefined && kindOf(p) !== null),
    ),
  ];
}

/** The last part of a path, which names the file on its [view]. */
export const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * The most characters a markdown view shows: a drawing holds 100000 in all, and the row and its
 * buttons take some.
 */
export const MARKDOWN_MAX = 90_000;

/** Markdown as `Markdown` takes it: tab and newline its only control characters, `MARKDOWN_MAX` at most. */
export function cleanMarkdown(text: string): { text: string; isCut: boolean } {
  // eslint-disable-next-line no-control-regex
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");

  return clean.length <= MARKDOWN_MAX
    ? { text: clean, isCut: false }
    : { text: clean.slice(0, MARKDOWN_MAX), isCut: true };
}
