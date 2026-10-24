# TSCMS Gamehouse — Radio Jukebox Design B (Version 7)
**Owner approval record — 2026-10-17**

## Status and scope
- **OWNER APPROVED:** Version 7's **Design B visual baseline** for the TSCMS Gamehouse expanded saloon jukebox. Owner may request small close-up and cosmetic touch-ups later; approval is not a visual freeze against those.
- **APPROVED TO SHARE IN GITHUB:** Publish this exact Version 7 *standalone owner-review HTML preview* so Cherish can access it and use it in the Gamehouse progression/integration package.
- **NOT APPROVED BY THIS HANDOFF:** Replacing the live playable Solitaire jukebox, modifying the public website/admin, altering any card/board artwork, enabling storm effects/Swiper, or publicly launching the game.
- This is a **publicly addressable GitHub Pages preview** by repository hosting rules, **not an access-controlled private page**. It is not linked into website navigation.

## Complete source / review preview
- **HTML file:** [solitaire-gamehouse-jukebox-DESIGN-B-v7-APPROVED-PREVIEW.html](../solitaire-gamehouse-jukebox-DESIGN-B-v7-APPROVED-PREVIEW.html)
- **Phone-openable preview:** https://fudgiepie4-ux.github.io/tscms-today/solitaire-gamehouse-jukebox-DESIGN-B-v7-APPROVED-PREVIEW.html
- The standalone HTML **embeds its own approved photographic cabinet/background**; no separate JPG uploads or font downloads required. Official radio streams and `radio-data.json` require connectivity.
- GitHub commit that added this preview: `5aef7f56289fa36f1bd5818c9c1a3f423e085a71`; blob SHA `191e671a80f4030c0a291ca1d357c45f429d5cbe`.

## Locked Design B direction
1. **Design B photographic walnut cabinet** with dimensional carved wood, heavy aged brass trim, recessed reflective glass over the digital equalizer, engraved station plaque, illuminated song plate and tactile controls. **Do not substitute an HTML/CSS flat imitation of Design A.**
2. Top **cyan, magenta/pink, and gold/yellow real-neon-look tubes** with bright internal glass highlights, soft surrounding bloom and reflections onto brass and wood; not flat stripes or a cloudy rainbow.
3. Wide **multicolored DIGITAL equalizer bars** (bass to treble); **no vinyl record**. When genuinely reactive, bars must derive from measured audio frequencies, *not* preprogrammed fake bouncing.
4. Current song/artist, previous/play-pause/next, timeline, volume, and original song link; prominent touch targets and phone-friendly viewport.
5. Opening/closing the eventual in-game modal must not stop or restart the jukebox. **No empty “Tap to reopen” standalone-placeholder page in production**: close directly back to the actual game.
6. **Gameplay, existing saloon board, cards, colored painted jukebox and related approved UI remain intact.**

## Integration contract — review BEFORE coding
- This standalone V7 HTML contains its **own preview audio/player logic** and photo background. **Do not iframe or copy its entire audio script into the existing game**, because the game already has one `TSCMSJukebox` music module and one transparent jukebox hit target.
- Cherish and Clara should adapt **only the approved visual/modal elements** to the existing Gamehouse player, using `radio-data.json` as the canonical playlist. Ensure **one audible audio stream**, no parallel competing radio, no new arbitration that pauses/mutes/ducks music on game events, SFX, thunder or ambience.
- Preserve user gesture for audio playback on Android. Metadata, seek, play/pause, next/previous, progress and event updates must be wired to the **same existing player instance**; this may require a reviewed player API enhancement.
- Audio frequency analysis against **actual Suno CDN streams remains UNVERIFIED on the owner's S24**. MediaElementAudioSource can cause silence when CORS disallows analysis; prioritize **audible uninterrupted radio** and do not claim real-reactive streaming bars until real-phone proof. The preview includes local-audio analysis and optional user-permission microphone speaker capture for investigation, not a guarantee.
- Separately test effects/category separation when seasonal SFX ship. Any fallback must be honestly labeled; never mislabel simulated bars as real frequency analysis.
- Verify music remains playing through popup close and all Solitaire events (new game, hint, undo, pause/resume, victory). Cross-page playback continuity is *not* required for initial launch.
- Do not make edits or deploy staging, main website or admin without Fudgie's explicit approval for that additional step.

## Next integration checkpoint
**Cherish:** independently review this exact GitHub preview, confirm the one-player integration strategy and any issues with frequency analysis/metadata, and report the minimum changes needed. No code modifications requested by this documentation handoff. **Clara:** review Cherish's findings before any implementation. **Fudgie:** test and separately approve functional integration/release after phone acceptance.
