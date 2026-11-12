import { afterAll, afterEach, beforeEach } from "bun:test";
import { runEnded, testEnded, testStarted } from "./fixtures/temp.ts";

/* Bun runs a hook an imported module registers for the first test file of a process only, and a preloaded one for every file. */
beforeEach(testStarted);

afterEach(testEnded);

afterAll(runEnded);
