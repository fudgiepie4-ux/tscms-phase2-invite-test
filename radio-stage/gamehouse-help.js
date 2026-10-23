/* TSCMS Gamehouse: owner-approved illustrated Help guide. No game engine changes. */
(function () {
  'use strict';
  var IMAGE = 'assets/Gamehouse_Help_Preview.png';
  function init() {
    var menu = document.getElementById('menu');
    var panel = menu && menu.querySelector('.panel');
    if (!panel || document.getElementById('gamehouse-help-open')) return;

    var style = document.createElement('style');
    style.textContent = [
      '#gamehouse-help-open{display:block;width:100%;min-height:48px;margin-top:18px;text-align:center}',
      '#gamehouse-help-overlay[hidden]{display:none!important}',
      '#gamehouse-help-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(8,5,5,.96);',
      'display:flex;align-items:center;justify-content:center;padding:10px;',
      'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#ffe9bc}',
      '.tgh-panel{width:min(100%,740px);max-height:calc(100dvh - 20px);display:flex;flex-direction:column;',
      'overflow:hidden;border:2px solid #cfa65a;background:#170d0c;border-radius:14px;box-shadow:0 12px 35px #000}',
      '.tgh-bar{flex:none;display:flex;align-items:center;gap:10px;justify-content:space-between;',
      'padding:10px 12px;background:#28160f;border-bottom:1px solid #8f6433}',
      '.tgh-bar h2{font:700 18px/1.25 system-ui,sans-serif;color:#ffe9bc;margin:0}',
      '.tgh-actions{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;align-items:center}',
      '.tgh-actions button,.tgh-actions a,.tgh-bar button{appearance:none;border:1px solid #d1a359;',
      'border-radius:8px;background:#49301a;color:#fff5d6;font:600 14px/1.25 system-ui,sans-serif;',
      'padding:10px 12px;min-height:44px;cursor:pointer;text-decoration:none}',
      '.tgh-actions button:focus-visible,.tgh-actions a:focus-visible,.tgh-bar button:focus-visible{',
      'outline:3px solid #fff;outline-offset:2px}',
      '.tgh-scroll{overflow:auto;overscroll-behavior:contain;flex:1;min-height:0;padding:8px}',
      '.tgh-scroll img{display:block;width:100%;height:auto;max-width:720px;margin:0 auto}',
      '.tgh-scroll.zoomed img{width:720px;max-width:none;margin:0}',
      '.tgh-note{color:#ead2a3;font:13px/1.4 system-ui,sans-serif;margin:0;padding:0 12px 10px}',
      '@media(max-width:380px){.tgh-bar h2{font-size:16px}.tgh-actions{gap:6px}}'
    ].join('');
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'gamehouse-help-open';
    button.className = 'p-btn';
    button.textContent = '📖 HOW TO PLAY';
    button.setAttribute('aria-haspopup', 'dialog');
    panel.appendChild(button);

    var dialog = document.createElement('div');
    dialog.id = 'gamehouse-help-overlay';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'gamehouse-help-title');
    dialog.innerHTML = [
      '<div class="tgh-panel"><div class="tgh-bar">',
      '<h2 id="gamehouse-help-title">HOW TO PLAY — SOLITAIRE</h2>',
      '<button type="button" id="gamehouse-help-close" aria-label="Close How to Play and return to Saloon Settings">✕ Close</button>',
      '</div><div class="tgh-actions">',
      '<button type="button" id="gamehouse-help-zoom" aria-pressed="false">🔎 Enlarge guide</button>',
      '<a href="' + IMAGE + '" target="_blank" rel="noopener" aria-label="Open How to Play guide full size in a new tab">↗ Open full size</a>',
      '</div><div class="tgh-scroll" id="gamehouse-help-scroll">',
      '<img src="' + IMAGE + '" alt="Illustrated TSCMS Gamehouse Solitaire guide: build foundations Ace through King by suit; move tableau cards downward in alternating colors; draw from stock; two special Jokers; optional Swiper mode; Undo, Hint, Pause, New Game and Exit." />',
      '</div><p class="tgh-note">Scroll to read all six steps. Enlarge or open full size for a closer look.</p></div>'
    ].join('');
    document.body.appendChild(dialog);

    var closeButton = document.getElementById('gamehouse-help-close');
    var zoomButton = document.getElementById('gamehouse-help-zoom');
    var scroller = document.getElementById('gamehouse-help-scroll');
    var returnFocus = button;
    function open() {
      returnFocus = document.activeElement || button;
      dialog.hidden = false;
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
      closeButton.focus();
    }
    function close() {
      dialog.hidden = true;
      scroller.classList.remove('zoomed');
      zoomButton.setAttribute('aria-pressed', 'false');
      zoomButton.textContent = '🔎 Enlarge guide';
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }
    button.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
    zoomButton.addEventListener('click', function () {
      var zoomed = scroller.classList.toggle('zoomed');
      zoomButton.setAttribute('aria-pressed', String(zoomed));
      zoomButton.textContent = zoomed ? '🔎 Fit to screen' : '🔎 Enlarge guide';
      scroller.scrollLeft = 0;
    });
    document.addEventListener('keydown', function (e) {
      if (dialog.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation(); close();
      } else if (e.key === 'Tab') {
        var focusable = Array.prototype.slice.call(dialog.querySelectorAll('button,a[href]'));
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();