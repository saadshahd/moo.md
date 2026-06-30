#!/bin/sh
# moo's slop-awareness judge — the SINGLE source of the verdict logic, shared by:
#   - hooks/slop-nudge.sh        (the live Stop / SubagentStop hook)
#   - slop-nudge.evals/run.sh    (the labeled pass-rate harness)
# Keeping one source is load-bearing: an eval that copy-pasted the prompt would test a fork
# that drifts from what actually runs in your sessions. Both callers invoke THIS.
#
# Input:  newline-separated list of live file paths on stdin.
# Output: the judge's finding on stdout — the literal token CLEAN, or up to 5 lines
#         "- <file>: <preference> — <what to look at>". Empty stdout is treated as CLEAN.
# Rubric: the project's discovered CLAUDE.md / TASTE.md hierarchy ONLY — ships no taste.
# CWD:    claude -p discovers instructions from the current directory, so the CALLER chooses
#         the taste context by its CWD — project root live, a per-case fixture dir under eval.
#
# Cross-file review: the judge does NOT grade each touched file in isolation. The prompt is a
# METHOD, not a taste — it enumerates ZERO rules of its own. For every touched file it reads the
# file live and in full, then explores the repo (Grep/Glob/Read for related code, existing
# equivalents, owner/sibling modules, call sites) so a violation visible only ACROSS files is
# caught, not just a single-file one. WHICH preferences it judges against come entirely from the
# discovered CLAUDE.md / TASTE.md — naming any of them here would duplicate the taste and rot when
# it changes. Every finding must cite a concrete anchor path the judge actually read; the
# conservative bar holds (clear, nameable, anchored violations only; silent CLEAN when unsure).
# Fails open: a missing claude binary or empty input yields empty stdout (== CLEAN), never a stall.
command -v claude >/dev/null 2>&1 || exit 0

live=$(cat)
[ -z "$live" ] && exit 0

prompt=$(printf 'You are a taste judge. The loaded CLAUDE.md / TASTE.md hierarchy (and any conventions discovered in this directory) are the ONLY preferences you judge against — apply only rules explicitly present there; bring none of your own.\n\nThese files were touched this turn:\n%s\n\nMETHOD — explore, then judge. Do NOT rule on a file from its own contents alone. For each touched file: first READ it IN FULL (it is the live, current code — judge what it says now, not any earlier version), then EXPLORE the rest of the repo with Grep, Glob, and Read — related code, existing equivalents, the owner and sibling modules, call sites — so a violation that is only visible ACROSS files is caught, not just one local to a single file.\n\nGROUNDING — anchor every finding to a concrete path you actually opened: the place that shows the violation, or the existing thing it conflicts with. A finding you cannot tie to a real path you read is not ready — drop it.\n\nBAR — be conservative. Flag only CLEAR, nameable violations of a preference EXPLICITLY present in your loaded instructions, anywhere in a touched file (a touched file should be left better than before, so a pre-existing violation in it counts too). When in doubt, stay silent; a missed call is cheaper than a false one.\n\nOUTPUT — if nothing qualifies, print exactly CLEAN and nothing else. Otherwise print up to 5 lines, most consequential first, each formatted "- <file>: <the violated preference> — <what to look at, including the anchor path>". No preamble, no commentary.' \
  "$live")

# Full tool access by design — NO --allowed-tools fence. The judge may use any tool for richer
# exploration; it is held to review-and-report by the PROMPT, not by a tool allowlist. bypass-
# Permissions prevents a no-TTY permission prompt from hanging. disableAllHooks is the recursion
# guard so the judge's own Stop is inert. stderr flows to the caller's diagnostic log.
claude -p --no-session-persistence --settings '{"disableAllHooks":true}' \
  --permission-mode bypassPermissions -- "$prompt"
