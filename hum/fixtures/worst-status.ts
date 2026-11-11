import type { Card, Question, Status } from "../../hum-engine/src/status/format.ts";
import { fullStatus, NOW } from "./status.ts";

const ago = (seconds: number): number => NOW - seconds * 1000;

/** An item id at the engine's limit of 100 characters. */
export const LONGEST_ID = `${"release-workflow-rename-".repeat(4)}last`;

const CJK_TITLE = "日本語の題名".repeat(10);
const EMOJI_TITLE = "Ship 😀 now 👨‍👩‍👧 or wait 👩🏽‍💻 then 🏳️‍🌈 go";
const RTL_TITLE = "نور الهدى عبد الرحمن يراجع طلب الدمج";
const UNBROKEN_PATH = `/very/long/path/${"to/a/file/".repeat(6)}name.ts`;

/** The questions the engine allows at its limits (80 cells, no word over 40) and the ones it lets through unchecked. */
const worstQuestions: Question[] = [
	{ item: "68", text: `Should ${"path/".repeat(7)}name.ts keep its name?`, options: ["short", "long"], since: ago(5580) },
	{ item: "69", text: `${"日本語の題名".repeat(6)}日本?`, options: ["はい", "いいえ"], since: ago(0) },
	{ item: "70", text: `${EMOJI_TITLE}?`, options: [], since: ago(86_400 * 3 + 7200) },
	{ item: "71", text: "Which one?\nThe short title or\tthe long one?", options: ["a", "b"], since: ago(30) },
	{ item: "72", text: "Which of these?", options: ["x".repeat(40), "change", "approve", "日本語の選択肢", "j", "a-fairly-long-option-word", "k", "l", "m", "n", "o", "p"], since: ago(120) },
	{ item: LONGEST_ID, text: "?", options: [], since: ago(0) },
	{ item: "9999999", text: RTL_TITLE.concat("?"), options: [], since: NOW + 60_000 },
];

const worstCards: Card[] = [
	{
		kind: "fault",
		key: "guard:1",
		item: "71",
		code: "run-error",
		cause:
			"git fetch -q origin exited 128: fatal: unable to access 'https://example.com/acme/a-very-long-repository-name-that-never-ends.git/':\n\tCould not resolve host: example.com\nhint: check the network and try again",
		fix: "hum tries the item again when its claim lapses.",
		since: ago(300),
	},
	{
		kind: "fault",
		key: "ansi:1",
		item: "72",
		code: "check-failed",
		cause: "\u001b[31mFAIL\u001b[0m test/a.test.ts > renders the pane\u001b[2K\r expected 1 to be 2",
		fix: "Fix the test; hum runs the checks again.",
		action: { label: "Run it again", answer: "retry" },
		since: ago(45),
	},
	{
		kind: "limited",
		key: "usage-limit",
		code: "usage-limit",
		cause: `claude refused with a usage limit and no reset time hum can read: ${"You have hit your limit; ".repeat(8)}`,
		fix: "x".repeat(120),
		since: ago(1200),
	},
	{
		kind: "waiting",
		key: `waiting:${LONGEST_ID}`,
		item: LONGEST_ID,
		code: "review",
		cause: UNBROKEN_PATH,
		fix: "Approve it, or comment what to change.",
		action: { label: "承認して続ける", answer: "approve" },
		since: ago(600),
	},
	{ kind: "fault", key: "j", item: "j", code: "j", cause: "J", fix: "J", since: ago(1) },
	{ kind: "waiting", key: "emoji", item: "75", code: "review", cause: EMOJI_TITLE, fix: RTL_TITLE, action: { label: "x".repeat(14), answer: "x".repeat(14) }, since: 0 },
];

const flightsOf = (count: number): Status["inFlight"] =>
	Array.from({ length: count }, (_, index) => ({
		item: index === 0 ? LONGEST_ID : String(1000 + index),
		title: [CJK_TITLE, EMOJI_TITLE, "x".repeat(120), UNBROKEN_PATH, "a", RTL_TITLE, `Rename the release script and update every workflow that calls it ${"and then some ".repeat(6)}`][index % 7] ?? "",
		level: index % 3 === 0 ? undefined : ["low", "medium", "critical"][index % 3],
		state: ["building", "awaiting-owner-review-of-the-release-workflow-change", "checking", "x"][index % 4] ?? "",
		since: ago(index * 37),
		unclear: index % 5 === 0,
	}));

const noticesOf = (count: number): Card[] =>
	Array.from({ length: count }, (_, index) => ({
		kind: "fault",
		key: `many:${index}`,
		item: String(2000 + index),
		code: "run-error",
		cause: `The run for ${2000 + index} failed.`,
		fix: "hum tries again.",
		since: ago(index),
	}));

const mergedOf = (count: number): Status["merged"] =>
	Array.from({ length: count }, (_, index) => ({
		item: String(3000 + index),
		title: [CJK_TITLE, "Fix the typo in the README", RTL_TITLE][index % 3] ?? "",
		level: index % 2 === 0 ? undefined : "low",
		mergedAt: index === 0 ? 0 : ago(index * 61),
	}));

const choicesOf = (count: number): Status["choices"] =>
	Array.from({ length: count }, (_, index) => ({ item: String(4000 + (index % 7)), text: `Chose "${"x".repeat(40)}" over long without you.`, at: ago(index * 11) }));

/** The lists at the length the shipped settings allow: `mergedShown` and `choicesShown` are 50, and the runners and open cards bound the other two. */
const IN_FLIGHT_AT_MOST = 20;
const NOTICES_AT_MOST = 20;
const MERGED_AT_MOST = 50;
const CHOICES_AT_MOST = 50;

/** Every list at its own length, every text at an edge, every optional part missing in some row. */
const worstWith = (flights: number, notices: number, merged: number, choices: number): Status => ({
	format: fullStatus.format,
	writtenAt: ago(5),
	workers: { mac: 0, ci: NOW + 3_600_000 },
	engine: { version: "0.3.0-beta.12+build.20261111.abcdef0", adapterApi: 1, configSchema: 1, latest: "10.20.30-rc.1" },
	questions: worstQuestions,
	cards: [...worstCards, ...noticesOf(notices)],
	inFlight: flightsOf(flights),
	merged: mergedOf(merged),
	choices: choicesOf(choices),
	rules: [],
	possibleRepeats: [],
	unusedMemory: [],
	measure: { merges: 100_000, abandoned: 0, notes: 1_234_567.89, questions: 0, tokens: 999_500, window: 100_000, byPath: [] },
});

/** The status file at its worst with every list at the length the shipped settings give it. */
export const worstStatus: Status = worstWith(IN_FLIGHT_AT_MOST, NOTICES_AT_MOST, MERGED_AT_MOST, CHOICES_AT_MOST);

/** The same with hundreds of rows in each list, which an owner reaches by raising `mergedShown` and `choicesShown`. */
export const hugeStatus: Status = worstWith(300, 120, 500, 500);
