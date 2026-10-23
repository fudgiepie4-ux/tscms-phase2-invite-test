/* ============================================================
   TSCMS Halloween Theme Module (window.TSCMSHalloween)
   V5 visual treatment port.
   Source: solitaire-halloween-weather-VISUAL-PREVIEW.html @ a531a6a7
   (Halloween concept v5: original branching blue/violet storm)

   Approved V5 direction: realistic storm atmosphere. NO cartoon
   emoji/cobweb sticker overlays (bats, pumpkins, webs disabled
   in V5 — not ported). NO AUDIO — storm ambience stays OFF.

   Interface (as wired in the staging HTML):
     TSCMSHalloween.setTheme('classic'|'halloween', savePref)
     TSCMSHalloween.getTheme() -> 'classic' | 'halloween'
     TSCMSHalloween.setLightning(bool)
     TSCMSHalloween.getLightning() -> bool
   Dispatches 'tscms:theme-changed' on document when theme changes.

   Theme applies to the NEXT new deal (bootstrap reads the pref).
   The visual atmosphere reflects the CURRENT game's theme, which
   the bootstrap sets via setTheme(theme, false) on newGame.
   ============================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PREFS_KEY = 'tscms_solitaire_prefs_swiper_staging_v1';
  var stage = null;
  var rainLayer = null;
  var stormLight = null;
  var bolt = null;
  var boltGlow = null;
  var boltCore = null;
  var theme = 'classic';
  var lightningOn = true;
  var paused = false;
  var timer = null;
  var strikeOff = null;
  var initialized = false;

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ----- Prefs (staging key) ----- */
  function readPrefs() {
    try {
      var json = localStorage.getItem(PREFS_KEY);
      return json ? JSON.parse(json) : {};
    } catch (e) { return {}; }
  }
  function writePrefs(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      return true;
    } catch (e) { return false; }
  }

  /* ----- Overlay DOM (V5 structure, IDs namespaced hw*) ----- */
  function buildOverlays() {
    var frag = document.createElement('div');
    frag.innerHTML =
      '<div class="haunt-tint" aria-hidden="true"></div>' +
      '<div class="haunt-glow" aria-hidden="true"></div>' +
      '<svg class="hw-window-weather" viewBox="0 0 941 1672" ' +
      'preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="hwWindowCutouts">' +
      '<path d="M497 160 Q510 147 533 151 L546 153 L546 253 L497 253 Z"/>' +
      '<path d="M560 155 Q581 145 610 161 L615 252 L560 252 Z"/>' +
      '<path d="M8 227 L55 206 L55 283 L8 283 Z"/>' +
      '<path d="M289 129 L336 132 L341 189 L291 191 Z"/>' +
      '</clipPath></defs>' +
      '<g class="hw-rain" id="hwRainLayer"></g>' +
      '</svg>' +
      '<div class="rain-haze" aria-hidden="true"></div>' +
      '<div class="storm-light" id="hwStormLight" aria-hidden="true"></div>' +
      '<svg class="lightning-bolt" id="hwBolt" viewBox="0 0 941 1672" ' +
      'preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="hwSkyCut">' +
      '<path d="M497 160 Q510 147 533 151 L546 153 L546 253 L497 253 Z ' +
      'M560 155 Q581 145 610 161 L615 252 L560 252 Z"/>' +
      '</clipPath></defs>' +
      '<g clip-path="url(#hwSkyCut)">' +
      '<g id="hwBoltGlow"></g><g id="hwBoltCore"></g>' +
      '</g></svg>';

    while (frag.firstChild) stage.appendChild(frag.firstChild);

    rainLayer = document.getElementById('hwRainLayer');
    stormLight = document.getElementById('hwStormLight');
    bolt = document.getElementById('hwBolt');
    boltGlow = document.getElementById('hwBoltGlow');
    boltCore = document.getElementById('hwBoltCore');

    // V5 rain: 115 drops, randomized length/speed/phase/opacity.
    for (var i = 0; i < 115; i++) {
      var line = document.createElementNS(NS, 'line');
      var x = rand(0, 941), y = rand(100, 310);
      line.setAttribute('x1', x.toFixed(1));
      line.setAttribute('x2', (x - 3).toFixed(1));
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('y2', (y + rand(9, 22)).toFixed(1));
      line.style.animationDuration = rand(.65, 1.22).toFixed(2) + 's';
      line.style.animationDelay = (-rand(0, 2)).toFixed(2) + 's';
      line.style.opacity = rand(.20, .64).toFixed(2);
      rainLayer.appendChild(line);
    }
  }

  /* ----- Procedural branching bolt (V5 geometry) ----- */
  function makeLightning(violet) {
    var minX = 502, maxX = 608;
    var baseX = 535 + Math.random() * 46, points = [[baseX, 149]];
    var x = baseX, y = 149, i, k, t;
    for (i = 0; i < 13; i++) {
      y = Math.min(255, y + 8 + Math.random() * 4);
      x = Math.max(minX, Math.min(maxX, x + (Math.random() - .5) * 21));
      points.push([x, y]);
    }
    var paths = [points];
    for (k = 0; k < 7; k++) {
      var ix = 2 + Math.floor(Math.random() * (points.length - 5));
      var p = points[ix], way = Math.random() < .5 ? -1 : 1;
      var branch = [p], bx = p[0], by = p[1];
      for (t = 0; t < 3; t++) {
        bx = Math.max(minX, Math.min(maxX, bx + way * (6 + Math.random() * 12)));
        by += 5 + Math.random() * 7;
        branch.push([bx, by]);
      }
      paths.push(branch);
    }
    boltGlow.textContent = '';
    boltCore.textContent = '';
    var coreColor = violet ? '#f2deff' : '#edfaff';
    var aura = violet ? '#b46cff' : '#5fa8ff';
    paths.forEach(function (arr, index) {
      var d = arr.map(function (pt, j) {
        return (j ? 'L' : 'M') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1);
      }).join(' ');
      var glow = document.createElementNS(NS, 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', aura);
      glow.setAttribute('stroke-width', index ? 4.5 : 8);
      glow.setAttribute('stroke-linecap', 'round');
      boltGlow.appendChild(glow);
      var core = document.createElementNS(NS, 'path');
      core.setAttribute('d', d);
      core.setAttribute('fill', 'none');
      core.setAttribute('stroke', index ? aura : coreColor);
      core.setAttribute('stroke-width', index ? 0.8 : 1.9);
      core.setAttribute('stroke-linecap', 'round');
      boltCore.appendChild(core);
    });
  }

  /* ----- Storm loop (visual only — no audio) ----- */
  function clearFlash() {
    clearTimeout(strikeOff);
    if (stormLight) stormLight.classList.remove('flash');
    if (bolt) bolt.classList.remove('flash');
  }

  function stormAllowed() {
    return theme === 'halloween' && lightningOn && !paused &&
      document.visibilityState === 'visible' && !reducedMotion;
  }

  function strikeStorm() {
    clearTimeout(timer);
    clearFlash();
    if (!stormAllowed()) return;
    var violet = Math.random() < .38;
    makeLightning(violet);
    stormLight.classList.add('flash');
    bolt.classList.add('flash');
    strikeOff = setTimeout(function () {
      clearFlash();
      stormTick();
    }, 310);
  }

  function stormTick() {
    clearTimeout(timer);
    if (!stormAllowed()) { clearFlash(); return; }
    timer = setTimeout(strikeStorm, 7000 + Math.random() * 9000);
  }

  function applyThemeToStage() {
    document.documentElement.setAttribute('data-theme', theme);
    stormTick();
  }

  function setPaused(p) {
    paused = !!p;
    if (paused) {
      clearTimeout(timer);
      clearFlash();
    } else {
      stormTick();
    }
    // Pause/resume rain CSS animation.
    if (rainLayer) {
      var state = paused ? 'paused' : 'running';
      rainLayer.style.animationPlayState = state;
      var lines = rainLayer.querySelectorAll('line');
      for (var i = 0; i < lines.length; i++) {
        lines[i].style.animationPlayState = state;
      }
    }
  }

  /* ----- Public API ----- */
  function init() {
    if (initialized) return true;
    stage = document.getElementById('stage');
    if (!stage) return false;
    buildOverlays();
    // Restore saved theme pref (staging key).
    var prefs = readPrefs();
    if (prefs.theme === 'halloween' || prefs.theme === 'classic') {
      theme = prefs.theme;
    }
    // Restore lightning pref.
    if (prefs.lightning === false) lightningOn = false;
    applyThemeToStage();
    // Sync from a restored game (its theme overrides the pref).
    // The engine may not be ready yet; retry a few times.
    var attempts = 0;
    var syncTimer = setInterval(function () {
      attempts++;
      try {
        if (typeof SaloonEngine !== 'undefined' && SaloonEngine._getState) {
          var st = SaloonEngine._getState();
          if (st && st.mischief && (st.mischief.theme === 'halloween' || st.mischief.theme === 'classic')) {
            if (st.mischief.theme !== theme) {
              setTheme(st.mischief.theme, false);
            }
            clearInterval(syncTimer);
          }
        }
      } catch (e) { /* engine not ready */ }
      if (attempts >= 20) clearInterval(syncTimer);
    }, 500);
    document.addEventListener('pause:paused', function () { setPaused(true); });
    document.addEventListener('pause:resumed', function () { setPaused(false); });
    document.addEventListener('visibilitychange', function () { stormTick(); });
    window.addEventListener('pagehide', function () {
      clearTimeout(timer);
      clearFlash();
    });
    initialized = true;
    return true;
  }

  function setTheme(value, savePref) {
    var next = (value === 'halloween') ? 'halloween' : 'classic';
    if (!initialized) init();
    var changed = (next !== theme);
    theme = next;
    if (savePref) {
      var prefs = readPrefs();
      prefs.theme = theme;
      writePrefs(prefs);
    }
    applyThemeToStage();
    if (changed && typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('tscms:theme-changed', {
        detail: { theme: theme }
      }));
    }
    return theme;
  }

  function getTheme() {
    if (!initialized) init();
    return theme;
  }

  function setLightning(on) {
    lightningOn = !!on;
    var prefs = readPrefs();
    prefs.lightning = lightningOn;
    writePrefs(prefs);
    if (!lightningOn) clearFlash();
    stormTick();
    return lightningOn;
  }

  function getLightning() { return lightningOn; }

  window.TSCMSHalloween = {
    init: init,
    setTheme: setTheme,
    getTheme: getTheme,
    setLightning: setLightning,
    getLightning: getLightning,
    setPaused: setPaused
  };

  // Auto-init on DOM ready so the menu wiring finds it.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
