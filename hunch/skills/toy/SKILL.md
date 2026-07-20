---
name: toy
description: Use when the user wants to understand a system by interacting with it — asks for a debugger, visualizer, simulator, stepper, playground, or command center — or when reading and explanation haven't built intuition for how something behaves.
---

# toy

To learn French, live in France. Build the smallest world the human can inhabit to intuit how the system works — agents can write code that helps humans understand code.

## Rules

- **The human drives; the world shows.** Buttons, steppers, scrubbers belong to the human. Never automate the step they're trying to learn — build the control panel, let them press run.
- **State visible, time scrubbable.** Surface the hidden things: the stack, the queue, the coordinates, the intermediate value. Step forward, step back, scrub.
- **Consequences immediate.** Every action re-renders its effect next to its cause.
- **Real system when cheap, toy data when the real thing is heavy.**
- **Disposable by default.** Outside the repo, dated filename. A toy earns a commit only when it gets reused.

## What they're grasping → world shape

| Understanding sought | Build |
| --- | --- |
| Execution / runtime behavior | Stepper: scrub through time, internals visible at each step |
| A migration, port, or bulk change | Command center: human triggers each step, before/after side by side |
| A data structure or algorithm | Manipulable objects with live values |
| A parameter or design space | Sliders with instant re-render |

Let the human leave notes inside the world — understanding sticks to the moment it happened.
