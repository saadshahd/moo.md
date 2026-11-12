import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The temp folders made while a test runs, and those made outside one or kept for the run. test/preload.ts removes both. */
const forTest: string[] = [];
const forRun: string[] = [];
let testRunning = false;

const removed: string[] = [];
const unsettled: (() => Promise<void>)[] = [];

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

/** Work a test starts and may leave going, such as a worker's queue: the test's end waits for it before its folders go. */
export const settleAtTestEnd = (settle: () => Promise<void>): void => void unsettled.push(settle);

export const testEnded = async (): Promise<void> => {
	for (const settle of unsettled.splice(0)) await settle();

	testRunning = false;
	removed.push(...forTest);
	removeAll(forTest);
};

/** Removes the run's folders, and fails when a test's folder came back: work the test started went on after it ended. */
export const runEnded = (): void => {
	removeAll(forRun);

	const back = removed.splice(0).filter((folder) => existsSync(folder));

	for (const folder of back) rmSync(folder, { recursive: true, force: true });

	if (back.length > 0) throw new Error(`work went on after its test ended and wrote into ${back.join(", ")}`);
};
