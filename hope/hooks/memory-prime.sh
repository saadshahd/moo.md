#!/bin/sh
# SessionStart: prime the FOREGROUND to co-author durable memory — surface the lesson, don't
# manage the files. The write itself is off-thread (memory-write.sh, Stop/async), and the full
# curation/naming/indexing discipline is read there by the writer — so the foreground no longer
# needs it. Injecting the whole discipline here is what bred the mid-task "let me go curate the
# files" detour; a short co-author framing keeps the ownership signal without the detour.
# Fails open — an absent jq must never block a session.
command -v jq >/dev/null 2>&1 || exit 0
note='You co-author this project'\''s durable memory. When you reach a decision, a correction, or a hard-won fact worth keeping, state it plainly in your reasoning so it gets captured — that is your contribution to the memory. A background writer persists what qualifies and maintains the memory files; do not read or edit them yourself mid-task, and do not narrate memory housekeeping.'
jq -n --arg c "$note" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
exit 0
