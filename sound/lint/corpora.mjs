import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const corpora = ['../corpus', '../corpus-optin'].map((path) => join(dirname(fileURLToPath(import.meta.url)), path));
export const checkSuffix = '.check.mjs';

export const corpusFiles = (suffix) =>
  corpora.flatMap((corpus) =>
    readdirSync(corpus, { recursive: true })
      .map(String)
      .filter((path) => path.endsWith(suffix))
      .map((path) => ({ corpus, path })),
  );
