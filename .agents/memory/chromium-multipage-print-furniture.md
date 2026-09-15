---
name: Chromium multipage print furniture
description: Reliable positioning rules for repeated headers and footers in Chromium print output.
---

Do not move fixed print headers or footers into page margins with negative `top`/`bottom` values or transforms. Chromium can paint those elements on the adjacent page.

**Why:** In multipage output, negative offsets placed the next page's header at the bottom of the previous page and the footer over the first rows of the following page.

**How to apply:** Keep fixed elements at `top: 0` and `bottom: 0`. Reserve their height on every page with padding on the fragmented report container plus `box-decoration-break: clone` and `-webkit-box-decoration-break: clone`. Validate with a real Chromium-generated multipage PDF.