---
name: Chromium multipage print furniture
description: Reliable positioning rules for repeated headers and footers in Chromium print output.
---

Do not move fixed print headers or footers into page margins with negative `top`/`bottom` values or transforms. Chromium can paint those elements on the adjacent page.

**Why:** In multipage output, negative offsets placed the next page's header at the bottom of the previous page and the footer over the first rows of the following page.

**How to apply:** Keep fixed elements at `top: 0` and `bottom: 0`. Reserve their height on every page with padding on the fragmented report container plus `box-decoration-break: clone` and `-webkit-box-decoration-break: clone`. Validate with a real Chromium-generated multipage PDF.

For reports that require exactly one domain item per sheet, prefer explicit A4-height page containers with normal-flow header, content viewport, and footer instead of repeated fixed elements. Measure the rendered content during `beforeprint` and scale it until its measured height fits the viewport.

**Why:** Heuristic sizing based only on row counts can still clip long labels, notes, or photo-bearing rows.

**How to apply:** Fit from actual `scrollHeight`/rendered height after print styles activate, and do not impose a minimum scale that could leave hidden overflow. Give fixed-height grid headers and footers `box-sizing: border-box`; otherwise vertical padding increases their effective height. Remove screen-only spacing from page containers and every ancestor wrapper in print CSS; even a margin before the report can fragment a full-height cover onto a blank page before its forced break.

If a cover has no footer, do not keep a full-page fixed height solely to fill its background; let its height follow content and use only the page break after it.

**Why:** A vertically offset 280 mm cover spilled only its background onto a completely blank second page, then its forced break moved the first detail sheet to page three.

**How to apply:** Reserve explicit physical height for sheets that need bottom-aligned furniture. For a footerless cover, use auto height and a forced break after the content.

CSS image dimensions do not reduce Chromium PDF size; Chromium can embed each original full-resolution photo.

**Why:** A six-page report reached 175 MB because 25 phone-resolution images contributed about 160 MB.

**How to apply:** Before explicit button-driven printing, temporarily replace report photo sources with resized, JPEG-compressed object URLs, await image decoding, print, then restore originals on `afterprint`.