/* ============================================================
   Victory to Dicey (Cherish) - Phase 1B
   Shows congratulations on win with Play Again / Not Now / Roll Dicey.
   Dicey uses public-safe danger-zone-public.json only.
   Never modifies site data. Private staging only.
   ============================================================ */
'use strict';

const VictoryDicey = (() => {
  
  const DANGER_ZONE_URL = 'danger-zone-public.json';
  let dangerPool = null;
  let victoryShown = false;
  let pendingVictoryTimeout = null;  // P2 fix: track for cancellation
  
  /* ----- Load danger zone pool (public-safe only) ----- */
  async function loadPool() {
    if (dangerPool) return dangerPool;
    try {
      const resp = await fetch(DANGER_ZONE_URL);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      // Only use public-safe fields
      dangerPool = (data.pool || []).map(item => ({
        member: item.member || 'Unknown',
        title: item.title || 'Untitled',
        post_url: item.post_url || null,
        tier: item.tier || 'NEW',
      }));
      return dangerPool;
    } catch (e) {
      console.warn('Dicey: could not load danger zone pool', e);
      return null;
    }
  }
  
  /* ----- Pick a random entry ----- */
  function pickRandom(pool) {
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  /* ----- Show victory overlay ----- */
  function showVictory(finalElapsedMs) {
    if (victoryShown) return;
    victoryShown = true;
    pendingVictoryTimeout = null;
    
    // Create overlay if not exists
    let overlay = document.getElementById('victory-screen');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'victory-screen';
      overlay.className = 'layer';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="panel victory-panel">
          <h2>🎉 YOU WIN! 🎉</h2>
          <p class="victory-sub">Howdy, champion! You cleared the saloon!</p>
          <p class="victory-time" id="victory-time"></p>
          <div id="dicey-result" hidden>
            <div class="dicey-label">🎲 DICEY DISCOVERY 🎲</div>
            <div id="dicey-member" class="dicey-member"></div>
            <div id="dicey-song" class="dicey-song"></div>
            <a id="dicey-link" class="dicey-link" target="_blank" rel="noopener">View Post →</a>
          </div>
          <div class="victory-buttons">
            <button id="victory-dicey" class="p-btn">🎲 Roll Dicey</button>
            <button id="victory-again" class="p-btn">Play Again</button>
            <button id="victory-notnow" class="p-btn">Not Now</button>
          </div>
          <p class="small">Private staging — Dicey uses public-safe data only.</p>
        </div>`;
      document.body.appendChild(overlay);
      
      // Wire buttons
      document.getElementById('victory-again').addEventListener('click', () => {
        hideVictory();
        victoryShown = false;  // Reset BEFORE new game so next win shows overlay
        if (typeof SaveSystem !== 'undefined') SaveSystem.clear();
        if (typeof SaloonEngine !== 'undefined') {
          // P1 fix: carry saved prefs through (don't default to countup/1)
          let timerMode = 'stopwatch', drawMode = 1;
          if (typeof SessionManager !== 'undefined' && SessionManager.getPrefs) {
            const prefs = SessionManager.getPrefs() || {};
            if (prefs.timerMode) timerMode = prefs.timerMode;
            if (prefs.drawMode) drawMode = prefs.drawMode;
          } else if (typeof localStorage !== 'undefined') {
            // Fallback: read from localStorage directly
            try {
              const saved = JSON.parse(localStorage.getItem('tscms_solitaire_prefs_v1') || '{}');
              if (saved.timerMode) timerMode = saved.timerMode;
              if (saved.drawMode) drawMode = saved.drawMode;
            } catch (e) {}
          }
          SaloonEngine.newGame(timerMode, drawMode);
        }
        if (typeof RendererBinding !== 'undefined') RendererBinding.render();
      });
      
      document.getElementById('victory-notnow').addEventListener('click', () => {
        hideVictory();
        // Don't reset victoryShown - player chose to dismiss
        // Game stays in won state, they can start new game via menu
      });
      
      document.getElementById('victory-dicey').addEventListener('click', async () => {
        const btn = document.getElementById('victory-dicey');
        btn.textContent = '🎲 Rolling...';
        btn.disabled = true;
        
        const pool = await loadPool();
        const pick = pickRandom(pool);
        
        const resultDiv = document.getElementById('dicey-result');
        if (pick) {
          document.getElementById('dicey-member').textContent = pick.member;
          document.getElementById('dicey-song').textContent = pick.title;
          const link = document.getElementById('dicey-link');
          if (pick.post_url) {
            link.href = pick.post_url;
            link.style.display = 'inline-block';
          } else {
            link.style.display = 'none';
          }
          resultDiv.removeAttribute('hidden');
        } else {
          document.getElementById('dicey-member').textContent = 'Could not load songs';
          document.getElementById('dicey-song').textContent = 'Try again later';
          document.getElementById('dicey-link').style.display = 'none';
          resultDiv.removeAttribute('hidden');
        }
        
        btn.textContent = '🎲 Roll Again';
        btn.disabled = false;
      });
    }
    
    // P1 fix (Clara v5): show completion time in victory dialog
    if (typeof finalElapsedMs === 'number' && finalElapsedMs > 0) {
      const timeEl = document.getElementById('victory-time');
      if (timeEl) {
        const mins = Math.floor(finalElapsedMs / 60000);
        const secs = Math.floor((finalElapsedMs % 60000) / 1000);
        timeEl.textContent = `⏱️ Completed in ${mins}:${String(secs).padStart(2, '0')}`;
      }
    }
    
    overlay.removeAttribute('hidden');
    overlay.style.display = 'flex';
  }
  
  function hideVictory() {
    const overlay = document.getElementById('victory-screen');
    if (overlay) {
      overlay.setAttribute('hidden', '');
      overlay.style.display = 'none';
    }
  }
  
  /* ----- Check for win after each render ----- */
  function checkWin() {
    try {
      if (typeof SaloonEngine === 'undefined') return;
      const S = SaloonEngine.getState();
      if (S && S.gameWon && !victoryShown) {
        // P1 fix (Clara v4 review): finalize timer on victory
        // Capture final elapsed time so display doesn't reset to 00:00
        let finalElapsed = 0;
        try {
          const live = SaloonEngine._getState();
          if (live) {
            if (live.startTime) {
              live.elapsed = (live.elapsed || 0) + (Date.now() - live.startTime);
              live.startTime = null;
            }
            finalElapsed = live.elapsed || 0;
            // P1 fix (Clara v5 review): refresh HUD AFTER finalization
            // (renderer already updated HUD with stale 00:00 before we finalized)
            if (typeof RendererBinding !== 'undefined' && RendererBinding.render) {
              RendererBinding.render();
            } else {
              // Fallback: update timer display directly
              const timerEl = document.getElementById('timer-display');
              if (timerEl) {
                const mins = Math.floor(finalElapsed / 60000);
                const secs = Math.floor((finalElapsed % 60000) / 1000);
                timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              }
            }
          }
        } catch (e) {}
        // P2 fix: track timeout so it can be cancelled on new game
        // P1 fix (Clara v5): verify still won before showing
        pendingVictoryTimeout = setTimeout(() => {
          pendingVictoryTimeout = null;
          try {
            const cur = SaloonEngine.getState();
            if (cur && cur.gameWon && !victoryShown) {
              try { if (window.TSCMS_SOLITAIRE_TRACK) window.TSCMS_SOLITAIRE_TRACK.win(); } catch(e) {}
              showVictory(finalElapsed);
            }
          } catch (e) {}
        }, 800);
      }
    } catch (e) {}
  }
  
  /* ----- Init: hook into engine state changes ----- */
  function init() {
    if (typeof SaloonEngine !== 'undefined' && SaloonEngine.onStateChange) {
      SaloonEngine.onStateChange(checkWin);
    }
    // Also check periodically in case state changes are missed
    setInterval(checkWin, 2000);
  }
  
  // P1 fix: Reset victory state on any new deal (not just dismiss)
  // P2 fix (Clara v5): cancel pending victory popup
  function resetVictoryState() {
    if (pendingVictoryTimeout) {
      clearTimeout(pendingVictoryTimeout);
      pendingVictoryTimeout = null;
    }
    victoryShown = false;
    hideVictory();
  }
  
  /* ----- STAGING ONLY: Win fixture for testing -----
     Call VictoryDicey.testWin() in console to simulate a win
     without playing a full game. NOT for production. */
  function testWin() {
    console.log('[VictoryDicey] Test fixture: simulating win...');
    victoryShown = false;
    showVictory();
  }
  
  function testSecondWin() {
    console.log('[VictoryDicey] Test fixture: simulating second win...');
    resetVictoryState();
    setTimeout(() => {
      victoryShown = false;
      showVictory();
    }, 100);
  }
  
  return { init, showVictory, hideVictory, checkWin, loadPool, resetVictoryState, testWin, testSecondWin };
})();

// Auto-init on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for other modules to load
    setTimeout(() => VictoryDicey.init(), 1000);
  });
}
