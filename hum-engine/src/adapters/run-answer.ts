import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { Json } from "../config/json.ts";
import { atomicWrite, dropInto, hasCode, listFiles, orMissing, slug } from "../state/fs.ts";
import type { RunRequest } from "./claude-p.ts";

/** The folder under hum's state that holds one folder per Rail row run, beside the secret every run's key comes from. */
export const ROWS_DIR = "rows";

const SECRET_FILE = "secret";

const SECRET_BYTES = 32;

/** Only the owner reads the secret. */
const PRIVATE = 0o600;

/**
 * What passes between hum and one run's row: the schema the answer must match, the answers the run saved, the reports
 * its hooks drop, the row hum started for it, and the mark that hum sent the row its one note.
 */
export type RunFolder = { readonly root: string; readonly schema: string; readonly answers: string; readonly hooks: string; readonly row: string; readonly noted: string };

export const runFolderAt = (root: string): RunFolder => ({
	root,
	schema: join(root, "schema.json"),
	answers: join(root, "answers"),
	hooks: join(root, "hooks"),
	row: join(root, "row.json"),
	noted: join(root, "noted"),
});

/** The folder of the run named `name`: the same name always names the same folder. */
export const runFolder = (stateDir: string, name: string): RunFolder => runFolderAt(join(stateDir, ROWS_DIR, slug(name)));

/** The secret hum keeps under its state, made at the first run that needs one. */
const secretOf = (stateDir: string): Buffer => {
	const path = join(stateDir, ROWS_DIR, SECRET_FILE);

	mkdirSync(dirname(path), { recursive: true });

	try {
		writeFileSync(path, randomBytes(SECRET_BYTES).toString("hex"), { mode: PRIVATE, flag: "wx" });
	} catch (error) {
		if (!hasCode(error, "EEXIST")) throw error;
	}

	return Buffer.from(readFileSync(path, "utf8"), "hex");
};

/** A run's key. The same run name always gives the same key, so a hum that restarts checks the answers of a row an earlier hum started. */
export const runKey = (stateDir: string, name: string): string => createHmac("sha256", secretOf(stateDir)).update(name).digest("hex");

/** What binds an answer to its run: a MAC under the run's key over the run's name and the answer's exact text. */
export const answerMac = (key: string, name: string, text: string): string => createHmac("sha256", key).update(`${name}\n${text}`).digest("hex");

const hasMacOf = (key: string, name: string, { mac, text }: Saved): boolean => {
	const expected = Buffer.from(answerMac(key, name, text), "hex");
	const given = Buffer.from(mac, "hex");

	return given.length === expected.length && timingSafeEqual(given, expected);
};

export type Checked = { readonly ok: true; readonly answer: Json } | { readonly ok: false; readonly why: string };

/** Whether `text` is one JSON value that matches `schema`, the JSON Schema of the run's request; a refusal names what to fix. */
export const checkAnswer = (schema: Json, text: string): Checked => {
	const parsed = Json.safeParse(orThrown(() => JSON.parse(text)));

	if (!parsed.success) return { ok: false, why: `the answer is no JSON value: ${text.trim().slice(0, 80) || "(empty)"}` };

	// SAFETY: the schema is the JSON Schema hum wrote from the run's request, made by zod's own toJSONSchema.
	const matched = z.fromJSONSchema(schema as z.core.JSONSchema.JSONSchema).safeParse(parsed.data);

	return matched.success ? { ok: true, answer: parsed.data } : { ok: false, why: z.prettifyError(matched.error) };
};

/** What `read` returns, or undefined when it throws, as JSON.parse does on text that is no JSON. */
const orThrown = <T>(read: () => T): T | undefined => {
	try {
		return read();
	} catch {
		return undefined;
	}
};

const Saved = z.strictObject({ mac: z.string(), text: z.string() });

type Saved = z.infer<typeof Saved>;

/** Writes the schema a run's answer must match, where its `hum run-answer` reads it. */
export const keepSchema = (folder: RunFolder, { schema }: Pick<RunRequest, "schema">): void => atomicWrite(folder.schema, JSON.stringify(schema));

export const readSchema = (folder: RunFolder): Json => Json.parse(JSON.parse(readFileSync(folder.schema, "utf8")));

/** Saves a checked answer for hum to take: a file of its own, so no answer replaces another. */
export const saveAnswer = (folder: RunFolder, key: string, name: string, text: string): void => dropInto(folder.answers, JSON.stringify({ mac: answerMac(key, name, text), text }));

const readSaved = (file: string): Saved | undefined => orThrown(() => Saved.safeParse(JSON.parse(orMissing(() => readFileSync(file, "utf8"), ""))).data);

const savedAt = (file: string): number => orMissing(() => statSync(file).mtimeMs, 0);

/**
 * The first answer saved from `since` on that carries the run's MAC and matches its schema. Every saved answer before
 * it, one saved earlier, written without the run's key or of the wrong shape, is removed unread by the run.
 */
export const takeAnswer = (folder: RunFolder, key: string, name: string, since = 0): Json | undefined => {
	for (const file of listFiles(folder.answers)) {
		const saved = readSaved(file);
		const checked = saved !== undefined && savedAt(file) >= since && hasMacOf(key, name, saved) ? checkAnswer(readSchema(folder), saved.text) : undefined;

		if (checked?.ok) return checked.answer;

		rmSync(file, { force: true });
	}

	return undefined;
};
