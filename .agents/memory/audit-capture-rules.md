---
name: Audit capture rules
description: Business rules for audit capture immutability and unit numbering.
---

Unit numbers are scoped independently by audited zone and calendar date: each zone starts at its own next number for that day, and deleted numbers are not reused. Captures may be created and edited for today or previous dates, but future dates remain blocked; historical deletion stays restricted to the administrative permission.

**Why:** Each audited zone represents a separate operational control, while the workflow now needs controlled retroactive correction and historical loading without allowing future-dated data.

**How to apply:** Keep date + zone in counter and list filters, expose create/edit controls for non-future dates, and enforce the future-date restriction in the API rather than relying only on the frontend.