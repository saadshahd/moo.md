import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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
 * its hooks drop, the row hum started for it, the mark that hum sent the row its one note, when roundup first showed
 * the row waiting on the owner, and for a run the owner talks to, what a look at its row reads while no pass watches it.
 */
export type RunFolder = { readonly root: string; readonly schema: string; readonly answers: string; readonly hooks: string; readonly row: string; readonly noted: string; readonly asked: string; readonly talk: string };

export const runFolderAt = (root: string): RunFolder => ({
	root,
	schema: join(root, "schema.json"),
	answers: join(root, "answers"),
	hooks: join(root, "hooks"),
	row: join(root, "row.json"),
	noted: join(root, "noted"),
	asked: join(root, "asked.json"),
	talk: join(root, "talk.json"),
});

/** The folder of every run under hum's state; the secret beside them is no run. */
export const runFolders = (stateDir: string): RunFolder[] => listFiles(join(stateDir, ROWS_DIR)).filter((root) => basename(root) !== SECRET_FILE).map(runFolderAt);

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

/** Whether the run saved an answer that hum has not taken, whether or not it would count. */
export const hasSavedAnswer = (folder: RunFolder): boolean => listFiles(folder.answers).length > 0;

/** Drops every answer the run saved so far, so only one it saves from now on can count. */
export const dropAnswers = (folder: RunFolder): void => {
	for (const file of listFiles(folder.answers)) rmSync(file, { force: true });
};

/** When roundup first showed a row waiting on the owner. */
const AskedMark = z.strictObject({ since: z.number() });

/** When roundup first showed the run's row waiting on the owner, if it has. */
export const askedSince = (folder: RunFolder): number | undefined => orMissing(() => AskedMark.parse(JSON.parse(readFileSync(folder.asked, "utf8"))).since, undefined);

/** Keeps the first time roundup showed the run's row waiting on the owner; a later one changes nothing. */
export const markAsked = (folder: RunFolder, since: number): void => {
	if (askedSince(folder) === undefined) atomicWrite(folder.asked, JSON.stringify({ since }));
};

type Saved = z.infer<typeof Saved>;

/** What hum keeps of a run the owner talks to, so it looks at the run's row while no pass watches it: the item, and the tokens the run may spend. */
const TalkRun = z.strictObject({ item: z.string(), tokenCap: z.number().optional() });

export type TalkRun = z.infer<typeof TalkRun>;

export const keepTalkRun = (folder: RunFolder, talk: TalkRun): void => atomicWrite(folder.talk, JSON.stringify(talk));

/** What hum keeps of the run, where the owner talks to it. */
export const talkRunOf = (folder: RunFolder): TalkRun | undefined => orMissing(() => TalkRun.parse(JSON.parse(readFileSync(folder.talk, "utf8"))), undefined);

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
