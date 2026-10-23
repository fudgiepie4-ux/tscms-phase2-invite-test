/* ============================================================
   TSCMS Swiper Test Mode — Integration Adapter (v4)
   Phase 2 prep — Cherish, 2026-10-18

   SEPARATE FILE from mischief-integration.js (Clara v3 P0).
   The original MischiefIntegration wrapper is preserved untouched
   in mischief-integration.js. This adapter ONLY wires test-mode
   helpers to the game bootstrap. STAGING ONLY.

   Wiring points:
     1. initTestMode(urlSearch, pageUrl) → testConfig or null
        (exact origin + pathname gate, Clara v3 P2)
     2. applyToNewGame(mischiefState, testConfig) → overridden state
     3. selectEncounterTarget(gameState, mischiefState) → target or null
     4. stagedSave(mischiefState, writerFn) → atomic key+sanitize+write
        (Clara v3 P1: namespace locked before sanitization)
   ============================================================ */
'use strict';

const SwiperTestModeIntegration = (() => {

  // Exact staging page — origin AND pathname must match.
  // v4 (Clara v3 P2): was a string prefix; now exact URL parsing.
  const STAGING_ORIGIN = 'https://fudgiepie4-ux.github.io';
  const STAGING_PATHNAME = '/tscms-today/solitaire-phase1-LOCKED-visual-STAGING.html';

  const TEST_SAVE_KEY = 'tscms_solitaire_save_testmode';
  const REAL_SAVE_KEY = 'tscms_solitaire_save_v1';

  /**
   * Parse test config from URL, gated by EXACT staging origin+pathname.
   * Returns null if: no param, bad value, URL unparseable, or not the
   * exact staging page. (Clara v3 P2: no prefix matching.)
   */
  function initTestMode(urlSearch, pageUrl) {
    let url;
    try {
      url = new URL(pageUrl || '');
    } catch (e) {
      return null;  // unparseable URL — not test mode
    }
    if (url.origin !== STAGING_ORIGIN) return null;
    if (url.pathname !== STAGING_PATHNAME) return null;

    return SwiperTestMode.parseFromUrl(urlSearch);
  }

  /**
   * Apply test override to a freshly initialized mischief state.
   * Call AFTER MischiefEngine.initMischiefState(), BEFORE game starts.
   */
  function applyToNewGame(mischiefState, testConfig, gameState) {
    if (!testConfig) return mischiefState;
    const out = SwiperTestMode.applyOverride(mischiefState, testConfig);
    // Deterministic scare deal (Fudgie 2026-10-18 via Clara): preload one
    // real Joker face-up on a tableau top so the move-3 scare always has
    // an eligible target. Staging/test-only; gameState omitted on reload
    // (the rigged layout persists in the saved card positions).
    if (testConfig.mode === 'scare' && gameState &&
        typeof SwiperTestMode.rigDeterministicScareDeal === 'function') {
      SwiperTestMode.rigDeterministicScareDeal(gameState);
    }
    return out;
  }

  /**
   * Select the encounter target, routing to the scare helper when
   * _testForceScare is set. Returns { from, col?, card, pool } or
   * { pool: 'none', reason: 'NO_ELIGIBLE_JOKER' }.
   */
  function selectEncounterTarget(gameState, mischiefState) {
    if (mischiefState && mischiefState._testForceScare) {
      const scareTarget = SwiperTestMode.selectScareTarget(gameState);
      if (scareTarget) return scareTarget;
      return { pool: 'none', reason: 'NO_ELIGIBLE_JOKER' };
    }
    return MischiefEngine.selectTarget(gameState);
  }

  /**
   * Get the save key. Works on live OR sanitized state.
   * (v4: sanitized test state carries sanitizedFromTest=true.)
   */
  function saveKeyFor(mischiefState) {
    return SwiperTestMode.isTestState(mischiefState)
      ? TEST_SAVE_KEY
      : REAL_SAVE_KEY;
  }

  /**
   * Atomic staged save (Clara v3 P1).
   * Locks the namespace from the LIVE state BEFORE sanitizing,
   * then sanitizes only the payload. The key can never downgrade
   * to the real save, regardless of call order.
   *
   * @param {object} mischiefState - live (unsanitized) state
   * @param {function} writerFn - (key, sanitizedState) => void
   */
  function stagedSave(mischiefState, writerFn) {
    const key = saveKeyFor(mischiefState);  // locked from LIVE state
    const clean = SwiperTestMode.sanitizeForSave(mischiefState);
    writerFn(key, clean);
    return key;
  }

  /**
   * Sanitize without writing (for callers that manage their own keys).
   */
  function prepareForSave(mischiefState) {
    return SwiperTestMode.sanitizeForSave(mischiefState);
  }

  function badgeText(testConfig) {
    return SwiperTestMode.badgeText(testConfig);
  }

  return {
    initTestMode,
    applyToNewGame,
    selectEncounterTarget,
    saveKeyFor,
    stagedSave,
    prepareForSave,
    badgeText,
    STAGING_ORIGIN,
    STAGING_PATHNAME,
    TEST_SAVE_KEY,
    REAL_SAVE_KEY,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SwiperTestModeIntegration;
}
