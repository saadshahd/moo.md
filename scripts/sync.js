#!/usr/bin/env node
// Inlines each plugin's `_fragments/<name>.md` into every SKILL.md of that plugin that
// carries `<!-- f <name> -->` … `<!-- /f -->`. Fragment scope is the plugin: a skill can
// name only its own plugin's fragments, so a cross-plugin reference fails loud rather than
// resolving. Consumers are discovered, never listed — adding a fragment or an include site
// needs no edit here or in `.githooks/pre-push`.
//
// `--list` prints the files this script may rewrite, one per line; the pre-push drift guard
// derives its diff targets from it.

const fs = require('fs')
const path = require('path')
const { markdownMagic } = require('markdown-magic')

const ROOT = path.join(__dirname, '..')
const OPEN = 'f'
const CLOSE = '/f'

/** Every plugin dir holding a `_fragments/` dir, with its fragments and its SKILL.md files. */
function plugins() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => path.join(ROOT, e.name))
    .filter((dir) => fs.existsSync(path.join(dir, '_fragments')))
    .map((dir) => ({
      name: path.basename(dir),
      fragments: fragmentsIn(path.join(dir, '_fragments')),
      skills: skillsIn(path.join(dir, 'skills')),
    }))
}

function fragmentsIn(dir) {
  return Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => [path.basename(f, '.md'), fs.readFileSync(path.join(dir, f), 'utf8').trim()])
  )
}

function skillsIn(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, 'SKILL.md'))
    .filter((f) => fs.existsSync(f))
}

async function main() {
  const found = plugins()

  if (process.argv.includes('--list')) {
    console.log(found.flatMap((p) => p.skills.map((f) => path.relative(ROOT, f))).join('\n'))
    return 0
  }

  let failed = false
  for (const plugin of found) {
    const names = Object.keys(plugin.fragments)
    const transforms = Object.fromEntries(names.map((n) => [n, () => plugin.fragments[n]]))
    const result = await markdownMagic(plugin.skills, {
      open: OPEN,
      close: CLOSE,
      transforms,
      outputFlatten: false,
    })

    // A block naming an unknown fragment is left untouched and reported here — markdown-magic
    // resolves rather than throwing, so an unread `errors` array ships stale content past a
    // drift guard that only compares before/after diffs.
    for (const err of result.errors || []) {
      failed = true
      console.error(`sync: ${plugin.name}: ${err.errorMessage}`)
      for (const e of err.errors || []) console.error(`  ${e.message}`)
    }
    console.error(
      `sync: ${plugin.name} — ${names.length} fragments, ${plugin.skills.length} skills, ` +
        `${(result.filesChanged || []).length} rewritten`
    )
  }

  if (!found.length) {
    console.error('sync: no plugin has a _fragments/ dir — nothing to inline')
    return 1
  }
  return failed ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('sync:', err.stack || err.message)
    process.exit(1)
  }
)
