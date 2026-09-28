---
name: OpenAPI generator and Zod compatibility
description: Keep Orval-generated validators compatible with the Zod runtime used by the API client.
---

Before regenerating API contracts, make sure the Orval output matches the Zod major version used by `lib/api-zod`. A newer generator may emit Zod 4 helpers such as `zod.int()` while the project imports Zod 3, causing generated TypeScript to fail.

**Why:** Regenerating the login contract with the installed newer CLI produced Zod 4-only APIs that the project's Zod 3 dependency does not provide.

**How to apply:** Align the generator and runtime versions before accepting generated output, then run the workspace typecheck.