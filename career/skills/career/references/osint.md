# Job Intel Workflow

OSINT analysis of job postings to surface insider intelligence for job seekers.

## Input Required

Use ask tool to gather:

1. **Company name or careers URL**
2. **Specific roles of interest** (optional)
3. **What they want to understand** (growth areas, culture, red flags, etc.)

## Analysis Process

### Phase 1: Discovery

Search for recent job postings from:

- Official careers site
- LinkedIn Jobs
- Indeed
- BuiltIn (if applicable)
- Other relevant job boards

**Gather only recent postings (<90 days).** Mark older ones as ARCHIVE.

For each posting, record:

- Job title
- Location (remote/hybrid/onsite)
- Posting date + source
- Salary if listed
- 1-2 key snippets revealing company priorities

### Phase 2: Signal Extraction

From the postings, identify:

**Growth Cues:**

- "First hire," "founding member," "new team"
- Expansion into new markets/products
- Leadership roles being created

**Stability Cues:**

- Roles focused on renewals, compliance, customer success
- Backfill positions
- Process/operations roles

**Red Flags:**

- Jobs open >90 days without changes
- Same role reposted multiple times
- Contradictory requirements
- Unrealistic experience/salary ratios
- High volume of similar roles (churn indicator)

**Organizational Focus:**

- Which functions are hiring most? (Sales, Product, Engineering, etc.)
- What does the hiring pattern reveal about priorities?

### Phase 3: Insights Synthesis

Write four sections, 2-3 bullets each:

**1. Where They're Investing**
Teams growing now, with specific examples from postings.

**2. Career Opportunities**
Which roles are freshest (most likely to be filled soon) vs. stale?
What's the realistic entry point?

**3. Culture & Work Style**

- Remote vs onsite signals
- Growth language vs stability language
- Startup energy vs enterprise caution

**4. Watch Outs**
Weak spots to investigate further:

- Teams not hiring (why?)
- Red flags identified
- Questions to ask in interviews

### Phase 4: Evidence Table

Document claims with receipts:

| Claim   | Supporting Snippet | Job + Date + Source         | Confidence |
| ------- | ------------------ | --------------------------- | ---------- |
| [Claim] | "[Quote]"          | [Title] - [Date] - [Source] | 0-100%     |

Mark any >90 day old sources as ARCHIVE.

## Output Format

```
## The Inside Scoop for Job Seekers: [Company] — [Month Year]

### Executive Summary

[2-3 sentences: What a job seeker should know before applying]

---

### Where They're Investing

- [Insight 1 with evidence]
- [Insight 2 with evidence]
- [Insight 3 with evidence]

### Career Opportunities

**Hot roles (posted <30 days):**
- [Role 1]: [Why it's interesting]
- [Role 2]: [Why it's interesting]

**Stale roles (>60 days, proceed with caution):**
- [Role]: [Why it's concerning]

**Entry points:**
[Most realistic path in for different experience levels]

### Culture & Work Style

- [Signal 1]: What it suggests
- [Signal 2]: What it suggests
- [Signal 3]: What it suggests

### Watch Outs

- [Red flag 1]: Question to ask
- [Red flag 2]: Question to ask
- [Area of uncertainty]: How to investigate

---

### Receipts

| Claim | Evidence | Source | Confidence |
|-------|----------|--------|------------|
| [Claim] | "[Snippet]" | [Job - Date - Platform] | X% |
| [Claim] | "[Snippet]" | [Job - Date - Platform] | X% |
| ... | | | |

### Questions to Ask in Interviews

Based on this analysis:
1. [Question targeting uncertainty 1]
2. [Question targeting red flag 1]
3. [Question exploring opportunity 1]

---

*Analysis date: [Date]*
*Sources checked: [List platforms]*
*Postings analyzed: [Count]*
```

## Rules

- Always show dates and sources—unverifiable claims are worthless
- Be direct about both opportunities AND risks
- Tone: insider and useful, not PR
- Confidence scores must be honest
- "ARCHIVE" tag for anything >90 days old
- Questions for interviews should be non-obvious (not just "tell me about the team")
