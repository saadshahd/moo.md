import { resolve } from "node:path";
import type { Command } from "commander";
import ts from "typescript";
import { z } from "zod";
import pkg from "../../package.json" with { type: "json" };
import { buildProgram } from "../../src/cli/ops.ts";
import defaults from "../../defaults/hum.json" with { type: "json" };
import schema from "../../schema/hum.schema.json" with { type: "json" };

/** One exported name: its type as the compiler prints it, its JSON Schema if it is a zod schema, its value if it is plain data. */
const ExportedName = z.object({ type: z.string(), schema: z.json().optional(), value: z.json().optional() });

const Names = z.record(z.string(), ExportedName);

const NamesByFile = z.record(z.string(), Names);

type CommandSurface = { arguments: string[]; options: string[]; commands: Record<string, CommandSurface> };

const CommandSurface: z.ZodType<CommandSurface> = z.object({
	arguments: z.array(z.string()),
	options: z.array(z.string()),
	commands: z.record(z.string(), z.lazy(() => CommandSurface)),
});

/**
 * What a user of `@moo.md/hum` can depend on, in the five parts a bump is judged by.
 * Each file path inside it is relative to the package folder.
 */
export const Surface = z.object({
	config: z.object({ schema: z.json(), defaults: z.json() }),
	adapterApi: NamesByFile,
	savedState: NamesByFile,
	commands: CommandSurface,
	exportedTypes: z.object({ entryPoints: z.json(), symbols: NamesByFile }),
});

export type Surface = z.infer<typeof Surface>;

const PACKAGE_ROOT = resolve(import.meta.dir, "../..");

const ADAPTER_API_FILES = ["src/adapter-api.ts"];

const SAVED_STATE_FILES = ["src/state/format.ts", "src/status/format.ts"];

const EXPORTED_TYPE_FILES = ["src/index.ts"];

const SURFACE_FILES = [...ADAPTER_API_FILES, ...SAVED_STATE_FILES, ...EXPORTED_TYPE_FILES];

const NODE_FLAGS = ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.IgnoreErrors;

const TYPE_ONLY_SYMBOLS = ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias;

const printer = ts.createPrinter({ removeComments: true });

const PRINTED_IN = ts.createSourceFile("surface.ts", "", ts.ScriptTarget.Latest);

const printed = (node: ts.Node): string => printer.printNode(ts.EmitHint.Unspecified, node, PRINTED_IN);

/** By code unit, never by locale, so every machine sorts alike. */
const byPrintedText = (a: ts.TypeNode, b: ts.TypeNode): number => {
	const [first, second] = [printed(a), printed(b)];

	return first < second ? -1 : first > second ? 1 : 0;
};

/** The compiler orders a union's members by when it first met each one, which an unrelated edit can change; sorted at every depth, the text changes only with the members. */
const sortUnions = (context: ts.TransformationContext) => {
	const visit = (node: ts.Node): ts.Node => {
		const visited = ts.visitEachChild(node, visit, context);

		return ts.isUnionTypeNode(visited) ? context.factory.updateUnionTypeNode(visited, context.factory.createNodeArray(visited.types.toSorted(byPrintedText))) : visited;
	};

	return visit;
};

const stableText = (node: ts.Node | undefined): string => {
	if (!node) throw new Error("the compiler could not write a surface type out");

	return printed(ts.transform(node, [sortUnions]).transformed[0] ?? node);
};

const stableTypeText = (checker: ts.TypeChecker, type: ts.Type, flags = ts.NodeBuilderFlags.None): string => stableText(checker.typeToTypeNode(type, undefined, NODE_FLAGS | flags));

/** Machines differ in where the package sits, and type text names files by absolute path. */
const withoutRoot = (text: string): string => text.replaceAll(`${PACKAGE_ROOT}/`, "");

export const programOf = (files: readonly string[]): ts.Program => {
	const configPath = resolve(PACKAGE_ROOT, "tsconfig.json");
	const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
	const options = ts.parseJsonConfigFileContent(config, ts.sys, PACKAGE_ROOT).options;

	return ts.createProgram(files.map((file) => resolve(PACKAGE_ROOT, file)), options);
};

const typeText = (checker: ts.TypeChecker, symbol: ts.Symbol): string => {
	const type = checker.getTypeOfSymbol(symbol);
	const construct = checker.getSignaturesOfType(type, ts.SignatureKind.Construct).map((signature) => stableText(checker.signatureToSignatureDeclaration(signature, ts.SyntaxKind.ConstructorType, undefined, NODE_FLAGS)));

	return [stableTypeText(checker, type), ...construct].join("; ");
};

const isTypeDeclaration = (declaration: ts.Declaration): boolean => ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration);

const declarationText = (symbol: ts.Symbol): string =>
	(symbol.declarations ?? []).filter(isTypeDeclaration).map((declaration) => printer.printNode(ts.EmitHint.Unspecified, declaration, declaration.getSourceFile())).join("\n");

/** What a type alias points at, written out, so a change to its target shows even where the alias's own text stays. */
const aliasTarget = (checker: ts.TypeChecker, symbol: ts.Symbol): string =>
	symbol.flags & ts.SymbolFlags.TypeAlias ? `= ${stableTypeText(checker, checker.getDeclaredTypeOfSymbol(symbol), ts.NodeBuilderFlags.InTypeAlias)}` : "";

const HIDDEN_MODIFIERS = ts.ModifierFlags.Private | ts.ModifierFlags.Protected;

/** A member a user of the class can reach: not a `#` field, not `private` or `protected`. */
const isPublicMember = (member: ts.Symbol): boolean =>
	(member.declarations ?? []).every((declaration) => !(ts.getCombinedModifierFlags(declaration) & HIDDEN_MODIFIERS) && !(ts.isClassElement(declaration) && declaration.name !== undefined && ts.isPrivateIdentifier(declaration.name)));

const PROTOTYPE = "prototype";

const membersText = (checker: ts.TypeChecker, type: ts.Type, prefix: string): string[] =>
	checker
		.getPropertiesOfType(type)
		.filter((member) => member.name !== PROTOTYPE && isPublicMember(member))
		.map((member) => `${prefix}${member.name}: ${stableTypeText(checker, checker.getTypeOfSymbol(member))}`);

/** A class's public members, static and instance, so a change to a method's signature shows as a change to the class. */
const classMembers = (checker: ts.TypeChecker, symbol: ts.Symbol): string =>
	symbol.flags & ts.SymbolFlags.Class ? [...membersText(checker, checker.getTypeOfSymbol(symbol), "static "), ...membersText(checker, checker.getDeclaredTypeOfSymbol(symbol), "")].join("; ") : "";

export const compilerType = (checker: ts.TypeChecker, exported: ts.Symbol): string => {
	const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
	const typePart = symbol.flags & TYPE_ONLY_SYMBOLS ? declarationText(symbol) : "";
	const valuePart = symbol.flags & ts.SymbolFlags.Value ? typeText(checker, symbol) : "";

	return withoutRoot([typePart, aliasTarget(checker, symbol), valuePart, classMembers(checker, symbol)].filter(Boolean).join("\n"));
};

const JsonValue = z.json();

type JsonValue = z.infer<typeof JsonValue>;

const JsonList = z.array(JsonValue);

const JsonDictionary = z.record(z.string(), JsonValue);

/** Wording is not surface: an edit to a description or title must not ask for a bump. */
const PROSE_KEYS: ReadonlySet<string> = new Set(["description", "title"]);

/** The JSON Schema keyword whose children are named by the owner, so a child may be called "title". */
const NAMED_CHILDREN_KEYWORD = "properties";

const withoutProse = (node: JsonValue, childrenAreNamed = false): JsonValue => {
	const list = JsonList.safeParse(node);

	if (list.success) return list.data.map((child) => withoutProse(child));

	const dictionary = JsonDictionary.safeParse(node);

	if (!dictionary.success) return node;

	return Object.fromEntries(
		Object.entries(dictionary.data)
			.filter(([key]) => childrenAreNamed || !PROSE_KEYS.has(key))
			.map(([key, child]) => [key, withoutProse(child, key === NAMED_CHILDREN_KEYWORD)]),
	);
};

/** What a name holds at run time: a zod schema as JSON Schema, plain data as itself, nothing for code. */
const RuntimeFacts = z.union([
	z.instanceof(z.ZodType).transform((schema) => ({ schema: withoutProse(JsonValue.parse(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }))) })),
	z.json().transform((value) => ({ value })),
	z.any().transform(() => ({})),
]);

const RuntimeModule = z.record(z.string(), RuntimeFacts);

const moduleSymbol = (program: ts.Program, checker: ts.TypeChecker, file: string): ts.Symbol => {
	const source = program.getSourceFile(resolve(PACKAGE_ROOT, file));
	const module = source && checker.getSymbolAtLocation(source);

	if (!module) throw new Error(`${file} is not a module of the program`);

	return module;
};

const namesOf = async (program: ts.Program, file: string): Promise<z.infer<typeof Names>> => {
	const checker = program.getTypeChecker();
	const runtime = RuntimeModule.parse({ ...(await import(resolve(PACKAGE_ROOT, file))) });

	return Object.fromEntries(
		checker
			.getExportsOfModule(moduleSymbol(program, checker, file))
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.map((exported) => [exported.name, { type: compilerType(checker, exported), ...runtime[exported.name] }]),
	);
};

const namesByFile = async (program: ts.Program, files: readonly string[]): Promise<z.infer<typeof NamesByFile>> =>
	Object.fromEntries(await Promise.all(files.map(async (file) => [file, await namesOf(program, file)])));

const argumentText = (argument: Command["registeredArguments"][number]): string => {
	const [open, close] = argument.required ? ["<", ">"] : ["[", "]"];

	return `${open}${argument.name()}${argument.variadic ? "..." : ""}${close}`;
};

const commandSurface = (command: Command): CommandSurface => ({
	arguments: command.registeredArguments.map(argumentText),
	options: command.options.map(({ flags }) => flags),
	commands: Object.fromEntries(command.commands.map((child) => [child.name(), commandSurface(child)])),
});

const SILENT_IO = { cwd: PACKAGE_ROOT, env: {}, stdout: () => undefined, stderr: () => undefined };

/** The surface of the package as it sits in this tree. */
export const extractSurface = async (): Promise<Surface> => {
	const program = programOf(SURFACE_FILES);

	return Surface.parse({
		config: { schema: withoutProse(JsonValue.parse(schema)), defaults },
		adapterApi: await namesByFile(program, ADAPTER_API_FILES),
		savedState: await namesByFile(program, SAVED_STATE_FILES),
		commands: commandSurface(buildProgram(SILENT_IO, () => undefined)),
		exportedTypes: { entryPoints: pkg.exports, symbols: await namesByFile(program, EXPORTED_TYPE_FILES) },
	});
};
