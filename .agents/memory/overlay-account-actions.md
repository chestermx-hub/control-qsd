---
name: Overlay account actions
description: Accessibility and browser-test convention for account controls rendered inside a navigation overlay.
---

Account actions rendered inside a closed navigation overlay are not user-reachable until the overlay trigger is activated; give the trigger an accessible name and open it in end-to-end tests before interacting with those actions.

**Why:** A logout test initially timed out because the dashboard only rendered the account controls after opening its mobile-style sidebar, even though the authenticated page itself had loaded correctly.

**How to apply:** When validating logout or account controls, assert the labeled menu trigger first, open the overlay, then locate and activate the control.