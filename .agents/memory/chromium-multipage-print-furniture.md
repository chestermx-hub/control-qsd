---
name: Chromium multipage print furniture
description: Reliable positioning rules for repeated headers and footers in Chromium print output.
---

Do not move fixed print headers or footers into page margins with negative `top`/`bottom` values or transforms. Chromium can paint those elements on the adjacent page.

**Why:** In multipage output, negative offsets placed the next page's header at the bottom of the previous page and the footer over the first rows of the following page.

**How to apply:** Keep fixed elements at `top: 0` and `bottom: 0`. Reserve their height on every page with padding on the fragmented report container plus `box-decoration-break: clone` and `-webkit-box-decoration-break: clone`. Validate with a real Chromium-generated multipage PDF.

For reports that require exactly one domain item per sheet, prefer explicit A4-height page containers with normal-flow header, content viewport, and footer instead of repeated fixed elements. Measure the rendered content during `beforeprint` and scale it until its measured height fits the viewport.

**Why:** Heuristic sizing based only on row counts can still clip long labels, notes, or photo-bearing rows.

**How to apply:** Fit from actual `scrollHeight`/rendered height after print styles activate, and do not impose a minimum scale that could leave hidden overflow. Give fixed-height grid headers and footers `box-sizing: border-box`; otherwise vertical padding increases their effective height and Chromium can move the footer onto a blank page. Size explicit sheets for the smallest supported printable area (for example, Letter as well as A4), because the print destination can override `@page size`.