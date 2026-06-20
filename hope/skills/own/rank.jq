# rank.jq — THE deterministic ranking/decay program for hope:own.
# Shipped, never regenerated per debrief: a regenerated filter reintroduces
# the nondeterminism it exists to remove. The model reads this output;
# it never re-derives k, interval, or priority by hand.
#
# Invocation — current time enters ONLY via --argjson, never hand-computed:
#   jq -f rank.jq --argjson now "$(date +%s)" ledger.json
#   $now = current Unix epoch seconds (UTC).
#
# Output: { total, picked, slots, ranked }. Tombstones are excluded.
# k / interval / priority / status are model-facing scheduling internals —
# NEVER surfaced to the user (see SKILL.md: Invisibility).

# k: ordered fold over events. +1 per pass, -1 per fail clamped at 0
# (halve the interval, never reset), reset to 0 on a "changed" verdict
# (code moved out from under the concept; prior passes no longer attest).
# An "authored" seed event hits the else branch: no-op (k unchanged), so a
# freshly authored concept sits at k=0 / assisted with a real lastProbe — it
# schedules like new work but never counts as a pass, so it never promotes.
def k_fold:
  reduce .events[] as $e (0;
    if   $e.outcome == "pass"    then . + 1
    elif $e.outcome == "fail"    then ([. - 1, 0] | max)
    elif $e.outcome == "changed" then 0
    else . end);

# interval = min(1 day * 2^k, 60 days)
def interval_days: [pow(2; k_fold), 60] | min;

def last_probe:
  if (.events | length) == 0 then null
  else (.events | map(.timestamp | fromdateiso8601) | max) end;

# owned iff passes land in >= 2 distinct debriefs — exact, never heuristic.
def status:
  if ([.events[] | select(.outcome == "pass") | .debriefId]
      | unique | length) >= 2
  then "owned" else "assisted" end;

# exactly one pass, and no fail or "changed" verdict after it.
def review_eligible:
  ([.events[] | select(.outcome == "pass")] | length) == 1
  and ((.events | map(.outcome) | index("pass")) as $p
       | [.events[($p + 1):][]
          | select(.outcome == "fail" or .outcome == "changed")]
         | length == 0);

# priority = elapsed-since-last-probe / interval; never-probed = infinite.
def characterize($now):
  . as $c
  | { name: $c.name,
      k: ($c | k_fold),
      intervalDays: ($c | interval_days),
      lastProbe: ($c | last_probe),
      status: ($c | status),
      reviewEligible: ($c | review_eligible),
      priority:
        (($c | last_probe) as $lp
         | if $lp == null then infinite
           else ($now - $lp) / (($c | interval_days) * 86400) end) };

def not_in($keys): .key as $k | ($keys | index($k)) | not;

( [ to_entries[]
    | select(.value | has("mergedInto") | not)
    | {key} + (.value | characterize($now)) ]
  | sort_by([-.priority, .key]) ) as $ranked

# Slot assignment for the 4-question budget; no concept fills two slots.
| ($ranked[0:2] | map(. + {slot: "priority"})) as $prio
| [$ranked[] | select(not_in($prio | map(.key)))] as $rest1
| ((([$rest1[] | select(.reviewEligible)] | first) // ($rest1 | first))
   | if . == null then null else . + {slot: "review"} end) as $review
| [$rest1[] | select(not_in([$review.key]))] as $rest2
| ((([$rest2[] | select(.lastProbe != null)]
     | sort_by([.lastProbe, .key]) | first)
    // ($rest2 | first))
   | if . == null then null else . + {slot: "longtail"} end) as $longtail
| ([$prio[], $review, $longtail] | map(select(. != null))) as $slots
| { total: ($ranked | length),
    picked: ($slots | length),
    slots: $slots,
    ranked: $ranked }
