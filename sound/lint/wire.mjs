import { createRequire } from 'node:module';
import { join } from 'node:path';

const entryMarker = { property: 'plugins', plugin: 'sound' };
const pluginIdentifier = 'sound';

export class ManualWiring extends Error {
  constructor(reason, snippet) {
    super(reason);
    this.snippet = snippet;
  }
}

const indentOf = (text) => text.match(/^([ \t]+)"/m)?.[1] ?? '  ';

const parseJson = (text, snippet) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ManualWiring(`config is not plain JSON (${error.message})`, snippet);
  }
};

export const oxlintSnippet = ({ pluginSpecifier, severities }) =>
  JSON.stringify({ jsPlugins: [pluginSpecifier], rules: severities }, null, 2);

export const eslintEntry = (severities) =>
  `{\n    plugins: { ${pluginIdentifier} },\n    rules: ${JSON.stringify(severities, null, 6).replace(/\n}$/, '\n    }')},\n  }`;

export const eslintSnippet = ({ pluginSpecifier, severities }) =>
  `import ${pluginIdentifier} from ${JSON.stringify(pluginSpecifier)};\n// then append to the exported config array:\n${eslintEntry(severities)}`;

export const wireOxlint = ({ text, pluginSpecifier, severities }) => {
  const snippet = oxlintSnippet({ pluginSpecifier, severities });
  const parsed = parseJson(text, snippet);
  const jsPlugins = parsed.jsPlugins ?? [];
  const wired = {
    ...parsed,
    jsPlugins: jsPlugins.includes(pluginSpecifier) ? jsPlugins : [...jsPlugins, pluginSpecifier],
    rules: { ...parsed.rules, ...severities },
  };
  return `${JSON.stringify(wired, null, indentOf(text))}\n`;
};

const espreeFor = (root) => {
  const fromRoot = createRequire(join(root, 'package.json'));
  const resolvers = [() => fromRoot('espree'), () => createRequire(fromRoot.resolve('eslint/package.json'))('espree')];
  for (const resolve of resolvers) {
    try {
      return resolve();
    } catch {}
  }
  throw new Error('espree is not installed next to eslint');
};

const exportedConfig = (program) => {
  const declaration = program.body.find((node) => node.type === 'ExportDefaultDeclaration')?.declaration;
  const initOf = (identifier) =>
    program.body
      .flatMap((node) => (node.type === 'VariableDeclaration' ? node.declarations : []))
      .find((declarator) => declarator.id.name === identifier.name)?.init;
  const target = declaration?.type === 'Identifier' ? initOf(declaration) : declaration;
  if (target?.type === 'ArrayExpression') return { elements: target.elements, open: target.range[0] + 1 };
  if (target?.type !== 'CallExpression') return null;
  const [first] = target.arguments;
  return first?.type === 'ArrayExpression' && target.arguments.length === 1
    ? { elements: first.elements, open: first.range[0] + 1 }
    : { elements: target.arguments, open: target.callee.range[1] + 1 };
};

const isSoundEntry = (node) =>
  node.type === 'ObjectExpression' &&
  node.properties.some(
    (property) =>
      property.key?.name === entryMarker.property &&
      property.value.type === 'ObjectExpression' &&
      property.value.properties.some((inner) => inner.key?.name === entryMarker.plugin),
  );

export const wireEslint = ({ text, root, pluginSpecifier, severities }) => {
  const snippet = eslintSnippet({ pluginSpecifier, severities });
  let program;
  try {
    program = espreeFor(root).parse(text, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  } catch (error) {
    throw new ManualWiring(`config is not an ES module the repo's parser reads (${error.message})`, snippet);
  }
  const config = exportedConfig(program);
  if (!config) throw new ManualWiring('no exported config array found (expects export default [...], defineConfig([...]) or config(...))', snippet);

  const importLine = `import ${pluginIdentifier} from ${JSON.stringify(pluginSpecifier)};`;
  const imports = program.body.filter((node) => node.type === 'ImportDeclaration');
  const alreadyImported = text.includes(importLine);
  const existing = config.elements.find((node) => node && isSoundEntry(node));
  const last = config.elements.at(-1);
  const edits = [
    existing
      ? { from: existing.range[0], to: existing.range[1], insert: eslintEntry(severities) }
      : { from: last ? last.range[1] : config.open, to: last ? last.range[1] : config.open, insert: `${last ? ',' : ''}\n  ${eslintEntry(severities)}` },
    ...(alreadyImported
      ? []
      : [{ from: imports.at(-1)?.range[1] ?? 0, to: imports.at(-1)?.range[1] ?? 0, insert: imports.length ? `\n${importLine}` : `${importLine}\n` }]),
  ];
  return edits.sort((a, b) => b.from - a.from).reduce((source, { from, to, insert }) => source.slice(0, from) + insert + source.slice(to), text);
};
