---
name: Audit capture positions
description: Rules for LH/RH positions on new audit defect captures and historical data.
---

New defect captures and position updates accept only LH (`left`) or RH (`right`). Existing historical rows may still contain Centro (`center`) and must remain readable so they can be corrected to LH/RH without data loss.

**Why:** Centro is a neutral selector state, not a valid defect position, while older audit data may already contain it.

**How to apply:** Keep `center` in read/output contracts and display compatibility, but reject it for create/update inputs in both the UI and API.