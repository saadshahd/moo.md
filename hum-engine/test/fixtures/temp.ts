import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The temp folders made while a test runs, and those made outside one or kept for the run. test/preload.ts removes both. */
const forTest: string[] = [];
const forRun: string[] = [];
let testRunning = false;

const removeAll = (folders: string[]) => {
	for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
};

const made = (name: string, owners: string[]): string => {
	const folder = mkdtempSync(join(tmpdir(), `hum-${name}-`));

	owners.push(folder);

	return folder;
};

/** A new temp folder, removed after the test that made it; one made outside a test lasts until the run ends. */
export const tempDir = (name: string): string => made(name, testRunning ? forTest : forRun);

/** A new temp folder that lasts until the run ends, for what a process builds once and copies for each test. */
export const runTempDir = (name: string): string => made(name, forRun);

export const testStarted = (): void => {
	testRunning = true;
};

export const testEnded = (): void => {
	testRunning = false;
	removeAll(forTest);
};

export const runEnded = (): void => removeAll(forRun);
