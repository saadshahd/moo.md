# Blog Template

Technical blog post structure following Write the Docs, DevRel, and SEO best practices.

**Adapt structure to context.** These guidelines are defaults, not rigid rules. Adjust based on topic, audience, and publication venue.

## Quality Gates (Check Before Generating)

- [ ] Title < 60 characters
- [ ] Hook in first paragraph (no "In this post...")
- [ ] No heading deeper than H3
- [ ] Paragraphs < 4 sentences
- [ ] Ends with clear takeaway (not "let me know")
- [ ] External source cited for claims (medium+ length)
- [ ] TOC present if > 1500 words

## Required Context (Gather If Not Evident)

- **Topic** — What's the post about?
- **Audience** — Who is reading? (beginner/intermediate/advanced)
- **Takeaway** — What should reader do/know after?
- **Length** — Short (500-800), Medium (1000-1500), Long (2000+)

If context is clear from conversation, proceed. If ambiguous, ask.

## Content Type Context

Identify which type before writing:

| Type | Orientation | Example |
|------|-------------|---------|
| Tutorial | Learning-oriented | "Build a REST API with Express" |
| How-to Guide | Goal-oriented | "How to deploy to Kubernetes" |
| Explanation | Understanding-oriented | "Why React uses a virtual DOM" |
| Reference | Information-oriented | "Complete list of Git commands" |

## Template Structure

### Header Block

```
Title: [title - 60 chars max for SEO]
Subtitle: [optional - hook or context]
Author: [name]
Date: [date]
Tags: [comma-separated]
```

### Heading Hierarchy Rules

| Level | Use | Rule |
|-------|-----|------|
| H1 | Title only | One per post |
| H2 | Major sections | 2-7 depending on length |
| H3 | Subsections | Never deeper than H3 |

**Never use H4 or deeper.** If content needs H4, spin off a separate post.

### Required Sections

#### 1. Hook (First Paragraph)

Create tension, ask a question, or make a bold claim. Promise value.

**Guidelines:**
- Max 3 sentences
- No "In this post, I will..."
- No "Today we're going to..."
- Create curiosity or promise transformation

**Good hooks:**
- Tension: "Most developers get X wrong."
- Question: "What if Y could be 10x faster?"
- Bold claim: "Z is the single biggest factor in..."

#### 2. Context (Medium+ length only)

Brief background needed to understand the post.

**Guidelines:**
- Assume smart readers
- Keep brief (1-2 paragraphs)
- Only include if necessary

#### 3. Body

Organized by H2 sections. Each section follows:

```
Claim → Evidence → Implication
```

**Guidelines:**
- One idea per paragraph
- 3-4 sentences max per paragraph
- 15-20 words per sentence
- Use lists, code blocks, images to break text
- Include 1-3 external sources for credibility

#### 4. Takeaway

Specific, actionable next step or insight.

**Guidelines:**
- End on a strong note
- No "hope this helps" or "let me know what you think"
- Clear call to action or key insight

## Length Tiers

| Tier | Words | H2 Sections | External Sources | TOC Required |
|------|-------|-------------|------------------|--------------|
| Short | 500-800 | 2-3 | 0-1 | No |
| Medium | 1000-1500 | 3-5 | 1-2 | No |
| Long | 2000+ | 5-7 | 2-3 | Yes |

## Table of Contents

For posts > 1500 words, include TOC after hook:

```markdown
## Contents

- [Section 1](#section-1)
- [Section 2](#section-2)
- [Section 3](#section-3)
```

## Anti-Patterns

Avoid these:

| Anti-Pattern | Fix |
|--------------|-----|
| "In this post, I will..." | Start with hook |
| "As I mentioned earlier..." | Remove meta-commentary |
| Overloading jargon | Define or link first use |
| Burying key info | Lead with most important |
| Abstract without examples | Every concept needs example |
| Multiple ideas per paragraph | Split into separate paragraphs |
| "Hope this helps" ending | End with clear takeaway |

## SEO/AI Considerations

| Element | Guideline |
|---------|-----------|
| Title | < 60 characters, front-load keywords |
| Terminology | Same term throughout (consistency) |
| Structure | Use structured data where applicable |

## Output Format

Generate the blog post with all sections populated based on user input. Mark sections needing more detail with `[TODO: ...]`.

After generation, prompt:

> **Draft ready.** Use `/wordsmith:edit` to refine prose, or continue iterating on specific sections.
