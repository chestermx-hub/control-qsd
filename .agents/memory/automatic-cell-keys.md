---
name: Automatic cell keys
description: Decision about replacing the manual alphanumeric catalog with grid-derived capture keys.
---

New capture identifiers are derived from the grid row label plus column label, not from a manually maintained alphanumeric catalog.

**Why:** The catalog duplicated information already present in the panel grid and made users maintain a second mapping.

**How to apply:** Keep legacy alphanumeric database/API fields only when needed to read historical data, but do not expose them in navigation, panel configuration, or new-capture flows.