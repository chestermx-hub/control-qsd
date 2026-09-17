---
name: PNG chart export E2E checks
description: Durable browser-test patterns for dashboard chart image downloads and SVG label assertions.
---

Authenticated dashboard export tests should assert the suggested filename, current date, and PNG magic bytes rather than only waiting for a click event. Recharts SVG text can concatenate adjacent tick and label nodes without preserving visual whitespace, so assertions should verify complete names or meaningful fragments separately.

**Why:** A successful download event alone does not prove the browser received a PNG or that the user-facing filename is correct; SVG serialization and DOM text normalization can also make exact visible-string assertions falsely fail.

**How to apply:** Seed isolated authenticated chart data, assert the chart's quantity labels and full names before clicking, await the download, compare the normalized title/date filename, and inspect the first eight bytes for the PNG signature.