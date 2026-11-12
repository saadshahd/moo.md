import { dirname, extname } from "node:path";
import { Lang, parse } from "@ast-grep/napi";
import type { ReviewNote } from "./records.ts";

/** The languages whose hunks the parser reads. A hunk in any other language leaves the signals that need a parse unapplied. */
const PARSED_LANGUAGES = new Map<string, Lang>([
	[".ts", Lang.TypeScript],
	[".tsx", Lang.Tsx],
	[".js", Lang.JavaScript],
	[".jsx", Lang.JavaScript],
	[".mjs", Lang.JavaScript],
	[".cjs", Lang.JavaScript],
]);

const IDENTIFIER_KINDS = ["identifier", "property_identifier", "type_identifier"] as const;

const DECLARATION_KINDS = ["function_declaration", "class_declaration", "interface_declaration", "type_alias_declaration", "enum_declaration", "method_definition", "variable_declarator", "public_field_definition", "property_signature"] as const;

const WORD = /[A-Za-z_$][\w$]*/g;
const CODE_SPAN = /`([^`\n]+)`/g;
const SUGGESTION_BLOCK = /```suggestion\n([\s\S]*?)```/g;
const STRING_LITERAL = /(["'`])(?:\\.|(?!\1).)*\1/g;
const NUMBER_LITERAL = /\b\d+(?:\.\d+)?\b/g;
const HUNK_HEADER = /^(@@|diff |index |--- |\+\+\+ )/;
const CHANGED_LINE = /^[+-]/;
const KEYWORDS = new Set(["const", "let", "var", "function", "return", "if", "else", "new", "await", "async", "export", "import", "from", "type", "interface", "class", "extends", "this", "true", "false", "null", "undefined", "typeof", "for", "of", "in"]);

/** A one-character word names nothing, so two notes quoting it say nothing alike. */
const MIN_WORD_LENGTH = 3;

const squash = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const bodyLines = (hunk: string): string[] => hunk.split("\n").filter((line) => !HUNK_HEADER.test(line));

const codeOf = (hunk: string): string => bodyLines(hunk).map((line) => line.slice(1)).join("\n");

const changedCodeOf = (hunk: string): string => bodyLines(hunk).flatMap((line) => (CHANGED_LINE.test(line) ? [line.slice(1)] : [])).join("\n");

const wordsOf = (text: string): Set<string> => new Set((text.match(WORD) ?? []).filter((word) => word.length >= MIN_WORD_LENGTH));

const matchesOf = (pattern: RegExp, text: string): Set<string> => new Set([...text.matchAll(pattern)].flatMap(([, found = ""]) => squash(found) || []));

const codePatternOf = (hunk: string): string =>
	changedCodeOf(hunk)
		.replace(STRING_LITERAL, "S")
		.replace(NUMBER_LITERAL, "N")
		.replace(WORD, (word) => (KEYWORDS.has(word) ? word : "I"))
		.replace(/\s+/g, "");

/** The glob that holds a file's folder and kind: its siblings of the same extension. */
export const globOf = (file: string): string => `${dirname(file)}/*${extname(file)}`;

const parsedOf = (note: ReviewNote): { identifiers: Set<string>; declared: Set<string> } | undefined => {
	if (note.hunk === "") return { identifiers: new Set(), declared: new Set() };

	const lang = PARSED_LANGUAGES.get(extname(note.file ?? ""));

	if (lang === undefined) return undefined;

	const identifiersIn = (code: string) => parse(lang, code).root().findAll({ rule: { any: IDENTIFIER_KINDS.map((kind) => ({ kind })) } }).map((node) => node.text());
	const declaredIn = (code: string) => parse(lang, code).root().findAll({ rule: { any: DECLARATION_KINDS.map((kind) => ({ kind })) } }).flatMap((node) => node.field("name")?.text() ?? []);

	return { identifiers: new Set(identifiersIn(codeOf(note.hunk))), declared: new Set(declaredIn(changedCodeOf(note.hunk))) };
};

/** What the signals compare, read once from a note. */
export type Prepared = {
	readonly note: ReviewNote;
	readonly text: string;
	readonly suggestions: Set<string>;
	readonly spans: Set<string>;
	/** Identifiers the note's text names that its own hunk holds. `undefined` when the hunk cannot be parsed. */
	readonly named: Set<string> | undefined;
	readonly declared: Set<string> | undefined;
	readonly glob: string | undefined;
	readonly pattern: string;
};

export const prepare = (note: ReviewNote): Prepared => {
	const parsed = parsedOf(note);

	return {
		note,
		text: squash(note.text),
		suggestions: matchesOf(SUGGESTION_BLOCK, note.text),
		spans: new Set([...matchesOf(CODE_SPAN, note.text)].filter((span) => span.length >= MIN_WORD_LENGTH)),
		named: parsed && new Set([...wordsOf(note.text)].filter((word) => parsed.identifiers.has(word))),
		declared: parsed?.declared,
		glob: note.file === undefined ? undefined : globOf(note.file),
		pattern: codePatternOf(note.hunk),
	};
};

const shares = <T>(a: Set<T> | undefined, b: Set<T> | undefined): boolean => a !== undefined && b !== undefined && [...a].some((found) => b.has(found));

/** Two notes on one change are about one hunk; only notes across changes repeat. */
const isAnotherChange = (a: Prepared, b: Prepared): boolean => a.note.change !== b.note.change;

const BREAK_SOURCES: readonly ReviewNote["source"][] = ["revert", "fix"];

type Signal = {
	readonly name: string;
	/** The signal reads a parsed hunk: it is left unapplied for a note whose hunk is not in a parsed language. */
	readonly parsed: boolean;
	readonly pairs: (a: Prepared, b: Prepared) => boolean;
};

/** The deterministic signals, checked in order. */
export const SIGNALS: readonly Signal[] = [
	{ name: "same-text", parsed: false, pairs: (a, b) => a.text === b.text },
	{ name: "same-code", parsed: false, pairs: (a, b) => shares(a.suggestions, b.suggestions) || shares(a.spans, b.spans) },
	{ name: "shared-identifier", parsed: true, pairs: (a, b) => isAnotherChange(a, b) && shares(a.named, b.named) },
	{ name: "same-glob-symbol", parsed: true, pairs: (a, b) => isAnotherChange(a, b) && a.glob !== undefined && a.glob === b.glob && shares(a.declared, b.declared) },
	{
		name: "same-code-pattern",
		parsed: false,
		pairs: (a, b) => BREAK_SOURCES.includes(a.note.source) && BREAK_SOURCES.includes(b.note.source) && a.pattern !== "" && a.pattern === b.pattern,
	},
];

/** The first signal that pairs two notes, and the signals a note's language left unapplied. */
export type Pairing = { readonly signal?: string; readonly unapplied: readonly string[] };

export const pairing = (a: Prepared, b: Prepared): Pairing => {
	const canRead = (signal: Signal): boolean => !signal.parsed || (a.named !== undefined && b.named !== undefined);
	const unapplied = SIGNALS.flatMap((signal) => (canRead(signal) ? [] : [signal.name]));
	const found = SIGNALS.find((signal) => canRead(signal) && signal.pairs(a, b));

	return { signal: found?.name, unapplied };
};
