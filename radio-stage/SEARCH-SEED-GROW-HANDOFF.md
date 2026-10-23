# TSCMS Search — Seed + Grow staging integration (October 22, 2026)

## Current state / release gate
**Staged component only. NOT live, NOT seeded, NOT integrated into homepage.**
Fudgie approved Seed + Grow: Cherish's Step 0 audit (Oct 22) found only Oct 8–22 post records on hand, with 97–99% quality in recent weeks and a weak partial oldest week. Do not claim an existing six-week archive. No currently committed public search-index.json is an actual verified extraction yet. The target ~360 seed is an estimate, not a verified count.

## Source of truth and trust boundary
**Cherish's playlist builder extraction** produces a JSON array or { "songs": [...] } for the entire approved Oct 8–22 seed. No HTML page scraping, arbitrary Drive backfill, synthetic song insertion, Admin data, Dicey data, or inferred missing artists/titles/streams. Each item:
```json
{"artist":"Exact attributed artist","title":"Exact submitted song title","stream":"https://known-stream-host.example/song.mp4","week":"2026-10-14","post_url":"https://facebook.com/groups/.../permalink/.../"}
```
Example schema only — NEVER publish this illustrative record as a song. Every record needs an actual resolved HTTPS audio/video media stream URL, exact title, exact artist, and the station-week date assigned by the playlist builder. `post_url` optional. Reject URL-only/placeholder text. **Do not invent a song record.**

## Initial seed + incremental weekly step
1. In Cherish's restricted pipeline, export the actually verified song list for *all available* Oct 8–22 records (only valid titles/artists/direct streams). Keep the source file private; this is not a public feed.
2. Run `node scripts/build-search-archive.cjs --input /restricted/playlist-extracted.json --archive /restricted/search-archive.json --output /staging/search-index.json`.
3. Record the generator audit (incoming, accepted, rejected, duplicate count, count, range) and compare to Cherish's source report before allowing publication.
4. After validation, ship **only** the generated public `search-index.json` next to standalone preview `tscms-search.html`, `tscms-search.js`, `tscms-search.css`. The index contains only artist/title/stream/week and optional approved post link, no private data. The true coverage range is computed from included songs.
5. At the weekly playlist finalization step, pass that week's final extracted song list through the same command against the **persisted private archive**. The script merges into the previous archive and retains up to seven represented station weeks (this week plus previous six). Never replace a whole weekly group with an incomplete rebuild.
6. Do not silently delete the restricted `search-archive.json` between builds. Back it up, and fail the publish if it is missing after initial seeding (a missing archive on week 2 would erase history).
7. Cherish must hardwire this weekly hook in the generator **before publication**, test one initial seed and one future weekly merge, and report the actual verified counts. No immediate six-hour secret processing; Search has no credentials.
8. Publication requires protected-feature CI PASS, Search-specific CI PASS, Cherish actual browser/mobile verification of artist search returning **all** an artist's songs, exact titles, playable source, accessibility, realistic coverage label, and Fudgie's separate push approval.

## Layout and dependencies
Standalone preview intentionally does not edit `index.html`, `tscms-today.html`, `site.js`, `tscms-public-runtime.js`, Quick Jump, Gamehouse or Firebase.
**Homepage/Search placement rides the separately approved Homepage Pathway design after Sunday's drive.** Do not stealth-edit the generated homepage now or introduce a competing permanent nav. The preview uses the existing public audio runtime `window.dayPlay` when it is available.

## Known blocking acceptance item
**Actual verified archive seed and weekly pipeline integration are not yet present in this GitHub repository.** Cherish holds the playlist builder and extraction sources. Until she supplies/tests that input and the resulting published feed, the Search page correctly displays “The verified song archive is not ready” instead of fabricating matches.
