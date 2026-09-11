---
name: DB schema declarations before API typecheck
description: TypeScript project references can keep stale database schema declarations after a Drizzle schema change.
---

When changing a schema exported by `lib/db`, refresh the DB project declarations with `pnpm exec tsc -b lib/db --force` before typechecking the API.

**Why:** The API typecheck can resolve an older `lib/db` declaration graph and report missing columns even when the source schema and database have already been updated.

**How to apply:** Run the declaration refresh after schema changes, then run the API typecheck and build.