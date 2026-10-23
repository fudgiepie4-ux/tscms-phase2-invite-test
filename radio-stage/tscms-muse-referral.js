/* TSCMS Muse referral card — independently preserved public feature.
   NEVER paste this implementation into generated index.html / tscms-today.html.
   The permanent public runtime loads this file and its matching CSS. */
(function () {
  'use strict';
  var CODE = '1BZI4O'; // 1 B Z I 4 O — fourth is I, last is letter O.
  var ID = 'tscms-muse-referral';
  var CSS_URL = './tscms-muse-referral.css?v=20261021-2';
  function start() {
    if (/\/(?:admin|gamehouse|solitaire)[^/]*\.html$/i.test(location.pathname)) return;
    var footer = document.querySelector('.wrap > footer.mono');
    if (!footer || footer.textContent.indexOf('MADE WITH LOVE FOR THE TSCMS FAMILY') === -1) return;
    if (document.getElementById(ID) || document.getElementById('tscms-muse-referral-css')) return;
    var stylesheet = document.createElement('link');
    stylesheet.id = 'tscms-muse-referral-css';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = CSS_URL;
    stylesheet.addEventListener('load', function () {
      if (document.getElementById(ID) || !footer.isConnected) return;
      var section = document.createElement('section');
      section.id = ID;
      section.className = 'tscms-muse-referral';
      section.setAttribute('aria-labelledby', 'tscms-muse-title');
      section.innerHTML = [
        '<div class=\"tscms-muse-referral-inner\">',
        '<p class=\"tscms-muse-eyebrow\">★ A LITTLE WAY TO HELP ★</p>',
        '<h2 id=\"tscms-muse-title\">❤️ Help Keep the Creativity Going!</h2>',
        '<p class=\"tscms-muse-lead\">This site&#39;s a labor of love, made with a little help from my AI friends, Muse and ChatGPT. Here&#39;s a <strong>FREE way</strong> to help: join Muse with my code — we both get <strong>1 BILLION Muse tokens!</strong> 🎉</p>',
        '<div class=\"tscms-muse-code-card\">',
        '<span class=\"tscms-muse-code-label\">REFERRAL CODE</span>',
        '<code id=\"tscms-muse-code\" aria-label=\"Referral code 1 B Z I 4 O\">1BZI4O</code>',
        '<span class=\"tscms-muse-code-help\">1 · B · Z · I · 4 · O &nbsp; (letter I, letter O)</span>',
        '<button class=\"tscms-muse-copy\" type=\"button\" aria-label=\"Copy Muse referral code 1 B Z I 4 O\">📋 Copy Code</button>',
        '<span class=\"tscms-muse-copy-status\" role=\"status\" aria-live=\"polite\"></span>',
        '</div>',
        '<p class=\"tscms-muse-foot\">Redeem it in <strong>Settings within 48 hours of joining</strong>. Thank you for keeping the creativity alive! — <em>Fudgie Pie</em></p>',
        '</div>'
      ].join('');
      footer.insertAdjacentElement('beforebegin', section);
      var button = section.querySelector('.tscms-muse-copy');
      var status = section.querySelector('.tscms-muse-copy-status');
      button.addEventListener('click', function () {
        function success() {
          status.textContent = '✓ Referral code copied!';
          button.textContent = '✓ Copied!';
        }
        function backup() {
          var field = document.createElement('textarea');
          field.value = CODE;
          field.setAttribute('readonly', '');
          field.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
          document.body.appendChild(field);
          field.select();
          var copied = false;
          try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
          field.remove();
          if (copied) success();
          else {
            status.textContent = 'Press and hold the code above to copy it.';
            button.textContent = '📋 Copy Code';
          }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(CODE).then(success, backup);
        } else backup();
      });
    }, { once: true });
    stylesheet.addEventListener('error', function () {
      console.warn('TSCMS Muse referral stylesheet missing; hiding the card rather than showing broken/unformatted HTML.');
    }, { once: true });
    document.head.appendChild(stylesheet);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
