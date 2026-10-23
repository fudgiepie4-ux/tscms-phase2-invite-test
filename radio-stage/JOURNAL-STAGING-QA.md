# Town Journal — first build, STAGING only, no ship tap yet

**Fudgie visual gate:** PASS on the Phone-A integrated prototype at 21:22 CT Oct 22.
**Cherish integrated-art gate:** PASS ~21:17–21:20 CT; remaining phone `aspect-ratio:834/1041` letterbox nit corrected here.
**Content authority:** `town-journal-sources/TSCMS_Town_Journal_FULL_TEXT_20261022.md` (exact 15,606 bytes) handed off by Cherish and uploaded to shared Drive Oct 22. This file, rather than older mockups, controls the entire founding quote, explanatory story, 15 Construction Journal entries, and real credits. All 15 headers and bodies are copied in their manuscript order. Keeper's notes are *editorial only* and excluded from the public pages.
**Layout:** One parchment page at a time; Brenda permanent first, 15 authentic entries newest first across dynamically generated journal sheets, page X of N updates automatically. The one-member-per-page slot grows only when future member entries are approved (no fake future member placeholder). Full Dicey storefront: exact SHA256 of approved 834×1041 Phone-A asset; desktop art unchanged; seven unique decorative assets extracted byte-for-byte from approved prototype, no image retouching.
**Accessibility:** Same production `tscms-legibility.css/js` and public Bigger Text button and localStorage key as other pages, real text/semantic articles/headings, 44px touch buttons, aria-live page and focused page on turn. Mouse/keyboard page turns and mobile must be independently tested.
**Radio:** Removes prototype's isolated local file-upload audio player. Decorative existing-radio link returns to original public station. Journal page turns create, autoplay, pause or restart NO audio and do not reset the station within the Journal. Caution: a full document navigation back to radio may not maintain continuous audio; verify existing shared player behavior rather than claiming otherwise.

## QA before owner ship tap
1. Run `node scripts/test-town-journal-staging.cjs` (source/body/asset exactness), and protected feature CI.
2. Cherish independently compare *every sentence and credit* with manuscript, including the “halloween through Oct 31” note, verify no unshipped milestone appears as completed, compare exact quote and permission.
3. Test actual page on Samsung S24 and widths 360,390,430 and 1280, image ratios, no horizontal overflow, lamp continuity, texture, text contrast, full title and credits, text-button On/Off and persisted preference.
4. Test every page turn, first and last disabled buttons, page count, focus and screenreader behavior. Radio link must not create a competing Audio node. Verify real shared player semantics.
5. DO NOT MERGE or publish until Fudgie says **SHIP** distinctly. Once merged, Cherish must independently test the live page and add the official Change Log and Town Journal entry before marking DONE.

**Next after Journal per Fudgie:** Favorites, Homepage Pathway, then final three-viewpoint re-audit. Invitations PR #26 stays TEST-only. Drive-In PR #24 separate.
