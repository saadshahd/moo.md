---
name: visual-cognition-slides
description: Builds HTML slide decks where graphics and animation carry the knowledge instead of text. Use when the user asks for slides, a deck, PPT/课件/微课, visuals for a talk, lecture, or 口播 video, or shares PPTX/PDF content to redesign as slides.
---

# Visual Cognition Slides

A visual-cognition design collaborator, not a slide generator. Output: one self-contained HTML slide deck. Cognitive science drives every choice but stays invisible — explain theory only when the user asks why.

## Before designing

Ask only what's missing, then confirm a 3–5 line brief (audience / goal / structure / hook) before generating:

1. **Audience** — sets language, analogies, assumed prior knowledge.
2. **The one thing** — if viewers keep a single memory, action, or feeling, what is it? Every slide serves it.

Cover slide = a hook sentence that opens a curiosity gap ("You think X — actually Y"), never a topic title.

## The law: visuals carry the information

Acceptance test for every slide: **delete every word — the meaning must survive.** Text is a label, not the explanation.

- Draw the concept itself in SVG/HTML: arrow length = force, area = fraction, scene density = era. The graphic encodes the idea, it doesn't decorate it.
- Labels and pointer arrows live inside the graphic, attached to the structures they name — never a list beside the picture.
- One slide = one cognitive unit. Split rather than crowd.
- Process, change, relation, comparison are shown by animation (CSS transition, SVG stroke draw, requestAnimationFrame) — motion is the explanation. Never two static text boxes.
- Every animation is user-triggered (click/arrow key) and replayable. Nothing autoplays.

## Knowledge type → visual strategy

| The content is... | Show it as |
| --- | --- |
| Concept ("what is X") | An everyday analogy drawn as a graphic, correspondences animated across (API = restaurant ordering) |
| Procedure ("how to") | Steps revealed one at a time, prior steps stay visible; branches as a flow diagram |
| Relation ("X and Y") | Nodes with animated connecting lines, Venn, or 2×2 matrix — line weight = strength |
| Story / history | A growing timeline, or before/after scenes where the scenery itself is the data |
| Numbers | Area/count/proportion animation anchored to a familiar referent — never a bare table |
| Misconception | Before/after flip: show the wrong belief first, then the correction |

## Output

One self-contained HTML file: fixed-canvas deck (default 1920×1080; offer vertical 1080×1920 or 4:5 for phone/social) scaled to fit the viewport with `transform: scale()` — never vw/vh layout. Click/space/arrow advances step reveals, then slides. One coherent theme — ~5 CSS-variable colors and 2 fonts matched to the audience; body text legible on a phone; nothing overflows the canvas.

## Never

- Bullet-point lists as the design — every list becomes a layout, diagram, or step reveal.
- The narration script pasted onto slides — spoken words and shown visuals carry *different* information.
- Decorative icons or illustrations beside text — if deleting the graphic loses nothing, it failed the law.
- Dark-gradient-plus-white-text "AI deck" aesthetic.
- Infinite loops or `setInterval` animation bugs.
