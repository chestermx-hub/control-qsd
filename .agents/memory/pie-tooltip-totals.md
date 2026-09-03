---
name: Pie tooltip totals
description: Recharts pie tooltips expose the active slice, not the complete dataset.
---

When a pie-chart tooltip shows percentages, pass the full dataset total into the tooltip instead of summing its payload.

**Why:** Recharts commonly supplies only the hovered sector in a pie tooltip payload, so summing that payload makes every sector calculate as 100%.

**How to apply:** Compute the total from the rendered pie data and use it for both tooltip percentages and any external labels.