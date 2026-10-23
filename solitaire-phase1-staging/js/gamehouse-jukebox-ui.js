/* Phase 1 approved-visual tap target wiring for Cherish's TSCMS jukebox.
   Independent of gameplay, pause, victory, and seasonal SFX. */
(function () {
  'use strict';
  function init() {
    var btn = document.getElementById('btn-jukebox');
    var radio = window.TSCMSJukebox;
    if (!btn || !radio) return;
    var statusTimer = null;
    function feedback(message) {
      if (!message) return;
      var box = document.getElementById('gamehouse-radio-status');
      if (!box) {
        box = document.createElement('div');
        box.id = 'gamehouse-radio-status';
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        box.setAttribute('hidden', '');
        document.body.appendChild(box);
      }
      if (statusTimer) clearTimeout(statusTimer);
      box.textContent = message;
      box.removeAttribute('hidden');
      statusTimer = setTimeout(function () { box.setAttribute('hidden', ''); }, 2200);
    }
    function setState(state) {
      var playing = (state === 'playing' || state === 'starting');
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      btn.setAttribute('aria-label', playing ? 'Pause TSCMS Radio' : 'Play TSCMS Radio');
      btn.dataset.radioState = state;
    }
    document.addEventListener('tscms:jukebox', function (e) {
      var info = e.detail || {};
      setState(info.state);
      if (info.message) feedback(info.message);
    });
    btn.addEventListener('click', function () {
      if (!radio._state().ready) {
        radio.init({ playlistUrl: 'radio-data.json' });
        feedback('Radio is loading. Tap the jukebox again in a moment.');
        return;
      }
      radio.toggle(); // immediate user gesture — no awaiting fetch before play()
    });
    setState('loading');
    radio.init({ playlistUrl: 'radio-data.json' });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
