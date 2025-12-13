# Concept Map

Visualize relationships between ideas to deepen understanding.

## When to Use

| Trigger                   | Use This Tool                |
| ------------------------- | ---------------------------- |
| Learning new domain       | Map knowledge structure      |
| Explaining complex system | Show relationships visually  |
| Finding knowledge gaps    | Identify missing connections |

## The Framework

```
┌───────────────────────────────────────────────┐
│                                               │
│         ┌─────────┐                           │
│         │ Concept │                           │
│         └────┬────┘                           │
│              │                                │
│         "relates to"                          │
│              │                                │
│              ▼                                │
│   ┌─────────┐     ┌─────────┐                 │
│   │ Concept │────▶│ Concept │                 │
│   └─────────┘     └─────────┘                 │
│        │   "linking phrase"   │               │
│        │                      │               │
│        ▼                      ▼               │
│   ┌─────────┐           ┌─────────┐           │
│   │ Concept │           │ Concept │           │
│   └─────────┘           └─────────┘           │
│                                               │
│   Nodes = concepts (nouns)                    │
│   Edges = relationships (verbs/phrases)       │
│                                               │
└───────────────────────────────────────────────┘
```

## Components

| Element         | Description                        | Example                         |
| --------------- | ---------------------------------- | ------------------------------- |
| **Concepts**    | Nouns representing ideas           | "Database", "Cache", "API"      |
| **Links**       | Verbs showing relationships        | "stores data in", "reads from"  |
| **Hierarchy**   | General → Specific (top to bottom) | "Storage" above "Database"      |
| **Cross-links** | Connections between branches       | Shows non-obvious relationships |

## How to Apply

1. **Start with focus question:** What am I trying to understand?
2. **List key concepts** (15-25 max)
3. **Rank by generality:** Most general at top
4. **Connect with links:** Label each arrow with a verb/phrase
5. **Look for cross-links:** Connections between different branches
6. **Refine:** Reorganize until relationships are clear

## Example

**Focus question:** How does our authentication system work?

```
                        ┌──────────────┐
                        │    User      │
                        └──────┬───────┘
                               │
                           "submits"
                               │
                               ▼
                        ┌──────────────┐
                        │ Credentials  │
                        └──────┬───────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              "validated by"        "hashed with"
                    │                     │
                    ▼                     ▼
             ┌────────────┐         ┌────────────┐
             │  Auth API  │         │   bcrypt   │
             └──────┬─────┘         └────────────┘
                    │
                "queries"
                    │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
  ┌──────────────┐    ┌──────────────┐
  │   User DB    │    │   Session    │
  │              │    │   Store      │
  └──────────────┘    └──────┬───────┘
                             │
                         "returns"
                             │
                             ▼
                      ┌───────────┐
                      │    JWT    │◀────── "verified by"
                      └───────────┘            │
                            │            ┌─────┴──────┐
                        "sent to"        │ Middleware │
                            │            └────────────┘
                            ▼
                      ┌────────────┐
                      │   Client   │
                      └────────────┘
```

**Insight from map:** Cross-link between JWT and Middleware shows verification happens on every request—potential performance concern.

## Key Insight

Concept maps externalize mental models. If you can't map it, you don't fully understand it. The act of mapping reveals gaps.
