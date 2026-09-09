---
name: Cleaning line number scope
description: Domain clarification for the cleaning module's line number field.
---

The cleaning module's line number is client/report metadata. It is entered on the client form below plant number, carried into a new cleaning execution, and shown in the executive report; it is not an area type or area classification.

**Why:** The original interpretation as an area classification was incorrect and would mix operational report metadata with the normal/critical area categories.

**How to apply:** Keep area classifications limited to the supported area types. When starting a cleaning report, require a line number and prefill it from the selected client while allowing the operator to edit it.