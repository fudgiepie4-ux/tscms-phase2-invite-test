# TSCMS protected public homepage — release safety

Owner-approved feature-preservation instructions (October 2026).

## What lives outside the generated pages

The daily generator may update song lists, timestamps, and counts in `index.html` and `tscms-today.html`. **It must not rebuild, overwrite, inline, rename, or delete** these independent modules:

- `tscms-public-runtime.js` — song playback, Dicey, spotlight, personal note, Muse loader.
- `tscms-quick-jump.js` and `tscms-quick-jump.css` — drawer, autumn image navigation, and the protected Dubby/stats bootloader.
- `assets/tscms-autumn-public-links.webp` — visually approved autumn Quick Jump, Group, YouTube, Public Page, Gamehouse artwork.
- `tscms-home-dubby.js` and `tscms-home-dubby.css` — inserts compact **existing** statistics above the YouTube bar and Sponsor TV into their former place below Song of the Week.
- `public-assets/dubby-promo.mp4` and `public-assets/dubby-poster.jpg` — already uploaded, reused by the public sponsor card.
- `tscms-feedback.js`, `tscms-muse-referral.js`, `tscms-muse-referral.css`, `site.js`, and `site.css` — other preserved features.

The generated pages must keep **exactly one** working script reference to the public runtime, Quick Jump JS, and Feedback JS, and **exactly one** site CSS reference. They must retain the generated stats (not hard-coded), YouTube bar, Song of the Week, Gamehouse entry, PUBLIC tab, tabs/day songs, and footer anchor. Do not duplicate the preserved Dubby card or autumn navigation in the generated HTML.

## Approved layout

1. The current autumn Quick Jump navigation is a single image **with real accessible clickable hotspots**; its image must exist before the original links are hidden. The image link targets are the original Facebook Group, TSCMS YouTube channel, Facebook Public Page, and Gamehouse. The drawer must remain functional.
2. "Today in TSCMS" header → the existing **live statistics** as three smaller tiles → YouTube Subscribe → Song of the Week → Dubby Sponsor TV using the existing video and poster → "Songs by Day".
3. Dubby link: `https://www.dubby.gg/discount/TSCMSLIVE?ref=xdejzekt`. Coupon `TSCMSLIVE`. Keep Play/Pause/Stop controls, affiliate disclosure and no autoplay. The sponsor pauses active music when played and does **not** automatically restart songs upon stopping.
4. Do not modify radio, game logic, Solitaire cards, Dicey post-link behavior, Halloween theme, feedback, admin access, or song titles to implement either layout.

## Required release process

1. **Stage edits on a non-public branch** when possible; do not blindly overwrite `main` with regenerated HTML. Review the complete diff for removals/duplicates.
2. From the repository root, run **before pushing or publishing**:
   ```sh
   node scripts/verify-public-preservation.mjs
   ```
   **Any BLOCK is a stop sign.** Fix the source and rerun. Never remove a protected test just to achieve a green result. If a real feature should be retired, obtain the owner's explicit approval.
3. Use a pull request to `main` and verify the **TSCMS Protected Features** check is green. Manually test 360px/390px mobile, desktop, Quick Jump drawer, Group, YouTube, Public Page, Gamehouse, Sponsor TV Play/Pause/Stop, referral, Song of the Week links, and song playback.
4. Publish only after checks **and** review pass. Confirm the GitHub Pages job succeeds, and verify the public site after its cache refresh.
5. In an unexpected failure, stop further deployments, record the failing commit, and revert that specific change (never delete the protected sources or assets). If an image fails to load, the current runtime should leave the original navigation in place.

### Important limitation

This repository's protected-feature workflow runs on PRs and on pushes to `main`; it **reports** broken features. The current GitHub Pages automatic deployment is a separate workflow, and a failed post-push check does not guarantee that Pages will refuse to publish. Use a staging branch + passing checks **before** merging. Enforcing that automatically requires GitHub repository branch rules or a gated Pages deployment workflow, which should be configured separately with owner approval and tested carefully.

**No process can guarantee a site will never crash.** These isolated source files, asset checks, test gates, and rollback procedures are intended to reduce the likelihood and impact of regressions.
