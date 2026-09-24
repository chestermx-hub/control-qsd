---
name: E2E workflow validation
description: Browser tests for workflow-served apps and asynchronously persisted controls
---

For authenticated browser tests, point Playwright at the port actually served by the configured workflow and wait for the mutation response before asserting controlled UI state.

**Why:** The workflow port may differ from Playwright's local default, and this screen refreshes activity state only after the API PATCH completes.

**How to apply:** Set `E2E_BASE_URL` for the active web workflow and use a response-aware click for controls whose checked/enabled state comes from a refetched execution.

For cleaning-flow browser fixtures, define every activity in both the area catalog and the flow catalog; open-execution synchronization removes flow activities absent from the configured area.

**Why:** The execution is normalized from area configuration when it is created and refreshed, so a flow-only activity does not survive into the screen under test.

**How to apply:** Keep the area and flow fixture activity descriptions and photo requirements aligned before starting the execution.