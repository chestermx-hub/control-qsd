---
name: Orval generated hooks require queryKey
description: When passing custom query options to Orval-generated hooks, TypeScript requires an explicit queryKey field or the check fails.
---

When using Orval-generated hooks with custom query options (e.g. `enabled`, `retry`), the `UseQueryOptions` type demands `queryKey` as a required field. Simply passing `{ query: { retry: false } }` causes a TS2741 error.

**Fix:** Import the getter (e.g. `getGetMeQueryKey`) and pass it explicitly:

```typescript
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

useGetMe({
  query: {
    queryKey: getGetMeQueryKey(),
    retry: false,
  }
});
```

**Why:** The Orval v8 generated `UseQueryOptions` type uses the full TanStack Query v5 signature, which requires `queryKey` to be present (no longer optional).

**How to apply:** Any time you pass a `query:` block to a generated hook, include `queryKey: getSomeQueryKey(params)` in that block.
