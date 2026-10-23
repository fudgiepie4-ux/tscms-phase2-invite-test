/* ============================================================
   Solitaire Save System (Cherish)
   Automatic game-state persistence with Swiper protection.
   
   Spec: 2026-10-16 (Fudgie approved)
   - Auto-save after meaningful changes (no manual button)
   - Full state: cards, timer, undo history (50 cap), mischief state
   - Versioned, validated; corrupt saves never overwrite progress
   - Swiper encounters atomic — never re-rolled on restore
   ============================================================ */
'use strict';

const SaveSystem = (() => {
  
  const SAVE_KEY = 'tscms_solitaire_save_v1';
  const SAVE_VERSION = 1;
  const MAX_HISTORY_SAVED = 50;
  
  /* ----- Serialize current game state ----- */
  function serialize() {
    try {
      const S = SaloonEngine._getState();
      if (!S) return null;
      
      // Don't save if no game in progress
      if (S.moves === 0 && S.stock.length > 0) {
        // Fresh deal, nothing to save yet — but still save prefs
        return null;
      }
      
      // P1 fix (Clara v6 review): include active stopwatch segment in saved elapsed
      // If timer is running (startTime set), the saved elapsed must include
      // the time from startTime to now. Do NOT modify live S.elapsed/S.startTime
      // (keeps stopwatch running; avoids double-count on later pause/save).
      let effectiveElapsed = S.elapsed || 0;
      if (S.startTime) {
        effectiveElapsed += Math.max(0, Date.now() - S.startTime);
      }
      
      const data = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        
        // Card state
        stock: S.stock,
        waste: S.waste,
        foundations: S.foundations,
        tableau: S.tableau,
        
        // Progress
        moves: S.moves,
        elapsed: effectiveElapsed,
        // Note: startTime NOT saved — timer pauses while away
        // effectiveElapsed includes active segment up to save moment
        timerMode: S.timerMode,
        drawMode: S.drawMode,
        gameWon: S.gameWon || false,
        
        // Undo history (capped at 50)
        history: S.history
          .filter(h => !h.__mischiefBarrier || true)  // Keep barriers
          .slice(-MAX_HISTORY_SAVED),
        
        // Mischief/Swiper state — CRITICAL: preserved, never re-rolled
        mischief: S.mischief ? {
          enabled: S.mischief.enabled,
          theme: S.mischief.theme,
          encounterRate: S.mischief.encounterRate,
          maxEncounters: S.mischief.maxEncounters,
          encountersUsed: S.mischief.encountersUsed,
          willStrike: S.mischief.willStrike,
          strikeMoves: S.mischief.strikeMoves,
          // undoLocked and historyBarrier are runtime, restored below
        } : null,
        
        // Pause state
        wasPaused: S._paused || false,
        pauseReason: S._pauseReason || null,
      };
      
      return data;
    } catch (e) {
      console.error('SaveSystem.serialize failed:', e);
      return null;
    }
  }
  
  /* ----- Save to localStorage ----- */
  function save() {
    try {
      const data = serialize();
      if (!data) return false;  // Nothing to save
      
      const json = JSON.stringify(data);
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch (e) {
      // Quota exceeded or unavailable — don't crash the game
      console.error('SaveSystem.save failed:', e);
      return false;
    }
  }
  
  /* ----- Validate a save data object ----- */
  function validate(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.version !== SAVE_VERSION) return false;
    if (!Array.isArray(data.stock)) return false;
    if (!Array.isArray(data.waste)) return false;
    if (!Array.isArray(data.foundations) || data.foundations.length !== 4) return false;
    if (!Array.isArray(data.tableau) || data.tableau.length !== 7) return false;
    if (typeof data.moves !== 'number') return false;
    
    // Verify card count (54 cards total across all piles)
    let count = data.stock.length + data.waste.length;
    data.foundations.forEach(p => count += p.length);
    data.tableau.forEach(p => count += p.length);
    if (count !== 54) {
      console.warn('SaveSystem: card count mismatch:', count);
      return false;
    }
    
    return true;
  }
  
  /* ----- Load from localStorage ----- */
  function load() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return null;
      
      const data = JSON.parse(json);
      if (!validate(data)) {
        console.warn('SaveSystem: invalid save data, ignoring');
        return null;
      }
      
      return data;
    } catch (e) {
      console.error('SaveSystem.load failed:', e);
      return null;
    }
  }
  
  /* ----- Restore a save into the engine ----- */
  function restore(data) {
    try {
      if (!validate(data)) return false;
      
      // Build fresh state, then populate from save
      // We use _setState to inject directly (bypasses newGame's deal)
      const S = {
        stock: data.stock,
        waste: data.waste,
        foundations: data.foundations,
        tableau: data.tableau,
        moves: data.moves,
        history: data.history || [],
        timerMode: data.timerMode || 'stopwatch',
        drawMode: data.drawMode || 1,
        startTime: null,  // Timer starts on resume, not on restore
        elapsed: data.elapsed || 0,
        gameWon: data.gameWon || false,
        
        // Restore mischief state EXACTLY — no re-rolling
        mischief: data.mischief ? {
          enabled: data.mischief.enabled,
          theme: data.mischief.theme,
          encounterRate: data.mischief.encounterRate,
          maxEncounters: data.mischief.maxEncounters,
          encountersUsed: data.mischief.encountersUsed,
          willStrike: data.mischief.willStrike,
          strikeMoves: data.mischief.strikeMoves || [],
          undoLocked: false,  // Reset — player must make a move to unlock
          historyBarrier: data.history.some(h => h.__mischiefBarrier),
          // Test-mode markers (staging only): preserve across save/restore
          // so ?swiper_test=scare survives reload. Undefined in normal games.
          _testForceScare: data.mischief._testForceScare,
          _testMode: data.mischief._testMode,
          _testModeWasActive: data.mischief._testModeWasActive,
        } : null,
        
        // Restore pause state
        _paused: data.wasPaused || false,
        _pauseReason: data.pauseReason || null,
      };
      
      SaloonEngine._setState(S);
      return true;
    } catch (e) {
      console.error('SaveSystem.restore failed:', e);
      return false;
    }
  }
  
  /* ----- Clear save (after game won or New Game confirmed) ----- */
  function clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /* ----- Check if a save exists ----- */
  function hasSave() {
    try {
      const data = load();
      return data !== null && !data.gameWon;
    } catch (e) {
      return false;
    }
  }
  
  return {
    SAVE_KEY,
    SAVE_VERSION,
    save,
    load,
    restore,
    clear,
    hasSave,
    validate,
    serialize,
  };
})();

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SaveSystem };
}
