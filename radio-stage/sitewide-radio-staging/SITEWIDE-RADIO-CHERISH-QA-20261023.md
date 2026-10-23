# TSCMS Site-Wide Radio — Cherish staging handoff
Oct 23, 2026 · Clara · DRAFT PR #33 · **NOT MERGED / NOT LIVE**

## Governing requirement
Owner Fudgie: one site-wide TSCMS Radio component on Home/Today, Town Journal, Search, Drive-In videos, Gamehouse, and My Playlist. Carry the **same verified station track** and nearly identical playback second, intended playing/paused/stopped, and native volume across same-origin full-page navigation. No silent autoplay on first visit. Browser-denied autoplay presents **Tap to keep listening**, with song named; one tap must retry seek to the saved second **before** playing. No two competing audible sources. No alterations to protected Quick Jump, Feedback, Dicey, Favorites, Pathway, station catalog, Town Journal book/pages or Brenda entry.

**Spec gap:** `TSCMS_Sitewide_Radio_Spec_20261023.md` is referenced in the handoff but could not be retrieved from Clara-accessible goal files, Drive, Library or GitHub. The following is a provisional test matrix based on the explicit conversation, **NOT** an assertion that the missing 8-point document has been read. Cherish MUST compare point-by-point with the original before claiming complete coverage.

## Preview and test lane
This code exists only on branch `clara/sitewide-radio-staging-20261023` (PR #33 is draft). There is **no live preview URL** from the main-branch GitHub Pages deployment. Cherish: check out this branch in a separate workspace and serve repository root using an HTTP server, e.g.:

```bash
git fetch origin clara/sitewide-radio-staging-20261023
git switch --detach origin/clara/sitewide-radio-staging-20261023
python3 -m http.server 8765
```

Visit `http://localhost:8765/` **on the same origin** for all page transitions. For real S24 testing, use a protected staging HTTPS origin rather than a LAN/IP HTTP origin when available; do not touch or repoint `tscmsradio.com`. Never use `file://` since origin/storage behavior differs.

## Provisional 8-point practical acceptance matrix (Fudgie/Cherish to reconcile against source spec)
1. **First ever visit**: clear the `tscms-sitewide-radio-v1` storage key in the staging origin. Each of the seven page files starts with radio silent until user presses Play. No invented playing status.
2. **Same song + second**: start a verified station song; write down its full title and seconds (try 43s+); navigate Home → Journal → Search → Drive-In → Gamehouse → My Playlist → Home. The **same stream** returns close to the prior second; never seek to zero if saved position was nonzero.
3. **Playing policy**: where a browser allows sound on navigation, resume automatically. Where rejected, show the named “Tap to keep listening” state; one tap restores from the saved second. Test Brave, Chrome/Samsung Internet, and Safari as available; record blocked / allowed honestly.
4. **Pause/Stop**: pause in Journal, navigate Search and Gamehouse: stays paused at same time. Stop in Gamehouse, navigate Home: remains stopped (no autoplay) at zero. Verify same after ordinary refresh.
5. **Volume and controls**: 35% volume should carry to all pages; test prev/next, stop, play and Gamehouse remote volume. Existing Gamehouse V7 cabinet/transport remain functional and control the same underlying `TSCMSJukebox` audio.
6. **Single audibility**: when station audio starts, Drive-In ambiance and song-card audio stop; when user explicitly starts video/member audio, station yields. Test rapid navigation, repeated clicks, two browser tabs, and background/foreground, ensuring no double audio. Shared radio module itself creates **zero audio elements**.
7. **Protected features**: station uses existing `radio-data.json` verified streams; cannot restore arbitrary unverified URLs; no favorites are written into station storage. Existing Gamehouse Favorites pilot, Quick Jump, Feedback, Pathway doors, Dicey, admin isolation and member player continue functioning.
8. **Layout, accessibility and preservation**: widths **360/390/430** and desktop, signed out and approved sign-in, portrait/landscape; no radio masking Exit, game cards, Feedback or Journal page controls. Tap targets >=44px, focus visible, status readable. Verify Town Journal pages/Brenda unchanged, music stays loaded after six-hour generator rebuild; re-run CI and screenshot/stamp all proofs.

## Design mechanics
- Source and only audio engine: existing `solitaire-phase1-staging/js/gamehouse-jukebox.js` singleton `window.TSCMSJukebox`. On other pages, the site-wide UI dynamically loads that exact engine. Gamehouse reuses its existing loaded instance; NO duplicate.
- Verified feed remains `./radio-data.json`; restore URL MUST match canonical station feed. Nonzero position uses actual media seek and waits; if unavailable, no play/restart.
- Local storage `tscms-sitewide-radio-v1`: `{v,stream,at,mode,volume,updated}`. Another local key `tscms-sitewide-radio-owner-v1` allows a newly playing tab to ask an older tab to yield. Neither key sends anything to a server.
- Native volumechange event is mirrored so Gamehouse volume changes are saved. Explicit pause/stop have API methods; NotAllowedError does not reset a CORS-verified source/position.
- Home/Today, Search and My Playlist inherit loader through preserved `tscms-public-runtime.js`; Journal/Drive-In/Gamehouse have one explicit module tag. Admin is excluded.
- Native Drive-In ambiance is untouched, with DOM media coordination. Notes: real mobile browser is the deciding test; unit mocks cannot prove all stream seek/gesture or visual layering.

## Do not mark complete until
**Cherish** posts TEST result in PIPELINE BUILDS with browser/width, navigation path, saved song/seconds before-after, volume, autoplay outcome, audio overlap, exact Protected Features checks, and the original spec comparison. **Fudgie** approves visual and behavior. **Only then** request merge/deploy. Afterwards Cherish verifies on production and the official Change Log gets a factual completion entry. Until then status = **STAGING — NOT SHIPPED**.
