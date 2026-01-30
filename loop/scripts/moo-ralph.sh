#!/usr/bin/env bash
# moo-ralph.sh - Hybrid Ralph execution with moo.md cognitive infrastructure
#
# Combines Ralph's fresh-instance loop with moo.md's Silent Audit,
# fit scoring, and verification gates.
#
# Usage:
#   ./moo-ralph.sh [max_iterations] [--colleague-pause]
#
# Options:
#   max_iterations    Maximum iterations before stopping (default: 10)
#   --colleague-pause Wait for human input on Colleague-shaped stories (default: auto-continue)
#
# Signals detected:
#   <promise>COMPLETE</promise>     All stories done
#   <ralph-blocked reason="...">    Story not ready, needs human intervention
#   [RALPH-BRIDGE] ⏸                Colleague mode pause (if --colleague-pause)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_ITERATIONS="${1:-10}"
COLLEAGUE_PAUSE=false
PAUSE_SECONDS=2

# Parse flags
for arg in "$@"; do
  case $arg in
    --colleague-pause)
      COLLEAGUE_PAUSE=true
      shift
      ;;
  esac
done

# Validate environment
if ! command -v claude &> /dev/null; then
  echo -e "${RED}Error: claude CLI not found${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found (required for JSON parsing)${NC}"
  exit 1
fi

if [[ ! -f "prd.json" ]]; then
  echo -e "${RED}Error: prd.json not found in current directory${NC}"
  exit 1
fi

# Archive previous run if branch changed
archive_if_needed() {
  local current_branch
  current_branch=$(jq -r '.branchName // empty' prd.json 2>/dev/null || echo "")
  local last_branch
  last_branch=$(cat .moo-ralph-last-branch 2>/dev/null || echo "")

  if [[ -n "$last_branch" && "$current_branch" != "$last_branch" && -f "progress.txt" ]]; then
    local archive_dir="archive/$(date +%Y-%m-%d)-${last_branch#ralph/}"
    mkdir -p "$archive_dir"
    cp prd.json progress.txt "$archive_dir/" 2>/dev/null || true
    echo -e "${BLUE}Archived previous run to $archive_dir${NC}"

    # Reset progress.txt
    echo "# Progress Log

## Codebase Patterns

(Patterns will be added as they're discovered)

---
" > progress.txt
  fi

  echo "$current_branch" > .moo-ralph-last-branch
}

# Count remaining stories
remaining_stories() {
  jq '[.userStories[] | select(.passes == false)] | length' prd.json
}

# Build the prompt for Claude Code
build_prompt() {
  cat << 'PROMPT'
You have the ralph-bridge skill loaded. Execute the next incomplete story from prd.json.

Follow the ralph-bridge protocol:
1. Read prd.json to find next story with passes: false
2. Run Silent Audit (spec score, fit score)
3. If blocked (spec <5 or fit <25), output <ralph-blocked> signal
4. If fit 25-39, execute in Colleague mode (pause for review)
5. If fit 40+, execute in Tool mode (autonomous)
6. Verify all acceptance criteria with execution output (not assumption)
7. Commit only if ALL checks pass
8. Update prd.json and progress.txt
9. Output <promise>COMPLETE</promise> if all stories done

IMPORTANT: Use /loop:ralph-bridge skill for execution.
PROMPT
}

# Main loop
main() {
  archive_if_needed

  local iteration=0
  local remaining
  remaining=$(remaining_stories)

  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  moo-ralph: Hybrid Execution Loop      ║${NC}"
  echo -e "${GREEN}╠════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║  Stories remaining: ${remaining}                   ║${NC}"
  echo -e "${GREEN}║  Max iterations: ${MAX_ITERATIONS}                    ║${NC}"
  echo -e "${GREEN}║  Colleague pause: ${COLLEAGUE_PAUSE}                ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  echo ""

  while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    ((iteration++))

    remaining=$(remaining_stories)
    if [[ "$remaining" -eq 0 ]]; then
      echo -e "${GREEN}All stories complete!${NC}"
      break
    fi

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Iteration $iteration/$MAX_ITERATIONS | Stories remaining: $remaining${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Spawn fresh Claude Code instance
    local output
    output=$(build_prompt | claude --dangerously-skip-permissions --print 2>&1) || true

    # Check for completion
    if echo "$output" | grep -q "<promise>COMPLETE</promise>"; then
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${GREEN}✓ ALL STORIES COMPLETE${NC}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      exit 0
    fi

    # Check for blocked signal
    if echo "$output" | grep -q "<ralph-blocked"; then
      echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${RED}⚠ BLOCKED - Human intervention required${NC}"
      echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

      # Extract and display blocked reason
      local blocked_msg
      blocked_msg=$(echo "$output" | grep -A5 "<ralph-blocked" | head -6)
      echo "$blocked_msg"

      echo ""
      echo -e "${YELLOW}Options:${NC}"
      echo "  1. Fix the issue in prd.json and re-run"
      echo "  2. Add clarification to story.notes"
      echo "  3. Split the story into smaller pieces"
      echo ""
      exit 1
    fi

    # Check for Colleague mode pause
    if echo "$output" | grep -q "\[RALPH-BRIDGE\] ⏸" && [[ "$COLLEAGUE_PAUSE" == "true" ]]; then
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${YELLOW}⏸ COLLEAGUE MODE - Review required${NC}"
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

      # Show the pause message
      echo "$output" | grep -A20 "\[RALPH-BRIDGE\] ⏸"

      echo ""
      read -p "Press ENTER to continue, or Ctrl+C to abort: "
    fi

    # Brief pause between iterations
    sleep $PAUSE_SECONDS

  done

  # Max iterations reached
  remaining=$(remaining_stories)
  if [[ "$remaining" -gt 0 ]]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Max iterations ($MAX_ITERATIONS) reached${NC}"
    echo -e "${YELLOW}Stories remaining: $remaining${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Run again to continue, or check prd.json for blocked stories."
    exit 1
  fi
}

main "$@"
