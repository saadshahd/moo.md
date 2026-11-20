import { realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { type RoundupClient, RoundupRefusal, roundupRpc } from "../adapters/roundup-rpc.ts";
import type { Env } from "../exec.ts";

/** Where the owner names the Project's program in roundup: its menu item, then the section. */
export const PROGRAM_PLACE = "Project ▸ Open Project settings… ▸ Program";

/** What the owner does once the fields are in, since setting a program starts nothing by itself. */
export const PROGRAM_START = "Start on the Program row at the foot of the Rail";

/** The fix for a Program that differs from the one setup printed. */
export const PROGRAM_FIX = `In ${PROGRAM_PLACE}, enter what \`hum setup write\` printed, then start the Program again from its row on the Rail.`;

/** A Project's program as roundup stores it, and as `project.setProgram` takes it. */
export const ProgramEntry = z.looseObject({ argv: z.array(z.string()), dir: z.string(), adoptDir: z.string().optional() });

export type ProgramEntry = z.infer<typeof ProgramEntry>;

const ProgramRun = z.looseObject({ state: z.string(), terminalId: z.string().optional() });

const Project = z.looseObject({ program: ProgramEntry.nullable() });

/** The folder roundup reads a blank `Folder` as: the Project's own. */
const PROJECT_FOLDER = ".";

/** The labels of roundup's Program section, in its order. */
const LABELS = ["Command", "Folder", "Worktree path"] as const;

export type ProgramFields = Readonly<Record<(typeof LABELS)[number], string>>;

/** A word with a space or a quote, which roundup reads only inside the other quote: it splits a command by quotes alone. */
const QUOTED = /[\s'"]/u;

const commandWord = (word: string): string => {
	if (word !== "" && !QUOTED.test(word)) return word;

	return word.includes('"') ? `'${word}'` : `"${word}"`;
};

/** `hum serve` from the repo's pinned engine, run by `bun`. */
export const serveCommand = (repo: string, bun: string): string[] => [bun, join(repo, "node_modules", ".bin", "hum"), "serve"];

/**
 * The program setup names: `hum serve` in the Project folder, adopting run slots in `pool`. The repo is read as its
 * real path, as roundup starts the program there.
 */
export const programEntry = (repo: string, pool: string, bun: string): Required<ProgramEntry> => {
	const real = realpathSync(repo);

	return { argv: serveCommand(real, bun), dir: PROJECT_FOLDER, adoptDir: relative(real, resolve(real, pool)) };
};

/** `entry` as the owner reads and enters it in roundup's Program section; the Project folder is a blank Folder. */
export const programFields = ({ argv, dir, adoptDir }: ProgramEntry): ProgramFields => ({
	Command: argv.map(commandWord).join(" "),
	Folder: dir === PROJECT_FOLDER ? "" : dir,
	"Worktree path": adoptDir ?? "",
});

/** The one step the owner takes so roundup runs hum: where to go, what to enter, and how to start it. */
export const programStep = (entry: ProgramEntry) => ({ open: PROGRAM_PLACE, fields: programFields(entry), start: PROGRAM_START });

export type ProgramStep = ReturnType<typeof programStep>;

/** roundup's program as this process reads it: the entry stored, and whether this process runs in the program's Terminal. */
export type ProgramRead = { readonly client: RoundupClient; readonly entry: ProgramEntry | null; readonly isThisProcess: boolean };

/**
 * The Project's program, where roundup serves this process's shell, with the connection that read it. Outside
 * roundup, or where its socket no longer answers, as in a shell left from an earlier start, nothing.
 */
export const readProgram = async (env: Env): Promise<ProgramRead | undefined> => {
	if (env.RUPD_SOCKET === undefined) return undefined;

	const client = roundupRpc(env.RUPD_SOCKET);

	try {
		const [run, project] = await Promise.all([client.call("project.programRun"), client.call("project.get")]);
		const { state, terminalId } = ProgramRun.parse(run);

		return { client, entry: Project.parse(project).program, isThisProcess: state === "running" && terminalId !== undefined && terminalId === env.ROUNDUP_TERMINAL };
	} catch (error) {
		client.close();

		if (error instanceof RoundupRefusal) throw error;

		return undefined;
	}
};

/** What keeps this process from serving as the Program setup printed, one clause each in the App's words; none when nothing does. */
export const programDifferences = ({ entry, isThisProcess }: Pick<ProgramRead, "entry" | "isThisProcess">, printed: ProgramEntry): string[] => {
	if (entry === null) return ["this Project names no Program"];

	const [stored, wanted] = [programFields(entry), programFields(printed)];
	const fields = LABELS.flatMap((label) => (stored[label] === wanted[label] ? [] : [`its ${label} is "${stored[label]}", where setup printed "${wanted[label]}"`]));

	return isThisProcess ? fields : [...fields, "this hum serve is not the Program roundup started"];
};
