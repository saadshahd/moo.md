A rename or removal takes the old name out of the whole repo in the same change — docs, strings, comments and paths, not only the code callers the type checker finds.
_Avoid_: a renamed function whose old name lives on in a README, an error message, a log line or a comment; a moved file whose old path stays in docs or config.
Detect: run `rename-leaves-no-stale-name.gate` as a pre-commit hook. It blocks on a compound name (camelCase, snake_case) that the change takes out of all code, left in a doc or a comment, and on a renamed source file's old path left in a doc, a config, a string or a comment. Strings that hold the old name, and one-word names, are read by eye: strings reuse names for queries, events and keys.
Not-when: the old name is history on purpose, in a changelog; or the file is vendored or generated — mark it `linguist-vendored` or `linguist-generated` in `.gitattributes`.
Cross-ref: ubiquitous-language-one-term-one-concept — a stale name is a second term for one concept.
