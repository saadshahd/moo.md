# Loop Detection Reference

## Algorithm

Detect all cycles in a directed graph and classify them as reinforcing or balancing.

### Cycle Detection

Use DFS-based cycle detection:

```javascript
function findAllLoops(nodes, edges) {
  const adjacency = buildAdjacencyList(edges);
  const loops = [];
  const visited = new Set();
  const path = [];

  function dfs(nodeId, startId) {
    if (path.includes(nodeId)) {
      if (nodeId === startId) {
        loops.push([...path]);
      }
      return;
    }

    visited.add(nodeId);
    path.push(nodeId);

    for (const { to, polarity } of adjacency[nodeId] || []) {
      dfs(to, startId);
    }

    path.pop();
  }

  for (const node of nodes) {
    visited.clear();
    path.length = 0;
    dfs(node.id, node.id);
  }

  return deduplicateLoops(loops);
}
```

### Loop Classification

Count negative polarities in the loop:
- **Even count** (0, 2, 4...): Reinforcing loop (R)
- **Odd count** (1, 3, 5...): Balancing loop (B)

```javascript
function classifyLoop(loopNodes, edges) {
  let negativeCount = 0;

  for (let i = 0; i < loopNodes.length; i++) {
    const from = loopNodes[i];
    const to = loopNodes[(i + 1) % loopNodes.length];
    const edge = edges.find(e => e.from === from && e.to === to);

    if (edge && edge.polarity === '-') {
      negativeCount++;
    }
  }

  return negativeCount % 2 === 0 ? 'reinforcing' : 'balancing';
}
```

## Poke Simulation

Simulate value changes propagating through the system.

### Ripple Propagation

```javascript
function simulatePoke(nodeId, direction, iterations = 5) {
  const changes = new Map();
  changes.set(nodeId, direction === '+' ? 10 : -10);

  for (let i = 0; i < iterations; i++) {
    const newChanges = new Map();

    for (const [fromId, delta] of changes) {
      const outEdges = edges.filter(e => e.from === fromId);

      for (const edge of outEdges) {
        const propagatedDelta = edge.polarity === '+' ? delta : -delta;
        const current = newChanges.get(edge.to) || 0;
        newChanges.set(edge.to, current + propagatedDelta * 0.7);
      }
    }

    for (const [id, delta] of newChanges) {
      const node = nodes.find(n => n.id === id);
      if (node) {
        node.value = Math.max(0, Math.min(100, node.value + delta));
      }
    }

    changes.clear();
    for (const [k, v] of newChanges) changes.set(k, v);
  }
}
```

### Visual Feedback

During simulation:
- Poked node pulses with highlight color
- Edges animate with directional flow
- Affected nodes briefly highlight
- Value labels update in real-time

## Force-Directed Layout

Simple spring simulation for auto-arrangement:

```javascript
function autoLayout(nodes, edges, iterations = 100) {
  const k = 50;
  const repulsion = 5000;

  for (let i = 0; i < iterations; i++) {
    for (const a of nodes) {
      let fx = 0, fy = 0;

      for (const b of nodes) {
        if (a === b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      for (const edge of edges) {
        let other = null;
        if (edge.from === a.id) other = nodes.find(n => n.id === edge.to);
        if (edge.to === a.id) other = nodes.find(n => n.id === edge.from);
        if (!other) continue;

        const dx = other.x - a.x;
        const dy = other.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - k) * 0.1;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      a.x += fx * 0.1;
      a.y += fy * 0.1;
    }
  }
}
```

## Leverage Point Scoring

Rank nodes by influence:

```javascript
function scoreLeverage(nodeId, loops) {
  let score = 0;

  for (const loop of loops) {
    if (loop.nodes.includes(nodeId)) {
      score += loop.type === 'reinforcing' ? 2 : 1;
    }
  }

  const inDegree = edges.filter(e => e.to === nodeId).length;
  const outDegree = edges.filter(e => e.from === nodeId).length;
  score += (inDegree + outDegree) * 0.5;

  return score;
}
```

Higher scores indicate higher leverage points.

## HTML Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>System Playground</title>
  <style>
    body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: system-ui; }
    .container { display: grid; grid-template-columns: 1fr 280px; height: 100vh; }
    canvas { background: #161b22; }
    .sidebar { padding: 16px; border-left: 1px solid #30363d; overflow-y: auto; }
    .prompt-output { margin-top: 16px; padding: 12px; background: #21262d; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }
    .copy-btn { margin-top: 8px; padding: 8px 16px; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .copy-btn:hover { background: #2ea043; }
  </style>
</head>
<body>
  <div class="container">
    <canvas id="canvas"></canvas>
    <div class="sidebar">
      <h3>Loops</h3>
      <div id="loop-inventory"></div>
      <h3>Poke Mode</h3>
      <div id="poke-controls"></div>
      <button onclick="autoLayout()">Auto Layout</button>
      <div class="prompt-output" id="prompt"></div>
      <button class="copy-btn" onclick="copyPrompt()">Copy Prompt</button>
    </div>
  </div>
  <script>
    // State and rendering code here
  </script>
</body>
</html>
```
