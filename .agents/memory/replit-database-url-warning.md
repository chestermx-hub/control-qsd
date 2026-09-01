---
name: Replit DATABASE_URL warning
description: How to distinguish a shadowed managed connection from a genuinely external database during publishing.
---

When Replit reports an external database, compare the parsed DATABASE_URL host, port, user, and database name with the managed PG* variables before planning a migration. If they match, the warning can be caused by a manually stored DATABASE_URL shadowing Replit's managed value; removing only that secret lets the managed connection take over without moving data.

**Why:** Existing applications can keep working while publishing enforces managed development/production database configuration.

**How to apply:** Back up first, remove the manual DATABASE_URL entry only when the connection details match, restart the API, and verify a data endpoint before republishing.