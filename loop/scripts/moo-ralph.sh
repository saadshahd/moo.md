#!/usr/bin/env bash
set -euo pipefail

# moo-ralph.sh - Fresh-instance orchestration for multi-story features
# Usage: ./moo-ralph.sh [max_iterations] [--colleague-pause]

MAX_ITERATIONS="${1:-50}"
COLLEAGUE_MODE=false
PRD_FILE="prd.json"
PROGRESS_FILE="progress.txt"

[[ "${2:-}" == "--colleague-pause" ]] && COLLEAGUE_MODE=true

log() { echo "[RALPH] $(date '+%Y-%m-%d %H:%M:%S') $*"; }
error() { log "ERROR: $*" >&2; exit 1; }

check_prereqs() {
    command -v jq >/dev/null || error "jq required but not installed"
    command -v claude >/dev/null || error "claude CLI required but not installed"
    [[ -f "$PRD_FILE" ]] || error "prd.json not found in current directory"

    local expected_branch
    expected_branch=$(jq -r '.branch' "$PRD_FILE")
    local current_branch
    current_branch=$(git branch --show-current)

    [[ "$current_branch" == "$expected_branch" ]] || \
        error "Expected branch '$expected_branch', currently on '$current_branch'"

    [[ -z "$(git status --porcelain)" ]] || \
        error "Uncommitted changes detected. Commit or stash before running."
}

get_next_story() {
    jq -r '
        .stories[] |
        select(.passes == false) |
        select(
            .blockedBy == [] or
            all(.blockedBy[]; . as $dep | $ARGS.positional | index($dep))
        ) |
        .id
    ' --args $(jq -r '.stories[] | select(.passes == true) | .id' "$PRD_FILE") "$PRD_FILE" | head -1
}

get_story_json() {
    local story_id="$1"
    jq ".stories[] | select(.id == \"$story_id\")" "$PRD_FILE"
}

mark_story_complete() {
    local story_id="$1"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    jq "(.stories[] | select(.id == \"$story_id\")) |= . + {passes: true, completedAt: \"$timestamp\"}" \
        "$PRD_FILE" > "${PRD_FILE}.tmp" && mv "${PRD_FILE}.tmp" "$PRD_FILE"

    local title
    title=$(jq -r ".stories[] | select(.id == \"$story_id\") | .title" "$PRD_FILE")
    echo "[$(date '+%Y-%m-%d %H:%M')] $story_id: $title - COMPLETE" >> "$PROGRESS_FILE"
}

run_story() {
    local story_id="$1"
    local story_json
    story_json=$(get_story_json "$story_id")

    local title description acceptance
    title=$(echo "$story_json" | jq -r '.title')
    description=$(echo "$story_json" | jq -r '.description')
    acceptance=$(echo "$story_json" | jq -r '.acceptance | join("\n- ")')

    log "Starting story: $story_id - $title"
    echo "[$(date '+%Y-%m-%d %H:%M')] $story_id: $title - IN PROGRESS" >> "$PROGRESS_FILE"

    local prompt
    prompt=$(cat <<EOF
You are working on story $story_id as part of a multi-story feature.

## Story: $title

$description

## Acceptance Criteria
- $acceptance

## Instructions

1. Implement this story completely
2. Verify all acceptance criteria
3. When ALL criteria are verified, output:

<story-complete>
Story: $story_id
Acceptance verified:
$(echo "$acceptance" | sed 's/^/- [x] /')
</story-complete>

4. If you cannot complete the story, explain why and output:

<story-blocked>
Story: $story_id
Reason: [explanation]
</story-blocked>

Begin implementation now.
EOF
)

    local output
    output=$(claude --print "$prompt" 2>&1) || true

    if echo "$output" | grep -q "<story-complete>"; then
        log "Story $story_id completed successfully"
        mark_story_complete "$story_id"
        return 0
    elif echo "$output" | grep -q "<story-blocked>"; then
        log "Story $story_id blocked"
        return 1
    else
        log "Story $story_id did not signal completion"
        return 1
    fi
}

colleague_prompt() {
    local story_id="$1"

    if [[ "$COLLEAGUE_MODE" == "true" ]]; then
        local title
        title=$(jq -r ".stories[] | select(.id == \"$story_id\") | .title" "$PRD_FILE")

        echo ""
        log "Story $story_id ($title) complete"
        echo ""
        read -rp "Continue to next story? [Y/n/skip/quit] " response

        case "${response,,}" in
            n) return 1 ;;
            skip) return 2 ;;
            quit) exit 0 ;;
            *) return 0 ;;
        esac
    fi
    return 0
}

all_stories_complete() {
    local incomplete
    incomplete=$(jq '[.stories[] | select(.passes == false)] | length' "$PRD_FILE")
    [[ "$incomplete" -eq 0 ]]
}

main() {
    check_prereqs

    log "Starting Ralph Bridge orchestration"
    log "PRD: $PRD_FILE"
    log "Max iterations: $MAX_ITERATIONS"
    log "Colleague mode: $COLLEAGUE_MODE"
    echo ""

    local iteration=0
    local consecutive_failures=0

    while [[ $iteration -lt $MAX_ITERATIONS ]]; do
        if all_stories_complete; then
            log "All stories complete!"
            echo ""
            echo "<feature-complete>"
            jq -r '.stories[] | "- \(.id): \(.title) ✓"' "$PRD_FILE"
            echo "</feature-complete>"
            exit 0
        fi

        local next_story
        next_story=$(get_next_story)

        if [[ -z "$next_story" ]]; then
            log "No available stories (all remaining are blocked)"
            exit 1
        fi

        ((iteration++))
        log "Iteration $iteration/$MAX_ITERATIONS"

        if run_story "$next_story"; then
            consecutive_failures=0

            colleague_prompt "$next_story"
            local prompt_result=$?

            case $prompt_result in
                1) continue ;;  # Re-run
                2) continue ;;  # Skip (already marked, move on)
            esac
        else
            ((consecutive_failures++))

            if [[ $consecutive_failures -ge 3 ]]; then
                log "Story failed 3 consecutive times. Pausing for human intervention."
                log "Story: $next_story"
                exit 1
            fi
        fi
    done

    log "Max iterations reached ($MAX_ITERATIONS)"
    log "Progress saved to $PROGRESS_FILE"
    exit 1
}

main "$@"
