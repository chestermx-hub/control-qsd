---
name: Chart image exports
description: Constraint for keeping downloaded dashboard images visually consistent with the rendered chart.
---

When a chart has visible legend rows outside its SVG, cloning only the SVG produces an incomplete image. Export logic must explicitly compose those legend rows into the exported SVG/canvas and use the combined height.

**Why:** The browser view can include HTML labels and legends that are not descendants of the Recharts SVG, so an image export can look different even when the chart itself is cloned correctly.

**How to apply:** Keep export-only metadata on the chart wrapper, include every visible legend row in the output, and size the canvas from the combined chart-plus-legend dimensions.