import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

/** A file name for any string: the same string always names the same file, and no string escapes its folder. */
export const slug = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 32);

const TEMP_SUFFIX = ".tmp";

const fsyncFolder = (folder: string) => {
	const fd = openSync(folder, "r");

	try {
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
};

/** Writes `data` to a new temp file beside `path` and fsyncs it. Removes the temp file and throws when the write fails. */
const writeTemp = (path: string, data: string): string => {
	mkdirSync(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${randomUUID()}${TEMP_SUFFIX}`;
	const fd = openSync(temp, "w");

	try {
		writeFileSync(fd, data);
		fsyncSync(fd);
	} catch (error) {
		rmSync(temp, { force: true });
		throw error;
	} finally {
		closeSync(fd);
	}

	return temp;
};

/**
 * D3, U1: temp file, fsync, rename. A reader sees the old file or the new one, never a part,
 * and when any step throws the old file stays as it was.
 */
export const atomicWrite = (path: string, data: string): void => {
	const temp = writeTemp(path, data);

	try {
		renameSync(temp, path);
		fsyncFolder(dirname(path));
	} catch (error) {
		rmSync(temp, { force: true });
		throw error;
	}
};

/** D4, E2: creates `path` whole or not at all. Returns false, changing nothing, when `path` exists. */
export const createOnce = (path: string, data: string): boolean => {
	const temp = writeTemp(path, data);

	try {
		linkSync(temp, path);
		fsyncFolder(dirname(path));

		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;

		throw error;
	} finally {
		rmSync(temp, { force: true });
	}
};

/** The files in a folder, without temp files; empty when the folder does not exist. */
export const listFiles = (folder: string): string[] => {
	try {
		return readdirSync(folder)
			.filter((name) => !name.endsWith(TEMP_SUFFIX))
			.sort()
			.map((name) => join(folder, name));
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];

		throw error;
	}
};

/** True when the error says the file or folder is not there. */
export const isMissing = (error: Error): boolean => "code" in error && error.code === "ENOENT";
