---
name: Recharts hover targets
description: Browser-test interaction pattern for Recharts pie and donut sectors.
---

Recharts pie sectors may be far below the viewport, and the center of a sector's bounding box can fall outside the painted arc. Browser tests should scroll the sector into view, find a sampled point whose document element is the sector path, and move the mouse to that point before asserting tooltip content.

**Why:** A normal locator hover can target the enclosing SVG or an empty part of the bounding box, leaving Recharts' tooltip hidden even though the chart is rendered correctly.

**How to apply:** Use this pattern for donut/pie tooltip checks, and keep assertions keyed by the sector's `name` attribute rather than assuming data order.