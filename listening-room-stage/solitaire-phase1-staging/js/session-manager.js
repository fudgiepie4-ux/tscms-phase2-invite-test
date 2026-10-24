/* ============================================================
   Solitaire Session Detection (Cherish)
   Distinguishes first visit / continuous session / returning visit.
   
   Spec: 2026-10-16 (Fudgie approved, Option C)
   - First visit: show setup popup
   - Continuous session: no welcomes, no setup (sessionStorage flag)
   - Returning visit: welcome-back banner, restore or ready to deal
   ============================================================ */
'use strict';

const SessionManager = (() => {
  
  const SESSION_KEY = 'tscms_solitaire_session';  // sessionStorage (dies on tab close)
  const PREFS_KEY = 'tscms_solitaire_prefs_v1';   // localStorage (persists)
  
  /**
   * Determine the visit type.
   * Returns: 'first' | 'continuous' | 'returning'
   */
  function getVisitType() {
    try {
      // Check sessionStorage for continuous session flag
      const sessionActive = typeof sessionStorage !== 'undefined' && 
                            sessionStorage.getItem(SESSION_KEY) === 'active';
      if (sessionActive) return 'continuous';
      
      // Check localStorage for saved preferences
      const hasPrefs = typeof localStorage !== 'undefined' && 
                       localStorage.getItem(PREFS_KEY) !== null;
      if (hasPrefs) return 'returning';
      
      return 'first';
    } catch (e) {
      return 'first';  // Safe default
    }
  }
  
  /**
   * Mark session as active (call on page load after determining visit type).
   */
  function markSessionActive() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, 'active');
      }
    } catch (e) { /* ignore */ }
  }
  
  /**
   * Get saved preferences.
   */
  function getPrefs() {
    try {
      const json = localStorage.getItem(PREFS_KEY);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Save preferences.
   */
  function savePrefs(prefs) {
    try {
      prefs.hasSeenSetup = true;
      prefs.version = 1;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Get default preferences.
   */
  function defaultPrefs() {
    return {
      theme: 'classic',
      ghostMode: false,
      drawMode: 1,
      timerMode: 'stopwatch',
      hasSeenSetup: false,
      version: 1,
    };
  }
  
  return {
    getVisitType,
    markSessionActive,
    getPrefs,
    savePrefs,
    defaultPrefs,
    SESSION_KEY,
    PREFS_KEY,
  };
})();

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SessionManager };
}
