/* TSCMS LOCKED SALOON VISUAL ADAPTER | PRIVATE STAGING | 2026-10-16
   Independent layer only. No modifications to Cherish's 5 v5 JS modules. */
(function () {
  'use strict';
  const HOME = new URL('./', window.location.href).href; // same-host homepage
  function notify(message) {
    const toast = document.getElementById('toast');
    if (toast) { toast.textContent = message; toast.removeAttribute('hidden'); }
    else window.alert(message);
  }
  function bindExit() {
    const btn = document.getElementById('btn-exit');
    if (!btn) return;
    btn.addEventListener('click', function () {
      try {
        if (typeof SaloonEngine === 'undefined' || typeof SaveSystem === 'undefined' || typeof PauseSystem === 'undefined') {
          notify('Game systems are not ready. Please try again.');return;
        }
        const state = SaloonEngine._getState();
        if (!state) { notify('The game has not loaded. Please try again.'); return; }
        // A brand-new untouched deal has no progress to lose and SaveSystem deliberately
        // does not create a save for it. Finished games are similarly safe to leave.
        if ((state.moves || 0) === 0 || state.gameWon) { window.location.assign(HOME); return; }
        if (!PauseSystem.paused()) PauseSystem.pause('manual');
        const success = SaveSystem.save();
        const saved = SaveSystem.load();
        if (!success || !saved || !SaveSystem.validate(saved) || saved.moves !== state.moves) {
          notify('EXIT BLOCKED: Game progress could not be verified as saved. Resume and try again.');
          return;
        }
        window.location.assign(HOME);
      } catch (e) {
        console.error('Safe Exit failed:',e);
        notify('EXIT BLOCKED: Unable to confirm your saved game.');
      }
    });
  }
  // Cherish's original renderer uses pixel offsets based on viewport width.
  // This new portrait art reserves a narrower vertical fan area. Bound actual
  // DOM card offset to the space ABOVE the ornamental star and lower controls.
  function boundFans() {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    const safeBottom = stage.clientHeight * 0.787;
    for (let c=0;c<7;c++) {
      const pile = document.getElementById('tableau-'+c);
      if (!pile) continue;
      const cards = Array.from(pile.querySelectorAll('.live-card'));
      if (!cards.length) continue;
      const cardH = cards[0].getBoundingClientRect().height || pile.clientWidth * 7/5;
      const available = Math.max(0, safeBottom - (pile.getBoundingClientRect().top - stage.getBoundingClientRect().top) - cardH);
      // Keep maximum depth visible; for large stacks offsets become small.
      const defaultStep = Math.min(36, Math.max(18, Math.round(stage.clientWidth*0.07)));
      const step = cards.length>1 ? Math.min(defaultStep, available/(cards.length-1)) : 0;
      cards.forEach((card,i) => {
        // Suppress the CSS transform transition for this programmatic write
        // so rebuilt cards land at their final fan positions with no visible
        // motion (no 0.15s settle animation on every draw). The forced reflow
        // commits the transform before the transition is restored.
        card.style.transition = 'none';
        card.style.transform = 'translateY('+ (i*step).toFixed(2) +'px)';
        void card.offsetHeight;
        card.style.transition = '';
      });
    }
  }
  function init() {
    bindExit();
    // Only DOM child additions/removals are observed; the positioning style writes
    // themselves do not retrigger this observer.
    const stage = document.querySelector('.stage');
    if (stage && typeof MutationObserver !== 'undefined') {
      // Full-render flash fix (2026-10-18, Cherish isolated dev — Fudgie
      // authorized): fan SYNCHRONOUSLY in the mutation callback. Mutation
      // callbacks run as microtasks, before the next paint, so transforms
      // land before anything is drawn — no one-frame row snap. The old
      // requestAnimationFrame deferral painted one frame of un-fanned cards
      // (visible on the S24 as the tableau snapping into a single row).
      // boundFans() is idempotent; resize + init rAF calls are unchanged.
      const observer = new MutationObserver(() => { boundFans(); });
      for(let c=0;c<7;c++) {
        const t=document.getElementById('tableau-'+c);
        if(t) observer.observe(t,{childList:true});
      }
    }
    window.addEventListener('resize',boundFans);
    requestAnimationFrame(boundFans);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
