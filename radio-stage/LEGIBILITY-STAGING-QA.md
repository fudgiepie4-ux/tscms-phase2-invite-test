# Public Legibility Wave — STAGED, NOT RELEASED

Fudgie authorized staging October 22, 2026, **without** authorizing release until Search publishes and he separately taps publish.

Cherish's Oct 22 measured summary: informational labels in `site.css` go as low as 9px, PLAY can reach 9.5px, other song/post controls 10px; Today Most Loved buttons 11px, Drive-In warning 12px. Approved design: ALWAYS-ON **12px minimum for real informational text**, unchanged if already >=12; independent **Larger Text** toggle lifts originally <=14px by 2–3px; >=18px unchanged. This is **not full-page zoom**. Skip decorative glyph-only elements and aria-hidden artwork.

Stage changes: isolated `tscms-legibility.js` scans real visible text-bearing elements, records baseline computed sizes before changes, applies exact 12px floor and optional +2.5/+3px only to original <=14px, freezes >=18px computed type at original pixel values (including inherited em headings). It listens for DOM child insertions, persists `tscms_large_text` in existing localStorage, has keyboard/44px public toggle; it reuses the public redesign's existing toggle rather than adding a second one. Files added: isolated engine + stylesheet. Only references are added to `index.html`, `tscms-today.html`, `gamehouse.html`, `videos.html`, `public-redesign.html`. Admin and Search PR #23 are unchanged.

**REQUIRED Cherish rendered acceptance matrix before release**:
- On latest public homepage and Today/song cards, text floor ALWAYS ON, Larger Text ON at 360px/390px/normal desktop, clickable PLAY/Suno/Facebook intact, full untruncated titles, pagination and Feedback pill usable.
- Gamehouse/Solitaire at phone width with Larger Text ON: no game controls/card overlap, no board clipping/scroll trap, radio remote/play behavior intact, Swiper untouched. The toggle is a normal-flow control before the board (not floating over cards).
- Videos/Drive-In at phone width, Larger Text ON: all form labels, warnings and upload/email steps readable, background hotspots (including back-home artwork) aligned, form and audio unmodified. The toggle is within the form paper header.
- Public lounge styling and existing toggle remain consistent; no double toggle.
- Re-crawl rendered DOM after JS settles proving **0 informational elements under 12px** (excluding explicitly documented decorative elements); visually verify already-large >=18px titles remain the same; no changed player behavior, class names, image geometry or clickable target positions.
- Verify localStorage preference through actual navigation between these pages and after refresh. Keyboard-only toggle and focus visible.
- Run `node scripts/test-public-legibility.cjs` and protected-feature CI.

**Known QA limitation:** Static Node unit tests alone do not prove no clipping/overlap on real phones. If any layout conflict appears, revise the scoped legibility layer on THIS PR only, rerun tests, and return for Fudgie's approval. **Do not merge before Search PR #23 publishes AND the Owner approves.**

## Oct 22 15:19 CT: Fudgie's phone-approved subtle boldness (STAGING)
Fudgie tried a test page using the PR JavaScript and approved the exact paint-only look. While Larger Text is **ON**, items with ORIGINAL font size <=14px gain *only* left/right `0.28px` `currentColor` text shadows; no `font-weight`, `letter-spacing`, transform, width, element box, or reflow changes. OFF removes the enhancement and restores the prior original inline text-shadow. Large text >14px locks its previous computed shadow so inherited shadows never make 18px+ headings look bolder. The already approved font size floor and toggle sizes are unchanged. Cherish must re-check the exact amount/zero reflow plus real rendered mobile ON-state matrix. **Do not publish #25 until separate Fudgie phone pass and explicit release tap.**

**Integration caution:** PR #24 terms also changes videos.html. Preserve both after whichever PR releases first. Search #23 has now merged; this satisfies ONLY the earlier ordering dependency, NOT the remaining phone QA or Owner publication approval.
