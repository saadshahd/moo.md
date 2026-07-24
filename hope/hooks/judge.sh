#!/bin/sh
# moo's slop-awareness judge — the SINGLE source of the verdict logic, shared by:
#   - hooks/slop-nudge.sh        (the live Stop hook)
#   - slop-nudge.evals/run.sh    (the labeled pass-rate harness)
# Keeping one source is load-bearing: an eval that copy-pasted the prompt would test a fork
# that drifts from what actually runs in your sessions. Both callers invoke THIS.
#
# Input:  newline-separated list of live file paths on stdin.
# Output: the judge's finding on stdout — the literal token CLEAN, or one line per finding
#         "- <file>: <preference> — <what to look at>". Empty stdout is treated as CLEAN.
# Rubric: the project's discovered CLAUDE.md / TASTE.md hierarchy ONLY — ships no taste.
# CWD:    claude -p discovers instructions from the current directory, so the CALLER chooses
#         the taste context by its CWD — project root live, a per-case fixture dir under eval.
#
# The prompt below is a METHOD and enumerates ZERO rules of its own — naming any preference here
# would duplicate the taste and rot when it changes. Read the prompt for what the judge does; this
# comment does not restate it.
# Fails open: a missing claude binary or empty input yields empty stdout (== CLEAN), never a stall.
command -v claude >/dev/null 2>&1 || exit 0

live=$(cat)
[ -z "$live" ] && exit 0

prompt=$(printf 'You are a taste judge. The loaded CLAUDE.md / TASTE.md hierarchy (and any conventions discovered in this directory) are the ONLY preferences you judge against — apply only rules explicitly present there; bring none of your own.\n\nThese files were touched this turn:\n%s\n\nMETHOD — explore, then judge. A file rarely settles its own case. Read each touched file in full (it is the live, current code — judge what it says now, not any earlier version), then explore the rest of the repo with Grep, Glob, and Read — related code, existing equivalents, the owner and sibling modules, call sites — scaling how far you range to whether the preference at issue is a cross-file one, so a violation visible only ACROSS files is caught and not just one local to a single file.\n\nGROUNDING — anchor every finding to a concrete path you actually opened: the place that shows the violation, or the existing thing it conflicts with. A finding you cannot tie to a real path you read is not ready — drop it.\n\nBAR — be conservative. Flag only CLEAR, nameable violations of a preference EXPLICITLY present in your loaded instructions, anywhere in a touched file (a touched file should be left better than before, so a pre-existing violation in it counts too). When in doubt, stay silent; a missed call is cheaper than a false one.\n\nOUTPUT — if nothing qualifies, print exactly CLEAN and nothing else. Otherwise print one line per clear violation, most consequential first, each formatted "- <file>: <the violated preference> — <what to look at, including the anchor path>". Your FIRST line is either exactly CLEAN (nothing else on that line) or the first finding — NEVER a sentence that begins with the word CLEAN. No preamble, no commentary.' \
  "$live")

# Full tool access by design — NO --allowed-tools fence. The judge may use any tool for richer
# exploration; it is held to review-and-report by the PROMPT, not by a tool allowlist. bypass-
# Permissions prevents a no-TTY permission prompt from hanging. disableAllHooks is the recursion
# guard so the judge's own Stop is inert. stderr flows to the caller's diagnostic log.
claude -p --no-session-persistence --settings '{"disableAllHooks":true}' \
  --permission-mode bypassPermissions -- "$prompt"
