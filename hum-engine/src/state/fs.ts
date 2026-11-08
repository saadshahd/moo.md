import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { Json } from "../config/json.ts";

const RECORD_EXTENSION = ".json";

/** Hex characters of the hash a slug keeps. A change renames every saved file. */
const SLUG_LENGTH = 32;

/** A file name for any string: the same string always names the same file, and no string escapes its folder. */
export const slug = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, SLUG_LENGTH);

const hasCode = (cause: unknown, code: string): boolean => cause instanceof Error && "code" in cause && cause.code === code;

/** True when the error says the file or folder is not there. */
export const isMissing = (cause: unknown): boolean => hasCode(cause, "ENOENT");

/** What `read` returns, or `absent` when it finds no file. Any other failure throws. */
export const orMissing = <T, Absent>(read: () => T, absent: Absent): T | Absent => {
	try {
		return read();
	} catch (error) {
		if (isMissing(error)) return absent;

		throw error;
	}
};

/** The JSON in a file; the caller parses it with its schema. */
export const readJson = (path: string): Json => Json.parse(JSON.parse(readFileSync(path, "utf8")));

/** write-file-atomic renames a synced temp file over the target; the rename itself reaches disk only once its folder is synced. */
const syncFolder = (folder: string): void => {
	const fd = openSync(folder, "r");

	try {
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
};

/** A reader sees the old file or the new one, never a part; when any step throws, the old file stays as it was. */
export const atomicWrite = (path: string, data: string): void => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileAtomic.sync(path, data);
	syncFolder(dirname(path));
};

/**
 * Creates `path` whole or not at all: the data is written to a temp file, then linked into place, which fails
 * when `path` exists. Returns false, changing nothing, in that case.
 */
export const createOnce = (path: string, data: string): boolean => {
	const temp = `${path}.${randomUUID()}`;

	atomicWrite(temp, data);

	try {
		linkSync(temp, path);
		syncFolder(dirname(path));

		return true;
	} catch (error) {
		if (hasCode(error, "EEXIST")) return false;

		throw error;
	} finally {
		rmSync(temp, { force: true });
	}
};

/** The files in a folder; empty when the folder does not exist. */
export const listFiles = (folder: string): string[] =>
	orMissing(
		() =>
			readdirSync(folder)
				.sort()
				.map((name) => join(folder, name)),
		[],
	);

/** The record files in a folder, without the half-written temp files a crash leaves beside them. */
export const listRecords = (folder: string): string[] => listFiles(folder).filter((file) => file.endsWith(RECORD_EXTENSION));
