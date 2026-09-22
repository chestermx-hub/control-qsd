---
name: Catastrophic backup policy
description: Durable requirements for recovering the Control QSD app outside the Replit workspace.
---

Full recovery copies must be downloadable to an external location and must not depend on Replit Object Storage surviving the same incident. The backup includes source, PostgreSQL data, and application files, while secrets and credentials are deliberately excluded.

**Why:** A backup stored only inside the same Replit workspace or using the same secret values cannot protect against a workspace-level failure or credential exposure.

**How to apply:** Keep backup generation restricted to the superadmin, document manual secret recreation during restore, and treat an authenticated end-to-end archive/download check as a required validation before relying on the feature.