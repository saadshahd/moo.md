#!/bin/bash
# moo UserPromptSubmit hook: Per-turn pipeline enforcer
# Fires on every user message. Detects pipeline state and injects next action.

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<session-context>\nPIPELINE CHECK — scan conversation and take the FIRST matching action:\n\n1. Trivial request (greeting, single-line fix, factual question)? → Respond directly. Stop checking.\n2. No [SESSION] marker yet? → Detect type (Build/Debug/Plan/Reflect), ask engagement + horizon, emit [SESSION]. Stop.\n3. [SESSION] exists but no intent brief (OBJECTIVE/ACCEPTANCE/STOP)? → Run Skill(skill=\"hope:intent\") NOW.\n4. Intent brief exists but no shape output (criteria[]/mustNot[])? → For Build/Debug/Plan: run Skill(skill=\"hope:shape\") NOW. For Reflect: skip to step 5.\n5. Shape output exists but no consult panel synthesis? → Run Skill(skill=\"hope:consult\", args=\"evaluate approach\") NOW. For Reflect without shape: run Skill(skill=\"hope:consult\") with the intent brief.\n6. Consult done but no loop started? → For Build/Debug: run Skill(skill=\"hope:loop\") NOW. For Plan/Reflect: present output.\n7. All stages complete? → Continue naturally.\n\nPipeline: Build/Debug: intent → shape → consult → loop | Plan: intent → shape → consult → output | Reflect: intent → consult → output\n\nWhen compacting PRESERVE: [SESSION] marker, intent brief, criteria/mustNot, consult synthesis, wave progress\nWhen compacting DISCARD (summarize): tool output, file reads, build logs, stack traces (keep root cause only)\n</session-context>"
  }
}
EOF
