const directivePrefixes = ['eslint-', 'oxlint-', '@ts-', 'prettier-ignore', 'biome-ignore', 'deno-lint-ignore', 'c8 ', 'istanbul ', 'v8 ', '#region', '#endregion', '# sourceMappingURL', '/ <reference', '/ <amd'];

const isDirective = (comment) => directivePrefixes.some((prefix) => comment.value.trimStart().startsWith(prefix));

const isLineComment = (comment) => comment.type === 'Line' && !isDirective(comment);

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Every comment that stays is a block comment; a line comment never ships.' },
    messages: {
      blockOnly: 'A // comment never ships. Delete it, let a name or a type carry it, or, where the code cannot say the why, write one block comment above the code.',
    },
    schema: [],
  },
  create: (context) => ({
    Program: () => {
      context.sourceCode
        .getAllComments()
        .filter(isLineComment)
        .forEach((comment) => context.report({ loc: comment.loc, messageId: 'blockOnly' }));
    },
  }),
};

export const cases = {
  valid: [
    { code: '/** Retries once: the upstream API drops the first call after an idle minute. */\nexport const f = () => 1;' },
    { code: '/* eslint-disable no-console */\nexport const f = () => 1;' },
    { code: '// eslint-disable-next-line no-console\nconsole.log(1);' },
    { code: '// oxlint-disable-next-line no-console\nconsole.log(1);' },
    { code: "// @ts-expect-error -- the fixture breaks the type on purpose\nexport const x: number = 'a';" },
    { code: '/// <reference types="node" />\nexport const x = 1;' },
    { code: '// prettier-ignore\nexport const m = [1, 0,\n  0, 1];' },
    { code: "export const url = 'https://example.com//path';" },
    { code: 'export const x = 1;\n//# sourceMappingURL=x.js.map' },
  ],
  invalid: [
    { code: '// add one\nexport const f = (x) => x + 1;', errors: 1 },
    { code: 'export const f = (x) => x + 1; // add one', errors: 1 },
    { code: '// first line\n// second line\nexport const x = 1;', errors: 2 },
    { code: 'export const f = () => {\n  // TODO: handle errors\n  return 1;\n};', errors: 1 },
  ],
};
