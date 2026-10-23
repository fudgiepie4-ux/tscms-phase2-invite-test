/* ============================================================
   Mischief Integration Layer (Cherish)
   Connects MischiefEngine to SaloonEngine without modifying
   the protected engine code.
   
   Spec v2.1 — 2026-10-16
   - Wraps SaloonEngine.newGame to init mischief state
   - Wraps move functions to check for ghost strikes
   - Fires engine events for Clara's visuals
   - Manages Undo lock and history barrier
   ============================================================ */
'use strict';

const MischiefIntegration = (() => {
  
  /* ----- Event system for Clara's visuals ----- */
  const eventListeners = {};
  
  function on(event, cb) {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(cb);
  }
  
  function fireEvent(event, data) {
    if (eventListeners[event]) {
      eventListeners[event].forEach(cb => {
        try { cb(data); } catch (e) { /* visual error, don't break game */ }
      });
    }
    // Also dispatch as DOM CustomEvent for flexibility
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
  }

  /* ----- Check if the steal helped the player ----- */
  function checkIfHelped(S) {
    // Simplified: check if any new moves are available that weren't before
    // For now, return false — full implementation needs move generation
    // Clara can use this for a wink animation when true
    return false;
  }

  /* ----- Execute a ghost encounter ----- */
  function executeEncounter(S) {
    const target = MischiefEngine.selectTarget(S);
    
    // No targets = flyby (ghost appears, finds nothing, leaves)
    if (!target) {
      fireEvent('mischief:strike', { character: 'swiper', flyby: true });
      fireEvent('mischief:leave', { helped: false, flyby: true });
      S.mischief.encountersUsed++;
      if (S.mischief.strikeMoves.length > 0) S.mischief.strikeMoves.shift();
      return;
    }
    
    S.mischief.encountersUsed++;
    if (S.mischief.strikeMoves.length > 0) S.mischief.strikeMoves.shift();
    
    if (target.pool === 'scare') {
      // JOKER SCARE: No cards moved, no Undo barrier
      fireEvent('mischief:strike', { 
        character: 'swiper', 
        encounterNumber: S.mischief.encountersUsed 
      });
      fireEvent('mischief:target', { 
        from: target.from, 
        col: target.col,
        card: { isJoker: true }  // Don't expose full card data
      });
      fireEvent('mischief:burned', { card: 'joker' });
      try { if (window.TSCMS_SOLITAIRE_TRACK) window.TSCMS_SOLITAIRE_TRACK.swiper(); } catch(e) {}
      fireEvent('mischief:leave', { helped: false, scared: true });
      // Note: NO history barrier, NO undo lock for scares
      
    } else {
      // ACTUAL STEAL
      const dest = MischiefEngine.selectDestination(S, target, target.col);
      const result = MischiefEngine.executeSteal(S, target, dest);
      
      if (result) {
        // Lock Undo until next player move
        S.mischief.undoLocked = true;
        // Set permanent history barrier
        S.mischief.historyBarrier = true;
        S.history.push({ __mischiefBarrier: true, timestamp: Date.now() });
        
        // Fire events for Clara's visuals
        fireEvent('mischief:strike', { 
          character: 'swiper',
          encounterNumber: S.mischief.encountersUsed 
        });
        fireEvent('mischief:target', { 
          from: target.from, 
          col: target.col 
        });
        fireEvent('mischief:steal', { 
          cardId: result.stolenCard.artId 
        });
        try { if (window.TSCMS_SOLITAIRE_TRACK) window.TSCMS_SOLITAIRE_TRACK.swiper(); } catch(e) {}
        fireEvent('mischief:place', result.destination);
        
        const helped = checkIfHelped(S);
        fireEvent('mischief:leave', { helped: helped, scared: false });
      }
    }
  }

  /* ----- Check if ghost should strike after a move ----- */
  function checkForStrike() {
    try {
      const S = SaloonEngine._getState();
      if (!S || !S.mischief) return;
      if (!S.mischief.enabled) return;
      
      if (MischiefEngine.shouldStrike(S.mischief, S.moves)) {
        executeEncounter(S);
      }
    } catch (e) {
      // Don't break the game if mischief fails
      console.error('Mischief check failed:', e);
    }
  }

  /* ----- Unlock Undo after player's next move ----- */
  function unlockUndoIfNeeded() {
    try {
      const S = SaloonEngine._getState();
      if (S && S.mischief && S.mischief.undoLocked) {
        S.mischief.undoLocked = false;
      }
    } catch (e) { /* ignore */ }
  }

  /* ----- Install wrappers ----- */
  function install() {
    if (typeof SaloonEngine === 'undefined') {
      console.error('MischiefIntegration: SaloonEngine not found');
      return false;
    }
    if (typeof MischiefEngine === 'undefined') {
      console.error('MischiefIntegration: MischiefEngine not found');
      return false;
    }
    
    // Wrap newGame to init mischief state
    const origNewGame = SaloonEngine.newGame;
    SaloonEngine.newGame = function(timerMode, drawMode, mischiefTheme) {
      const result = origNewGame.call(this, timerMode, drawMode);
      try {
        const S = SaloonEngine._getState();
        if (S) {
          S.mischief = MischiefEngine.initMischiefState(mischiefTheme || 'classic');
          // Check if mischief is enabled in settings (default OFF)
          // This will be set by the Settings UI
          S.mischief.enabled = false;
        }
      } catch (e) { /* ignore */ }
      return result;
    };
    
    // Wrap move functions to check for strike AFTER successful moves
    const moveFns = [
      'drawFromStock',
      'moveToFoundation', 
      'moveToSpecificFoundation',
      'moveTableauToTableau',
      'moveWasteToTableau'
    ];
    
    moveFns.forEach(fnName => {
      if (typeof SaloonEngine[fnName] === 'function') {
        const orig = SaloonEngine[fnName];
        SaloonEngine[fnName] = function(...args) {
          const result = orig.apply(this, args);

          // Only on a SUCCESSFUL move:
          // (a) unlock Undo from a previous theft — a FAILED move must never
          //     unlock or bypass the theft barrier;
          // (b) check for a strike (a new theft re-locks Undo itself).
          // Order matters: unlock first, then a new strike may lock again.
          if (result) {
            unlockUndoIfNeeded();
            checkForStrike();
          }

          return result;
        };
      }
    });
    
    // Wrap undo to respect the lock and the theft barrier.
    // FIX (Defect 1, 2026-10-17): the saved reference is named origUndo;
    // the old code called an undefined `orig` and threw on every Undo.
    // FIX (Defect 2, 2026-10-17): the theft barrier is a bare marker, not a
    // snapshot. Undo must NEVER pop or cross it — popping it corrupts the
    // piles (they become undefined). Undo of post-theft moves works normally
    // and simply stops at the most recent barrier.
    const origUndo = SaloonEngine.undo;
    if (typeof origUndo === 'function') {
      SaloonEngine.undo = function() {
        const S = SaloonEngine._getState();
        if (S && S.mischief) {
          // Block if undo is locked (right after ghost steal)
          if (S.mischief.undoLocked) return false;

          // THEFT BARRIER: the marker is not a game state. If it sits on top
          // of the history stack, there is nothing safe to undo into —
          // stop here instead of corrupting the game.
          const top = S.history[S.history.length - 1];
          if (top && top.__mischiefBarrier) return false;
        }
        return origUndo.call(this);
      };
    }
    
    // Expose API for Settings UI and Clara's visuals
    SaloonEngine.mischief = {
      on: on,
      fireEvent: fireEvent,
      isEnabled: () => {
        try {
          const S = SaloonEngine._getState();
          return S && S.mischief && S.mischief.enabled;
        } catch (e) { return false; }
      },
      setEnabled: (enabled) => {
        try {
          const S = SaloonEngine._getState();
          if (S && S.mischief) S.mischief.enabled = !!enabled;
        } catch (e) { /* ignore */ }
      },
      setTheme: (theme) => {
        try {
          const S = SaloonEngine._getState();
          if (S && S.mischief) {
            S.mischief.theme = theme;
            // Update rates based on theme
            const isHalloween = theme === 'halloween';
            S.mischief.encounterRate = isHalloween ? 0.35 : 0.25;
            S.mischief.maxEncounters = isHalloween ? 2 : 1;
          }
        } catch (e) { /* ignore */ }
      },
    };
    
    return true;
  }

  return { install, on, fireEvent };
})();

// Auto-install when both engines are available
if (typeof window !== 'undefined') {
  if (typeof SaloonEngine !== 'undefined' && typeof MischiefEngine !== 'undefined') {
    MischiefIntegration.install();
  } else {
    // Defer until scripts load
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof SaloonEngine !== 'undefined' && typeof MischiefEngine !== 'undefined') {
        MischiefIntegration.install();
      }
    });
  }
}

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MischiefIntegration };
}
