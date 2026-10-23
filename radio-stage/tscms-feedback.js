/* ============================================================
   TSCMS Feedback Button — reusable snippet (v1)
   Cherish, 2026-10-18 — for Clara to drop onto any page.

   USAGE: include this file with <script src="tscms-feedback.js"></script>
   before </body>. It injects its own button + modal; no other markup
   or CSS needed. Configure via TSCMSFeedback.init({...}) or defaults.

   DEFAULTS:
     - Button: fixed bottom-right, high-contrast (black on gold),
       label "Feedback", same spot on every page.
     - Modal: issue (required), name (optional), contact email
       (optional), "contact me" checkbox (optional).
     - Submit: opens a mailto: to the feedback address with a
       prefilled subject + body built from the form.
     - Contact info line for screenshots/video via direct email.

   No backend, no attachments, no tracking. Pure client-side.
   ============================================================ */
(function () {
  'use strict';

  var DEFAULTS = {
    // Where feedback goes. Fudgie: fudgiepie4@gmail.com.
    email: 'fudgiepie4@gmail.com',
    subject: 'TSCMS Feedback',
    // Button placement: 'bottom-right' | 'bottom-left'
    position: 'bottom-right',
    buttonLabel: 'Feedback',
  };

  var cfg = {};

  var CSS = [
    '#tscms-fb-btn{position:fixed;z-index:99990;bottom:18px;right:18px;',
    'background:#111;color:#ffd75e;border:2px solid #ffd75e;border-radius:999px;',
    'font:700 16px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
    'padding:12px 20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.45);}',
    '#tscms-fb-btn.bl{right:auto;left:18px;}',
    '#tscms-fb-btn:hover,#tscms-fb-btn:focus-visible{background:#ffd75e;color:#111;outline:3px solid #fff;outline-offset:2px;}',
    '#tscms-fb-ov{position:fixed;inset:0;z-index:99991;background:rgba(0,0,0,.65);',
    'display:flex;align-items:center;justify-content:center;padding:16px;}',
    '#tscms-fb-ov[hidden]{display:none;}',
    '#tscms-fb-modal{background:#fdf8ec;color:#1a1a1a;border:3px solid #111;',
    'border-radius:12px;max-width:440px;width:100%;max-height:90vh;overflow:auto;',
    'padding:20px 20px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);}',
    '#tscms-fb-modal h2{margin:0 0 4px;font:700 20px/1.2 system-ui,sans-serif;color:#111;}',
    '#tscms-fb-modal p.sub{margin:0 0 14px;font:400 14px/1.4 system-ui,sans-serif;color:#444;}',
    '#tscms-fb-modal label{display:block;font:700 14px/1.3 system-ui,sans-serif;margin:12px 0 4px;color:#111;}',
    '#tscms-fb-modal label .opt{font-weight:400;color:#666;}',
    '#tscms-fb-modal input[type=text],#tscms-fb-modal input[type=email],',
    '#tscms-fb-modal textarea{width:100%;box-sizing:border-box;font:400 15px/1.4 system-ui,sans-serif;',
    'padding:9px 10px;border:2px solid #555;border-radius:8px;background:#fff;color:#111;}',
    '#tscms-fb-modal textarea{min-height:96px;resize:vertical;}',
    '#tscms-fb-modal input:focus,#tscms-fb-modal textarea:focus{outline:3px solid #0b5fff;outline-offset:1px;border-color:#0b5fff;}',
    '#tscms-fb-check{display:flex;gap:10px;align-items:flex-start;margin:14px 0 4px;',
    'font:400 14px/1.4 system-ui,sans-serif;color:#111;}',
    '#tscms-fb-check input{width:22px;height:22px;margin:0;flex:none;accent-color:#0b5fff;}',
    '#tscms-fb-contact{margin:14px 0 0;padding:10px 12px;background:#fff8e1;border:2px dashed #a8842c;',
    'border-radius:8px;font:400 13px/1.5 system-ui,sans-serif;color:#333;}',
    '#tscms-fb-contact b{color:#111;}',
    '#tscms-fb-err{display:none;margin:10px 0 0;padding:8px 10px;background:#fde8e8;border:2px solid #b00020;',
    'border-radius:8px;color:#7a0016;font:700 13px/1.4 system-ui,sans-serif;}',
    '#tscms-fb-send-helper{font:400 14px/1.45 system-ui,sans-serif;color:#252525;margin:12px 0 5px;}', 
    '#tscms-fb-send-fallback{font:400 12.5px/1.5 system-ui,sans-serif;color:#444;margin:2px 0 6px;}',
    '#tscms-fb-send-fallback a{color:#124bad;text-decoration:underline;overflow-wrap:anywhere;}',
    '#tscms-fb-row{display:flex;gap:10px;margin-top:12px;}',
    '#tscms-fb-send{flex:1;background:#111;color:#ffd75e;border:2px solid #111;border-radius:8px;',
    'font:700 16px/1 system-ui,sans-serif;padding:12px;cursor:pointer;}',
    '#tscms-fb-send:hover,#tscms-fb-send:focus-visible{background:#ffd75e;color:#111;outline:3px solid #0b5fff;}',
    '#tscms-fb-cancel{background:#fff;color:#111;border:2px solid #555;border-radius:8px;',
    'font:700 15px/1 system-ui,sans-serif;padding:12px 16px;cursor:pointer;}',
    '#tscms-fb-cancel:hover,#tscms-fb-cancel:focus-visible{outline:3px solid #0b5fff;}'
  ].join('\n');

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function openModal() {
    var ov = document.getElementById('tscms-fb-ov');
    ov.hidden = false;
    var ta = document.getElementById('tscms-fb-issue');
    if (ta) ta.focus();
    document.addEventListener('keydown', escClose);
  }
  function closeModal() {
    document.getElementById('tscms-fb-ov').hidden = true;
    document.removeEventListener('keydown', escClose);
    document.getElementById('tscms-fb-btn').focus();
  }
  function escClose(e) {
    if (e.key === 'Escape') closeModal();
  }

  function send() {
    var issue = document.getElementById('tscms-fb-issue').value.trim();
    var name = document.getElementById('tscms-fb-name').value.trim();
    var contact = document.getElementById('tscms-fb-email').value.trim();
    var okContact = document.getElementById('tscms-fb-ok').checked;
    var err = document.getElementById('tscms-fb-err');

    if (!issue) {
      err.textContent = 'Please describe the issue — that\u2019s the one thing we need.';
      err.style.display = 'block';
      document.getElementById('tscms-fb-issue').focus();
      return;
    }
    err.style.display = 'none';

    var page = location.href;
    var lines = [
      'Page: ' + page,
      '',
      'Issue:',
      issue,
      '',
      'Name: ' + (name || '(not given)'),
      'Contact email: ' + (contact || '(not given)'),
      'May we contact you about this? ' + (okContact ? 'YES' : 'No')
    ];
    var href = 'mailto:' + encodeURIComponent(cfg.email) +
      '?subject=' + encodeURIComponent(cfg.subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
    location.href = href;
    closeModal();
  }

  function build() {
    if (document.getElementById('tscms-fb-btn')) return; // already installed

    var st = el('style', null, CSS);
    document.head.appendChild(st);

    var btn = el('button', {
      id: 'tscms-fb-btn',
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-label': 'Leave feedback'
    }, cfg.buttonLabel);
    if (cfg.position === 'bottom-left') btn.classList.add('bl');
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);

    var ov = el('div', { id: 'tscms-fb-ov', hidden: '' });
    ov.setAttribute('role', 'presentation');
    var modal = el('div', {
      id: 'tscms-fb-modal', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'tscms-fb-title'
    });

    modal.appendChild(el('h2', { id: 'tscms-fb-title' }, 'Send Feedback'));
    modal.appendChild(el('p', { 'class': 'sub' },
      'Tell us what\u2019s wrong or what you\u2019d like to see. Only the issue description is required.'));

    modal.appendChild(el('label', { 'for': 'tscms-fb-issue' }, 'What\u2019s the issue? *'));
    modal.appendChild(el('textarea', {
      id: 'tscms-fb-issue', placeholder: 'Describe the problem or suggestion\u2026'
    }));

    var lname = el('label', { 'for': 'tscms-fb-name' });
    lname.appendChild(document.createTextNode('Your name '));
    lname.appendChild(el('span', { 'class': 'opt' }, '(optional)'));
    modal.appendChild(lname);
    modal.appendChild(el('input', { id: 'tscms-fb-name', type: 'text', autocomplete: 'name' }));

    var lemail = el('label', { 'for': 'tscms-fb-email' });
    lemail.appendChild(document.createTextNode('Email to reach you '));
    lemail.appendChild(el('span', { 'class': 'opt' }, '(optional)'));
    modal.appendChild(lemail);
    modal.appendChild(el('input', { id: 'tscms-fb-email', type: 'email', autocomplete: 'email' }));

    var check = el('label', { 'class': 'tscms-fb-check', id: 'tscms-fb-check', 'for': 'tscms-fb-ok' });
    var cb = el('input', { id: 'tscms-fb-ok', type: 'checkbox' });
    check.appendChild(cb);
    check.appendChild(el('span', null,
      'It\u2019s okay to contact me about this for follow-up questions.'));
    // label wrapping: move input before text properly
    modal.appendChild(check);

    var contact = el('div', { id: 'tscms-fb-contact' });
    contact.appendChild(el('b', null, 'Have a screenshot or video? '));
    contact.appendChild(document.createTextNode('Just email it directly to '));
    var mailto = el('a', { href: 'mailto:' + cfg.email }, cfg.email);
    contact.appendChild(mailto);
    contact.appendChild(document.createTextNode(' — no need to attach anything here.'));
    modal.appendChild(contact);

    modal.appendChild(el('div', { id: 'tscms-fb-err', role: 'alert' }));
    var helper = el('p', { id: 'tscms-fb-send-helper', 'class': 'tscms-fb-send-helper' });
    helper.appendChild(document.createTextNode('This opens your email app — tap '));
    helper.appendChild(el('strong', null, 'Send'));
    helper.appendChild(document.createTextNode(' to finish. Nothing reaches us until you tap Send.'));
    modal.appendChild(helper);
    var fallback = el('p', { id: 'tscms-fb-send-fallback', 'class': 'tscms-fb-send-fallback' });
    fallback.appendChild(document.createTextNode('No email app set up? Write to us at '));
    fallback.appendChild(el('a', { href: 'mailto:fudgiepie4@gmail.com' }, 'fudgiepie4@gmail.com'));
    fallback.appendChild(document.createTextNode(' — tell us what you found, and what page you were on.'));
    modal.appendChild(fallback);

    var row = el('div', { id: 'tscms-fb-row' });
    var sendBtn = el('button', { id: 'tscms-fb-send', type: 'button' }, 'Send via Email');
    sendBtn.addEventListener('click', send);
    var cancelBtn = el('button', { id: 'tscms-fb-cancel', type: 'button' }, 'Cancel');
    cancelBtn.addEventListener('click', closeModal);
    row.appendChild(sendBtn);
    row.appendChild(cancelBtn);
    modal.appendChild(row);

    // Clicking the dimmed backdrop closes (but not clicks inside the modal)
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    ov.appendChild(modal);
    document.body.appendChild(ov);
  }

  window.TSCMSFeedback = {
    init: function (options) {
      cfg = {};
      for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
      if (options) for (var j in options) cfg[j] = options[j];
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
      } else {
        build();
      }
    },
    _config: function () { return cfg; } // test hook
  };

  // Auto-init with defaults if no explicit init call by end of load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!document.getElementById('tscms-fb-btn')) {
        window.TSCMSFeedback.init();
      }
    });
  } else {
    window.TSCMSFeedback.init();
  }
})();
