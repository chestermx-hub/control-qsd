---
name: Draggable image sizing in dynamic containers
description: Why a positioned/draggable overlay element (e.g. an image over a resizable grid) must size itself from its own intrinsic dimensions, not from a sibling layout's computed total.
---

When an element (like an uploaded diagram image) is absolutely positioned and dragged over another layout that can resize (e.g. a grid with resizable rows/columns), do not derive the element's height/width from the layout's current computed total (e.g. `totalH - HEADER_H`) — even if captured once via `useState(() => ...)` at mount.

**Why:** The layout's total is not stable across the lifecycle: it can differ between initial mount (e.g. default rows/columns before user input, or before async form data loads) and a later remount (e.g. reopening an edit dialog with the final saved values). Freezing a size derived from an unstable value at "mount time" causes the element to end up a different size — and thus visually displaced/out of bounds — after save-and-reopen cycles, since the two mounts computed the frozen value from different underlying totals.

**How to apply:** Size the element from its own intrinsic/natural properties instead (e.g. `<img>` `naturalWidth`/`naturalHeight` captured via `onLoad`), decoupling it fully from the sibling layout's mutable dimensions. If the element needs to visually fit the container, do that fitting explicitly via an opt-in action (e.g. a "fit to grid" button that computes and stores a scale factor once) rather than implicitly recomputing size from a live/derived total on every mount or render.
