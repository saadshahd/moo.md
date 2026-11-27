import { readFileSync, statSync } from "node:fs";
import { z } from "zod";
import type { HumConfig } from "../config/schema.ts";
import { shellQuote } from "../exec.ts";
import { listRecords, orMissing } from "../state/fs.ts";
import { ADVISOR_AND_FAST_MODE_OFF, type Finished } from "./claude-p.ts";
import { billedTokens, cacheReadTokens, modelsOf, outputTokens, type RunTranscript } from "./transcript.ts";

/** The plugin a run hum starts as an agent turns off, so no run draws the band or polls. */
export const HUM_PLUGIN = "hum@moo.md";

/** The hook events that tell the engine where a run's transcript is: at its first prompt and at each stop. */
const HOOK_EVENTS = ["UserPromptSubmit", "Stop"] as const;

export const STOP_EVENT = "Stop";

/**
 * A hook command that saves the hook's input, which names the session and its transcript, as a file of its own. It
 * writes a temp file the folder's reader skips and renames it in, so a reader never meets half a report.
 */
const dropInto = (folder: string): string => {
	const at = shellQuote(folder);

	return `cat > ${at}/$$.part && mv ${at}/$$.part ${at}/$$.json`;
};

/** The settings every run hum starts as an agent begins with: hum's plugin, the advisor and fast mode off, the deny rules and auto mode's rules, and a hook that reports the run into `hooksFolder`. */
export const runSettings = ({ deniedRunCommands, runAutoMode }: Pick<HumConfig, "deniedRunCommands" | "runAutoMode">, hooksFolder: string, env: Readonly<Record<string, string>> = {}) => ({
	enabledPlugins: { [HUM_PLUGIN]: false },
	// A project's own settings may name an editor that waits for a window; a run has none, so its git would wait for good.
	env: { GIT_EDITOR: "true", ...env, ...ADVISOR_AND_FAST_MODE_OFF },
	permissions: { deny: deniedRunCommands.map((command) => `Bash(${command} *)`) },
	autoMode: { classifyAllShell: true, environment: runAutoMode.environment, allow: runAutoMode.allow, hard_deny: runAutoMode.hardDeny },
	hooks: Object.fromEntries(HOOK_EVENTS.map((event) => [event, [{ hooks: [{ type: "command", command: dropInto(hooksFolder) }] }]])),
});

const Reported = z.looseObject({ hook_event_name: z.string(), session_id: z.string(), transcript_path: z.string().optional() });

/** One report a run's hook dropped: when, for which event, and the session and transcript it names. */
export type HookReport = { readonly file: string; readonly at: number; readonly event: string; readonly sessionId: string; readonly transcriptPath: string | undefined };

/** The reports in a hooks folder, oldest name first; a file that is no report says nothing. */
export const hookReports = (folder: string): HookReport[] =>
	listRecords(folder).flatMap((file) => {
		const reported = orMissing(() => Reported.safeParse(JSON.parse(readFileSync(file, "utf8"))), undefined);

		return reported?.success ? [{ file, at: statSync(file).mtimeMs, event: reported.data.hook_event_name, sessionId: reported.data.session_id, transcriptPath: reported.data.transcript_path }] : [];
	});

/** The tool a run asks the owner with; Claude Code hands its hooks the owner's answers once they gave them. */
const QUESTION_TOOL = "AskUserQuestion";

const ANSWERED_EVENT = "PostToolUse";

/** What the answer hook prints once it reported the answer: Claude Code ends the run's turn there, so the run acts on none of the owner's words. */
const END_TURN = JSON.stringify({ continue: false, stopReason: "hum has your answer" });

/** The hooks of a run that asks the owner with AskUserQuestion: each answer they give is reported into `hooksFolder`, and the run's turn ends with it. */
export const answerHooks = (hooksFolder: string) => ({
	[ANSWERED_EVENT]: [{ matcher: QUESTION_TOOL, hooks: [{ type: "command", command: `${dropInto(hooksFolder)} && echo ${shellQuote(END_TURN)}` }] }],
});

const AnswerReport = z.looseObject({ hook_event_name: z.literal(ANSWERED_EVENT), tool_name: z.literal(QUESTION_TOOL) });

/** The answers Claude Code hands the hook: what the owner picked or typed, under each question's words. */
const Answered = z.looseObject({ tool_response: z.looseObject({ answers: z.record(z.string(), z.string()) }) });

/** The owner's answers to one AskUserQuestion call, as the answer hook reported them; `answers` is undefined where the report has no shape hum reads. */
export type OwnerAnswers = { readonly file: string; readonly at: number; readonly answers: Readonly<Record<string, string>> | undefined };

/** The owner's answers in a hooks folder, oldest first; a report of another hook or tool holds none. */
export const ownerAnswers = (folder: string): OwnerAnswers[] =>
	listRecords(folder)
		.flatMap((file) => {
			const report: unknown = orMissing(() => JSON.parse(readFileSync(file, "utf8")), undefined);

			return AnswerReport.safeParse(report).success ? [{ file, at: statSync(file).mtimeMs, answers: Answered.safeParse(report).data?.tool_response.answers }] : [];
		})
		.toSorted((one, other) => one.at - other.at);

/** What the run billed: its transcript's tokens, and the output tokens its job counts beyond them. */
export const tokensOf = (transcript: RunTranscript, jobOutputTokens = 0): number => billedTokens(transcript) + Math.max(0, jobOutputTokens - outputTokens(transcript));

type Ending = Pick<Finished, "subtype" | "isError" | "text" | "structured">;

/** The finished run a transcript and its ending make. */
export const finishedOf = (sessionId: string | undefined, transcript: RunTranscript, { subtype, isError, text, structured }: Ending, jobOutputTokens = 0): Finished => ({
	kind: "finished",
	subtype,
	isError,
	sessionId,
	text,
	structured,
	tokens: tokensOf(transcript, jobOutputTokens),
	cacheReadTokens: cacheReadTokens(transcript),
	plugins: [],
	keySource: undefined,
	models: modelsOf(transcript),
});

export const succeededWith = (structured: Finished["structured"]): Ending => ({ subtype: "success", isError: false, text: "", structured });

export const failedWith = (why: string, subtype = "error_during_execution"): Ending => ({ subtype, isError: true, text: why, structured: undefined });
