# Probability Cones Reference

## Concept

As predictions extend further into the future, uncertainty increases. Probability cones visualize this by fading events based on distance from present.

## Time Zone Layout

```
|<--- 10 min --->|<------- 10 months ------->|<------- 10 years ------->|
|    Zone 1      |         Zone 2            |         Zone 3           |
|   (certain)    |       (probable)          |       (possible)         |
```

### Zone Boundaries

```javascript
const ZONES = {
  '10min': { start: 0, end: 0.15, baseProbability: 0.95 },
  '10mo': { start: 0.15, end: 0.55, baseProbability: 0.70 },
  '10yr': { start: 0.55, end: 1.0, baseProbability: 0.40 }
};
```

## Probability Decay

Events automatically decay based on zone:

```javascript
function getDisplayProbability(event) {
  const zone = ZONES[event.timeZone];
  const userProbability = event.probability / 100;
  return userProbability * zone.baseProbability;
}
```

A 90% likely event in 10-year zone displays at 36% opacity (0.9 * 0.4).

## Visual Implementation

### Opacity Mapping

```javascript
function drawEvent(ctx, event) {
  const displayProb = getDisplayProbability(event);
  ctx.globalAlpha = Math.max(0.2, displayProb);

  const color = getOptionColor(event.optionId);
  ctx.fillStyle = color;
  roundRect(ctx, event.x, getTrackY(event), 120, 50, 6);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = displayProb > 0.5 ? '#fff' : '#888';
  ctx.fillText(event.label, event.x + 8, getTrackY(event) + 28);
  ctx.fillText(`${event.probability}%`, event.x + 8, getTrackY(event) + 42);
}
```

### Zone Background Gradient

```javascript
function drawTimeZones(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, W, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.05)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.02)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.01)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#30363d';
  ctx.beginPath();
  ctx.moveTo(W * 0.15, 0);
  ctx.lineTo(W * 0.15, H);
  ctx.moveTo(W * 0.55, 0);
  ctx.lineTo(W * 0.55, H);
  ctx.stroke();

  ctx.fillStyle = '#6e7681';
  ctx.font = '12px system-ui';
  ctx.fillText('10 minutes', 10, 20);
  ctx.fillText('10 months', W * 0.15 + 10, 20);
  ctx.fillText('10 years', W * 0.55 + 10, 20);
}
```

## Regret Markers

Triangular flags marking potential regret points:

```javascript
function drawRegretMarker(ctx, marker) {
  const x = getMarkerX(marker);
  const y = getTrackY(marker.optionId) + 60;

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 8, y + 16);
  ctx.lineTo(x + 8, y + 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '10px system-ui';
  ctx.fillText('!', x - 3, y + 12);
}
```

### Regret Marker Interaction

```javascript
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const optionId = getOptionAtY(y);
  const timeZone = getZoneAtX(x);

  if (optionId && timeZone) {
    const note = prompt('What might you regret at this point?');
    if (note) {
      state.regretMarkers.push({ optionId, timeZone, x, note });
      updateAll();
    }
  }
});
```

## Track Rendering

```javascript
function drawTrack(ctx, option, index) {
  const y = HEADER_HEIGHT + index * TRACK_HEIGHT;

  ctx.fillStyle = option.color + '20';
  ctx.fillRect(0, y, W, TRACK_HEIGHT - 4);

  ctx.fillStyle = option.color;
  ctx.font = 'bold 14px system-ui';
  ctx.fillText(option.label, 10, y + 24);
}
```

## Event Dragging

```javascript
let dragging = null;

canvas.addEventListener('mousedown', (e) => {
  const event = getEventAt(e.clientX, e.clientY);
  if (event) {
    dragging = { event, offsetX: e.clientX - event.x };
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (dragging) {
    const newX = e.clientX - dragging.offsetX;
    const zone = getZoneAtX(newX);
    if (zone) {
      dragging.event.x = newX;
      dragging.event.timeZone = zone;
      updateAll();
    }
  }
});

canvas.addEventListener('mouseup', () => {
  dragging = null;
});
```

## Prompt Generation

```javascript
function generatePrompt() {
  let output = `10-10-10 Analysis for ${state.decisionTitle}:\n\n`;

  for (const option of state.options) {
    output += `**${option.label}**\n`;

    for (const zone of ['10min', '10mo', '10yr']) {
      const events = state.events
        .filter(e => e.optionId === option.id && e.timeZone === zone)
        .map(e => `${e.label} (${e.probability}% likely)`)
        .join(', ');

      output += `- ${formatZone(zone)}: ${events || 'No events'}\n`;
    }

    const regrets = state.regretMarkers
      .filter(r => r.optionId === option.id)
      .map(r => `"${r.note}" at ${formatZone(r.timeZone)}`)
      .join(', ');

    output += `- Regret flags: ${regrets || 'None'}\n\n`;
  }

  return output;
}
```

## HTML Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Timeline Playground</title>
  <style>
    body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: system-ui; }
    .container { display: grid; grid-template-columns: 1fr 280px; height: 100vh; }
    canvas { background: #161b22; cursor: crosshair; }
    .sidebar { padding: 16px; border-left: 1px solid #30363d; overflow-y: auto; }
    .option { padding: 8px; margin: 4px 0; border-radius: 4px; }
    .regret-list { margin-top: 16px; }
    .regret-item { padding: 8px; margin: 4px 0; background: #3d1f1f; border-left: 3px solid #ef4444; border-radius: 4px; }
    .prompt-output { margin-top: 16px; padding: 12px; background: #21262d; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
    .copy-btn { margin-top: 8px; padding: 8px 16px; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%; }
    .copy-btn:hover { background: #2ea043; }
  </style>
</head>
<body>
  <div class="container">
    <canvas id="canvas"></canvas>
    <div class="sidebar">
      <h3>Options</h3>
      <div id="options-list"></div>
      <button onclick="addEvent()">+ Add Event</button>
      <h3>Regret Markers</h3>
      <div id="regret-list" class="regret-list"></div>
      <p style="font-size: 12px; color: #6e7681;">Click on timeline to add regret marker</p>
      <div class="prompt-output" id="prompt"></div>
      <button class="copy-btn" onclick="copyPrompt()">Copy Prompt</button>
    </div>
  </div>
  <script>
    // State, rendering, and interaction code here
  </script>
</body>
</html>
```
