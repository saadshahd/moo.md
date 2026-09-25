#!/bin/sh
# moo's slop-awareness judge — the verdict logic, run by hooks/slop.tsx after an edit turn.
#
# Input:  newline-separated list of live file paths on stdin.
# Output: the judge's finding on stdout — the literal token CLEAN, or one line per finding
#         "<file>:<line> | <preference> | <what is wrong>" followed by its fix as "- " / "+ " lines.
#         Empty stdout is treated as CLEAN.
# Rubric: the project's discovered CLAUDE.md / TASTE.md hierarchy ONLY — ships no taste.
# CWD:    claude -p discovers instructions from the current directory, so the CALLER chooses
#         the taste context by its CWD — project root live.
#
# The prompt below is a METHOD and enumerates ZERO rules of its own — naming any preference here
# would duplicate the taste and rot when it changes. Read the prompt for what the judge does; this
# comment does not restate it.
# Empty input yields empty stdout (== CLEAN). A missing claude binary exits 127 so the caller shows it.
command -v claude >/dev/null 2>&1 || { echo "claude not on PATH" >&2; exit 127; }

live=$(cat)
[ -z "$live" ] && exit 0

prompt=$(printf 'You are a taste judge. The loaded CLAUDE.md / TASTE.md hierarchy (and any conventions discovered in this directory) are the ONLY preferences you judge against — apply only rules explicitly present there; bring none of your own.\n\nThese files were touched this turn:\n%s\n\nMETHOD — explore, then judge. A file rarely settles its own case. Read each touched file in full (it is the live, current code — judge what it says now, not any earlier version), then explore the rest of the repo with Grep, Glob, and Read — related code, existing equivalents, the owner and sibling modules, call sites — scaling how far you range to whether the preference at issue is a cross-file one, so a violation visible only ACROSS files is caught and not just one local to a single file.\n\nGROUNDING — anchor every finding to a concrete path you actually opened: the place that shows the violation, or the existing thing it conflicts with. A finding you cannot tie to a real path you read is not ready — drop it.\n\nBAR — be conservative. Flag only CLEAR, nameable violations of a preference EXPLICITLY present in your loaded instructions, anywhere in a touched file (a touched file should be left better than before, so a pre-existing violation in it counts too). When in doubt, stay silent; a missed call is cheaper than a false one.\n\nOUTPUT — if nothing qualifies, print exactly CLEAN and nothing else. Otherwise print one line per clear violation, most consequential first, each a block: a header line "<file>:<line> | <the violated preference, five words at most> | <what is wrong there, one plain sentence of fifteen words at most>", then the change that fixes it — the current lines starting at <line>, each copied exactly and prefixed "- ", then their replacement, each prefixed "+ " (no "+ " lines when the fix deletes them). Keep the change to the fewest lines that fix it. Your FIRST line is either exactly CLEAN (nothing else on that line) or the first finding — NEVER a sentence that begins with the word CLEAN. No preamble, no commentary.' \
  "$live")

# Full tool access by design — NO --allowed-tools fence. The judge may use any tool for richer
# exploration; it is held to review-and-report by the PROMPT, not by a tool allowlist. bypass-
# Permissions prevents a no-TTY permission prompt from hanging. disableAllHooks is the recursion
# guard so the judge's own Stop is inert. stderr flows to the caller's diagnostic log.
claude -p --no-session-persistence --settings '{"disableAllHooks":true}' \
  --permission-mode bypassPermissions -- "$prompt"
