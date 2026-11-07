# Upstream

- Source: https://github.com/dmmulroy/anti-slop, copied by its `install-anti-slop` skill (`scripts/install.mjs`) on 2026-10-26.
- Source revision: unknown. The local skill copy has no git history; its skills.sh lock gives skill folder hash `97962dc9fad565ca7695bf57805d9d0138ce1def` (updated 2026-10-18).
- Installed path: `factory/tools/oxlint/anti-slop/`, registered in `factory/.oxlintrc.json` with every generic rule at `error`.
- Dependencies: `oxlint` and `@oxlint/plugins` at 1.89.0, pinned exactly.
- Deviation: `no-runtime-typeof` runs with `allowInTypeGuards: true`. Hooks modules may import only relative files and `claude-code`, so no schema library can decode the rules file there; its decoders are type guards in `lib/rules.ts`.
