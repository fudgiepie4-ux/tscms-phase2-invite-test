fetch('banner.jpg').then(r=>r.text()).then(t=>{ const b=document.getElementById('bannerImg'); b.src='data:image/jpeg;base64,'+t.replace(/\s+/g,''); b.style.display='block'; }).catch(()=>{});

/* TSCMS SONG LIST PAGES — 10 songs per page, per day. UI only; audio remains unchanged. */
(function () {
  'use strict';
  var PAGE_SIZE = 10;
  var dayStates = {};
  var selectedDay = null;

  function makeButton(label, disabled, active, description, action) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'song-page-btn' + (active ? ' is-current' : '');
    button.textContent = label;
    button.disabled = disabled;
    button.setAttribute('aria-label', description);
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', action);
    return button;
  }

  function drawControls(state, nav) {
    var count = state.songs.length;
    var pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    var current = state.page;
    nav.replaceChildren();
    var summary = document.createElement('span');
    summary.className = 'song-page-summary';
    var start = count ? (current - 1) * PAGE_SIZE + 1 : 0;
    var end = Math.min(current * PAGE_SIZE, count);
    summary.textContent = 'Showing ' + start + '–' + end + ' of ' + count + ' songs · Page ' + current + ' of ' + pages;
    nav.appendChild(summary);
    if (pages === 1) return;

    var buttons = document.createElement('div');
    buttons.className = 'song-page-controls';
    function goto(page) {
      state.page = page;
      draw(state);
      var topNav = state.panel.querySelector('.song-pager--top');
      if (topNav && typeof topNav.scrollIntoView === 'function') {
        topNav.scrollIntoView({behavior: 'auto', block: 'start'});
      }
    }
    buttons.appendChild(makeButton('‹ Prev', current === 1, false, 'Previous page of songs', function () { goto(current - 1); }));
    var first = Math.max(1, current - 2);
    var last = Math.min(pages, first + 4);
    first = Math.max(1, last - 4);
    for (var page = first; page <= last; page++) {
      (function (pageNumber) {
        buttons.appendChild(makeButton(String(pageNumber), false, pageNumber === current,
          'Song page ' + pageNumber + ' of ' + pages,
          function () { goto(pageNumber); }));
      })(page);
    }
    buttons.appendChild(makeButton('Next ›', current === pages, false, 'Next page of songs', function () { goto(current + 1); }));
    nav.appendChild(buttons);
  }

  function draw(state) {
    var first = (state.page - 1) * PAGE_SIZE;
    for (var i = 0; i < state.songs.length; i++) {
      state.songs[i].hidden = i < first || i >= first + PAGE_SIZE;
    }
    drawControls(state, state.top);
    drawControls(state, state.bottom);
  }

  function boot() {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.daypanel[id^="day-"]'));
    if (!panels.length) return;
    panels.forEach(function (panel) {
      var number = Number(panel.id.replace('day-', ''));
      if (!Number.isInteger(number)) return;
      // Enforce the song-only rule even if a future HTML generator includes a post-only row.
      var songs = Array.prototype.slice.call(panel.querySelectorAll('.song')).filter(function (song) {
        var play = song.querySelector('.btn.play[data-stream]');
        var suno = song.querySelector('a.btn.suno[href]');
        var streamURL = play ? play.getAttribute('data-stream') : '';
        var songURL = suno ? suno.getAttribute('href') : '';
        var playable = /^https:\/\/[^/\s]+\//i.test(streamURL || '') ||
          /^https:\/\/suno\.com\/(?:s\/|song\/)/i.test(songURL || '');
        if (!playable) song.remove();
        return playable;
      });
      var top = document.createElement('nav');
      top.className = 'song-pager song-pager--top';
      top.setAttribute('aria-label', 'Song list pages for day ' + (number + 1));
      var bottom = document.createElement('nav');
      bottom.className = 'song-pager song-pager--bottom';
      bottom.setAttribute('aria-label', 'Song list pages for day ' + (number + 1));
      panel.insertBefore(top, panel.firstChild);
      panel.appendChild(bottom);
      dayStates[number] = { panel: panel, songs: songs, top: top, bottom: bottom, page: 1 };
      draw(dayStates[number]);
      if (panel.classList.contains('active')) selectedDay = number;
    });
    var dayButtons = Array.prototype.slice.call(document.querySelectorAll('.tabs .tab[data-day]'));
    // Derive public numbers from song entries that actually offer a playable route.
    var weeklyCount = 0;
    Object.keys(dayStates).forEach(function (key) {
      var count = dayStates[key].songs.length;
      weeklyCount += count;
      var button = dayButtons.find(function (b) { return b.getAttribute('data-day') === key; });
      var badge = button ? button.querySelector('.t-n') : null;
      if (badge) badge.textContent = String(count);
    });
    Array.prototype.slice.call(document.querySelectorAll('.stats .stat')).forEach(function (stat) {
      var label = stat.querySelector('.l');
      var value = stat.querySelector('.v');
      if (!label || !value) return;
      var kind = label.textContent.trim().toUpperCase();
      if (kind === 'SONGS THIS WEEK') value.textContent = String(weeklyCount);
      if (kind === 'SONGS TODAY' && selectedDay !== null) {
        value.textContent = String(dayStates[selectedDay].songs.length);
      }
    });
    window.showDay = function (number) {
      number = Number(number);
      if (!Object.prototype.hasOwnProperty.call(dayStates, number)) return;
      if (selectedDay !== number) dayStates[number].page = 1;
      selectedDay = number;
      Object.keys(dayStates).forEach(function (key) {
        dayStates[key].panel.classList.toggle('active', Number(key) === number);
      });
      dayButtons.forEach(function (button) {
        var chosen = Number(button.getAttribute('data-day')) === number;
        button.classList.toggle('active', chosen);
        button.setAttribute('aria-pressed', chosen ? 'true' : 'false');
      });
      draw(dayStates[number]);
    };
    window.showDay(selectedDay === null ? Number(Object.keys(dayStates)[0]) : selectedDay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once: true});
  } else {
    boot();
  }
})();
