---
name: Playwright in Nix
description: Runtime requirement for browser-based tests in this Nix workspace.
---

Browser tests should launch the system-provided Chromium rather than assuming the Playwright-downloaded binary has all shared libraries available.

**Why:** The bundled Chromium can fail at startup in the Nix environment when libraries such as glib are not on its runtime link path, while the Nix Chromium package is already configured for the workspace.

**How to apply:** Keep the browser executable configurable through an environment variable, resolve the system `chromium` path when none is supplied, and declare the system package in the workspace configuration.