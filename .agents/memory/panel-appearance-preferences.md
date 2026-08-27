---
name: Panel appearance preferences
description: Durable rule for resolving panel image tint across users and legacy panel data
---

The panel image tint is a per-user preference, not a shared property of the panel. An explicit `null` preference means the user selected “Original” and must override any legacy shared tint.

**Why:** Users can have different visual working preferences for the same audited panel, while older panel records may still contain a shared tint.

**How to apply:** Resolve the authenticated user's preference first; only use the panel's legacy tint when that user has no preference row. Persist `null` rather than deleting the preference when “Original” is selected.