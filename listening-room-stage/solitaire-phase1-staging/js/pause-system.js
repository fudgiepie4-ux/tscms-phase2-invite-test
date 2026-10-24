/* ============================================================
   Solitaire Pause System (Cherish)
   Manual pause, auto-pause (3 min inactivity), visibility pause.
   
   Spec: 2026-10-16 (Fudgie approved)
   - Pause button in bottom controls: Undo | Hint | Pause | New Game
   - 3-minute inactivity auto-pause (interaction-based)
   - visibilitychange → auto-pause (phone calls, background)
   - Timer stops, state saves, interactions blocked
   - Swiper encounters blocked while paused
   ============================================================ */
'use strict';

const PauseSystem = (() => {
  
  const INACTIVITY_MS = 3 * 60 * 1000;  // 3 minutes
  
  let inactivityTimer = null;
  let isPaused = false;
  let pauseReason = null;  // 'manual' | 'inactivity' | 'visibility' | 'returning'
  
  const listeners = {};
  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }
  function fire(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { /* visual error */ }
      });
    }
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('pause:' + event, { detail: data }));
    }
  }
  
  /* ----- Check if game is underway (for inactivity) ----- */
  function isGameUnderway() {
    try {
      const S = SaloonEngine._getState();
      return S && S.moves > 0 && !S.gameWon;
    } catch (e) { return false; }
  }
  
  /* ----- Pause the game ----- */
  function pause(reason) {
    if (isPaused) return false;
    
    try {
      const S = SaloonEngine._getState();
      if (!S) return false;
      
      // Stop the timer — save elapsed, clear startTime
      // P1 fix (Clara v4 review): track whether timer was running
      // so resume() doesn't start it prematurely on a fresh game
      // P1 fix (Clara v5 review): restored games (moves>0) should restart timer
      // even though restore() sets startTime=null. Distinguish fresh (0 moves)
      // from in-progress (moves>0) games.
      S._timerWasRunning = !!S.startTime || 
        (S.timerMode === 'stopwatch' && (S.moves || 0) > 0);
      if (S.startTime) {
        S.elapsed = (S.elapsed || 0) + (Date.now() - S.startTime);
        S.startTime = null;
      }
      
      // Mark paused in state (for save)
      S._paused = true;
      S._pauseReason = reason;
      
      isPaused = true;
      pauseReason = reason;
      
      // Clear inactivity timer (we're already paused)
      clearInactivityTimer();
      
      // Save immediately
      if (typeof SaveSystem !== 'undefined') SaveSystem.save();
      
      fire('paused', { reason });
      return true;
    } catch (e) {
      console.error('PauseSystem.pause failed:', e);
      return false;
    }
  }
  
  /* ----- Resume the game ----- */
  function resume() {
    if (!isPaused) return false;
    
    try {
      const S = SaloonEngine._getState();
      if (!S) return false;
      
      // Restart timer from saved elapsed
      // P1 fix (Clara v4 review): only restart if timer was running before pause
      // Fresh game (startTime was null) stays at null until first move
      if (S._timerWasRunning) {
        S.startTime = Date.now();
      }
      // elapsed stays as-is
      
      S._paused = false;
      S._pauseReason = null;
      
      isPaused = false;
      pauseReason = null;
      
      // Restart inactivity timer
      resetInactivityTimer();
      
      // Save the resumed state
      if (typeof SaveSystem !== 'undefined') SaveSystem.save();
      
      fire('resumed', {});
      return true;
    } catch (e) {
      console.error('PauseSystem.resume failed:', e);
      return false;
    }
  }
  
  /* ----- Reset for new game (P1 fix: don't start timer) ----- */
  /* Clears paused state without setting startTime.
     A fresh game starts with startTime=null; timer begins on first move. */
  function resetForNewGame() {
    isPaused = false;
    pauseReason = null;
    try {
      const S = SaloonEngine._getState();
      if (S) {
        S._paused = false;
        S._pauseReason = null;
        // Do NOT touch S.startTime - new game has startTime=null
        // Timer starts on first valid move per engine behavior
      }
    } catch (e) {}
    // Restart inactivity timer for the new game
    resetInactivityTimer();
    fire('resumed', { forNewGame: true });
    return true;
  }
  
  /* ----- Inactivity timer ----- */
  function resetInactivityTimer() {
    clearInactivityTimer();
    if (isPaused) return;  // Don't run while paused
    
    inactivityTimer = setTimeout(() => {
      // Only auto-pause if game is underway
      if (isGameUnderway() && !isPaused) {
        pause('inactivity');
      }
    }, INACTIVITY_MS);
  }
  
  function clearInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }
  
  /* ----- Record player activity (resets inactivity timer) ----- */
  function recordActivity() {
    if (isPaused) return;  // Activity while paused doesn't unpause
    resetInactivityTimer();
  }
  
  /* ----- Handle visibility change (phone calls, background) ----- */
  function handleVisibilityChange() {
    if (typeof document === 'undefined') return;
    
    if (document.hidden) {
      // Tab hidden → pause if game underway
      if (isGameUnderway() && !isPaused) {
        pause('visibility');
      }
    }
    // On visible: stay paused until user taps Continue
    // (Don't auto-resume)
  }
  
  /* ----- Check if paused (for input blocking) ----- */
  function paused() {
    return isPaused;
  }
  
  function getReason() {
    return pauseReason;
  }
  
  /* ----- Initialize ----- */
  function init() {
    // Visibility change listener
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Start inactivity timer
    resetInactivityTimer();
    
    // Hook into card viewer events (counts as activity)
    if (typeof document !== 'undefined') {
      document.addEventListener('card:view', () => recordActivity());
      document.addEventListener('card:view:close', () => recordActivity());
    }
    
    return true;
  }
  
  return {
    INACTIVITY_MS,
    pause,
    resume,
    paused,
    getReason,
    recordActivity,
    resetInactivityTimer,
    clearInactivityTimer,
    handleVisibilityChange,
    isGameUnderway,
    init,
    on,
    resetForNewGame
  };
})();

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PauseSystem };
}
