---
name: Cleaning activity source of truth
description: Why area, client, and line activity assignments must remain authoritative over copied flow and execution activities.
---

The configured activities for an area, client, and selected line are the source of truth for cleaning capture. Cleaning flows and executions may contain copied activity rows, so changing the area configuration must resync the matching flow snapshots and open executions; the UI must not solve this by merely hiding rows.

**Why:** A flow snapshot can outlive an area configuration change and otherwise reintroduce old activities when a new execution is created.

**How to apply:** When changing capture activity behavior, resolve the assignment by client and line first, prefer line-specific activities over generic activities, then update both the flow rows used for future captures and the open execution rows used by the current capture.