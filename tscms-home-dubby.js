/* TSCMS home layout, Oct 2026: compact live stats + existing Sponsor TV.
   Stored separately from generated index.html. Inert outside public homepage. */
(function () {
  'use strict';
  function initialize() {
    var wrap = document.querySelector('.wrap');
    if (!wrap || document.getElementById('tscms-home-dubby')) return;
    var header = wrap.querySelector('header');
    var stats = wrap.querySelector('.stats');
    var youtube = wrap.querySelector('.yt-banner');
    var songOfWeek = wrap.querySelector('.feat');
    if (!header || !stats || !youtube || !songOfWeek || stats.classList.contains('tscms-home-stats')) return;
    // First reserve the exact old stats slot, so songs and Song of the Week stay in place.
    var sponsor = document.createElement('section');
    sponsor.id = 'tscms-home-dubby';
    sponsor.className = 'tscms-home-dubby';
    sponsor.setAttribute('aria-labelledby', 'tscms-home-dubby-title');
    sponsor.innerHTML = '<div class="tscms-dubby-eyebrow">📺 SPONSOR TV · DUBBY</div>'+
      '<div class="tscms-dubby-inner">'+
        '<div class="tscms-dubby-screen">'+
          '<video id="tscms-home-dubby-video" controls playsinline preload="metadata" poster="public-assets/dubby-poster.jpg" aria-label="TSCMS Dubby promotional video; plays only when selected">'+
            '<source src="public-assets/dubby-promo.mp4" type="video/mp4">Your browser does not support this video.'+
          '</video><div class="tscms-dubby-screen-caption">TSCMS · SPONSOR TV</div>'+
        '</div>'+
        '<div class="tscms-dubby-copy">'+
          '<h2 id="tscms-home-dubby-title">Fuel Your Creativity</h2>'+
          '<p class="tscms-dubby-offer">Save 10% · <strong>TSCMSLIVE</strong></p>'+
          '<p>Take a quick Sponsor TV break, then get right back to your music.</p>'+
          '<a class="tscms-dubby-shop" href="https://www.dubby.gg/discount/TSCMSLIVE?ref=xdejzekt" target="_blank" rel="sponsored noopener noreferrer">🛒 Shop Dubby &amp; Save 10% ↗</a>'+
        '</div>'+
      '</div>'+
      '<div class="tscms-dubby-actions" aria-label="Sponsor TV playback controls">'+
        '<button type="button" data-dubby-action="play">▶ PLAY</button>'+
        '<button type="button" data-dubby-action="pause">⏸ PAUSE</button>'+
        '<button type="button" data-dubby-action="stop">⏹ STOP</button>'+
      '</div>'+
      '<p class="tscms-dubby-status" role="status" aria-live="polite">Press Play to watch · your music pauses during the video.</p>'+
      '<p class="tscms-dubby-disclosure">Affiliate partner · TSCMS may earn from qualifying purchases.</p>';
    stats.parentNode.insertBefore(sponsor, stats);
    stats.classList.add('tscms-home-stats');
    youtube.parentNode.insertBefore(stats, youtube);
    var video = sponsor.querySelector('video');
    var status = sponsor.querySelector('.tscms-dubby-status');
    var buttons = sponsor.querySelectorAll('[data-dubby-action]');
    function announce(message) { status.textContent = message; }
    function pauseOtherMedia() {
      document.querySelectorAll('audio, video').forEach(function (media) {
        if (media !== video && !media.paused && typeof media.pause === 'function') {
          try { media.pause(); } catch (e) { /* Independent player cannot be paused. */ }
        }
      });
    }
    function updateControls() {
      buttons.forEach(function (button) {
        var action = button.getAttribute('data-dubby-action');
        button.setAttribute('aria-pressed', String(action === 'play' && !video.paused && !video.ended));
      });
    }
    sponsor.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-dubby-action]');
      if (!button) return;
      var action = button.getAttribute('data-dubby-action');
      if (action === 'play') {
        pauseOtherMedia();
        var promise = video.play();
        if (promise && promise.catch) promise.catch(function () { announce('Video could not start; please try again.'); });
      } else if (action === 'pause') {
        video.pause();
      } else if (action === 'stop') {
        video.pause();
        try { video.currentTime = 0; } catch (e) {}
        announce('Sponsor TV stopped · choose Play to watch again.');
      }
      updateControls();
    });
    video.addEventListener('play', function () {
      pauseOtherMedia();
      announce('Sponsor TV playing · other music paused.');
      updateControls();
    });
    video.addEventListener('pause', function () {
      if (!video.ended) announce('Sponsor TV paused · resume your music whenever you like.');
      updateControls();
    });
    video.addEventListener('ended', function () {
      announce('Sponsor TV finished · thanks for watching!');
      updateControls();
    });
    video.addEventListener('error', function () { announce('Promotional video temporarily unavailable.'); });
    updateControls();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})();
