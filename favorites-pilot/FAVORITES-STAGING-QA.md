# TSCMS Favorites Pilot — Staging Test Gate (October 22, 2026)

STATUS: **NOT PUBLISHED.** Owner approved design and test-first build only. Do not merge to main, deploy any Firebase security rules, or expose hearts on a production public page without Cherish's fresh acceptance and Fudgie's later explicit ship tap.

Canonical source: `TSCMS_Favorites_Playlist_Spec_20261022.md` (signed off October 22 at 23:08 CT, Cherish). Rule 1 is absolute: **signed-out rendered public pages have ZERO hearts and ZERO playlist doors**. Only approved verified team users may see controls; pending/revoked/unverified/signed-out must never see them. Firebase Security Rules enforce ownership server-side; CSS hidden controls are forbidden as a substitute for absence.

## Testing sequence (verbatim intent of owner's seven checks)
1. **Signed-out DOM check (headline):** public pages contain zero heart elements, zero playlist doors — verified in the rendered page, not just the source.
2. Signed-in: heart → confirmation appears → one tap reaches the playlist → song is there → survives reload and a second device/session.
3. Un-heart from both the song card and the playlist page; count on the door updates everywhere.
4. Play All runs in order; a planted dead link in staging shows the honest note.
5. Firestore rules test: user A cannot read user B's favorites.
6. Owner stat matches a hand count on test accounts.
7. Phone ground truth from Fudgie; Protected Features CI green (playlist page added to the registry once live).

### Pilot additions within scope
- Hearts on homepage `.song` cards and Search result rows only for approved signed-in team profiles.
- Gamehouse: save/remove playing track, Favorites mode on same Jukebox player, remove from Favorites view; never create a competing `<audio>` stream. The existing Radio playlist must be restorable and playback must not silently start on page load.
- Own playlist page `my-playlist.html`, saved newest-first, snapshots retain original full artist/title/stream, plain dead stream error, remove everywhere.
- Signed-in-only Quick Jump door + inline save confirmation + persistent user-name door with count. Signed-out bookmark visit reveals sign-in path only, no list.
- Owner-only aggregate stat **only** (sum of team favorites + number of team accounts with at least one); no per-person list exposed in Control Room. Do not implement insecure client counts.
- v4 rules must be additive and independently proven with Firebase rules emulator: user A/B isolation, pending/revoked, unauthenticated and owner aggregate reads, invalid fields, timestamp and URL validation. **The rules fragment in this PR is a proposal, not an installed/deployed ruleset.**

### Release hold and implementation review
- Confirm the actual current v4 Firestore rules and current shared Firebase Auth persistence; ensure approved user state survives moving from Admin to public pages and Gamehouse without signing into a second separate app.
- Test Firebase `getDocFromServer` on user profile and `onSnapshot` on own favorites; no controls render until *both* approved state and owned playlist data are confirmed by server.
- Verify generated homepage refresh pipeline preserves module includes; add protected feature registry entries after separately owner-approved ship, not during staging.
- Confirm Gamehouse V7 Shadow DOM controls do not obscure play, pause, previous, next, timer, cards or screen-reader focus; cross-page audio behavior is separate, do not claim uninterrupted music across documents.
- Confirm no Dicey heart cards or other out-of-scope controls appear.

No production merge, Auth changes or writes were authorized by the 23:08 sign-off. The independent seven gates and real owner phone view are required.
