---
name: system
description: Create interactive feedback loop visualizer with poke mode. Use when user wants to map a system, see loops, understand why something keeps happening, or find intervention points.
---

# System Playground

Creates an interactive HTML canvas for visualizing and simulating feedback loops in systems.

## When to Use

- "map the system"
- "see the loops"
- "why does this keep happening"
- "find leverage points"
- System dynamics analysis
- Understanding recurring patterns

## What It Creates

A single HTML file with:
- Draggable nodes representing system variables
- Directed edges with polarity (+/-)
- Auto-detected reinforcing (R) and balancing (B) loops
- **Poke mode**: Click a node to simulate value changes and watch ripples propagate
- Prompt output for extracting insights

## Skill Protocol

### 1. Understand the System

Before generating, clarify:
- What system are we modeling?
- What are the key variables (5-15)?
- What relationships exist between them?
- What behavior is the user trying to understand?

### 2. Generate the Playground

Create a single self-contained HTML file following the structure in [references/loop-detection.md](references/loop-detection.md).

**Core requirements:**
- Single HTML file, all CSS/JS inline
- No external dependencies
- Dark theme, system font for UI
- Live preview on every change
- Copy button with "Copied!" feedback

### 3. State Shape

```javascript
const state = {
  nodes: [
    { id: 'sales', label: 'Sales', x: 100, y: 100, value: 50 },
    { id: 'revenue', label: 'Revenue', x: 250, y: 100, value: 50 }
  ],
  edges: [
    { from: 'sales', to: 'revenue', polarity: '+', label: 'generates' }
  ],
  loops: [],
  pokeTarget: null,
  pokeDirection: null
};
```

### 4. Layout

```
+--------------------------------------+
|  Canvas (draggable nodes, edges)     |
|  with polarity (+/-) on connections  |
+-------------------------+------------+
|  Sidebar:               | Prompt     |
|  • Loop inventory       | output     |
|  • Poke controls        |            |
|  • Auto-layout button   | [Copy]     |
+-------------------------+------------+
```

### 5. Unique Features

**Poke Mode:**
1. Click any node to select it as poke target
2. Use +/- buttons to increase or decrease its value
3. Watch ripple propagate through connected edges:
   - Positive polarity (+): change flows in same direction
   - Negative polarity (-): change flows in opposite direction
4. Reinforcing loops amplify the change
5. Balancing loops dampen toward equilibrium
6. Visual feedback: pulsing nodes, colored edge animations

**Loop Detection:**
- Algorithm traces all cycles in the graph
- Counts polarity: even negatives = reinforcing, odd = balancing
- Labels loops R1, R2... (reinforcing) and B1, B2... (balancing)
- Shows loop inventory in sidebar

**Leverage Points:**
- Based on Meadows' hierarchy
- Nodes that appear in multiple loops are higher leverage
- Highlighted in the UI when identified

### 6. Canvas Rendering

Use `<canvas>` element with:
- Hit testing for node selection
- Drag behavior for repositioning
- Edge drawing with arrow markers
- Polarity labels (+/-) on edges
- Force-directed auto-layout option

```javascript
function draw() {
  ctx.clearRect(0, 0, W, H);
  edges.forEach(e => drawEdge(e));
  nodes.forEach(n => drawNode(n));
  if (state.pokeTarget) highlightNode(state.pokeTarget);
}
```

### 7. Prompt Output

Generate natural language, not value dumps:

```
I'm analyzing [SYSTEM NAME]. Here are the feedback loops I've identified:

R1 (Reinforcing): Sales → Revenue → Marketing Budget → Sales
This is a growth engine. More sales generate more revenue, which funds more marketing, driving more sales. Risk: runaway growth or collapse.

B1 (Balancing): Workload → Burnout → Productivity → Workload
This naturally limits capacity. High workload causes burnout, which reduces productivity, which eventually reduces workload.

Intervention analysis:
When I poked [NODE] upward, the system responded by [BEHAVIOR].
This suggests [NODE] is a [high/low] leverage point because [REASON].

Recommended intervention: [SPECIFIC ACTION]
```

### 8. After Browser Interaction

When user returns from the playground:
1. Ask what they observed
2. Parse their description or pasted state
3. Generate actionable insights using hope:trace patterns
4. Suggest interventions ranked by leverage

## Anti-Patterns

- Generating more than 15 nodes initially (overwhelming)
- Missing polarity on edges (undefined behavior)
- No loop detection (missing core value)
- Static diagram without poke mode (not a playground)
- External dependencies (breaks if CDN down)

## Integration

- Feeds into `hope:trace` for root cause analysis
- Uses `hope:soul` feedback-loops tool patterns
- References `hope:soul` leverage-points framework
