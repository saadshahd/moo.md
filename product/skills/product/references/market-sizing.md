# Market Sizing

TAM/SAM/SOM framework for market opportunity analysis.

## The Three Layers

| Layer | Definition | Question Answered |
|-------|------------|-------------------|
| **TAM** | Total Addressable Market | If everyone who could buy, bought |
| **SAM** | Serviceable Addressable Market | Who we can actually reach |
| **SOM** | Serviceable Obtainable Market | Realistic capture in 2-3 years |

## Calculation Methods

### Top-Down (Fast, Less Accurate)

Start with industry reports, filter down:

```
TAM = Industry report total
SAM = TAM × % in our geographic/segment reach
SOM = SAM × realistic market share (usually 1-5% for startups)
```

**Best for:** Quick validation, investor decks, early exploration.

### Bottom-Up (Slower, More Accurate)

Build from unit economics:

```
SOM = (Customers we can acquire per year) × (Revenue per customer)
SAM = SOM expanded to full reachable market
TAM = SAM expanded to all potential customers globally
```

**Best for:** Operational planning, pricing decisions, go-to-market strategy.

## Sanity Checks

| Check | Warning Sign |
|-------|--------------|
| **SOM > 5% of SAM** | Overoptimistic capture rate |
| **SAM > 50% of TAM** | Geographic/segment filtering too loose |
| **TAM < $100M** | Venture-scale opportunity unlikely |
| **No bottom-up validation** | Top-down only = hand-waving |

## Output Format

```
## Market Sizing: [Product]

### TAM ($XB)
[Industry] × [Price point] = $X
Source: [Report/calculation]

### SAM ($XM)
TAM filtered by:
- Geographic: [regions]
- Segment: [company size, industry]
- Reach: [channels available]
= $X

### SOM ($XM)
Year 1-3 capture:
- Customers: [count] × [ACV]
- Market share: X% of SAM
= $X

### Confidence
- TAM: [High/Medium/Low] - [source quality]
- SAM: [High/Medium/Low] - [filtering rigor]
- SOM: [High/Medium/Low] - [execution assumptions]
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using TAM as if achievable | Focus on SOM for planning |
| Ignoring competition | SOM = SAM × (1 - competitor share) |
| Static sizing | Markets grow; size with CAGR |
| No customer validation | Interview 10+ potential buyers |
