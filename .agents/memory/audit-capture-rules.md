---
name: Audit capture rules
description: Business rules for audit capture immutability and unit numbering.
---

Unit numbers are scoped independently by audited zone and calendar date: each zone starts at its own next number for that day, and deleted numbers are not reused. Captures from previous days are read-only; the server rejects updates, deletes, and new inserts for non-current dates.

**Why:** Each audited zone represents a separate operational control, and historical audit data must remain immutable for traceability.

**How to apply:** Keep date + zone in counter and list filters, preserve read-only historical UI states, and enforce immutability in the API rather than relying only on the frontend.