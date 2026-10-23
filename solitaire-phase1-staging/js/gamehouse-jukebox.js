/* TSCMS Gamehouse jukebox — v2.1 module API (DEV ONLY, not staged).
 * v2.1 fixes two integration-contract holes found by Clara's independent
 * review of the v2 ZIP (2026-10-18 01:24 CT):
 *   (1) playlist map dropped artist/suno — V7's artist plate and View Song
 *       link couldn't bind. Now preserved with safe URL validation.
 *   (2) seekability guard only checked finite duration — native
 *       audio.seekable TimeRanges can be empty even with known duration.
 *       Now requires an actual seekable range; seekTo clamps into ranges.
 * Base: v2 = Clara's staging gamehouse-jukebox.js behaviors (single detached
 * <audio>, canonical radio-data.json, no arbitrator, stale-play guard,
 * stream-failure skip, legacy `tscms:jukebox` contract intact) + v2 API:
 * next()/prev() wrap-around, setVolume()/getVolume() clamped native,
 * seekTo() guarded, getPosition(), on('trackchange'|'timeupdate').
 * Track changes fire a dedicated `tscms:jukebox:trackchange` event
 * (detail {track,index}) — the legacy channel is untouched. */
(function () {
  'use strict';
  var audio = null, tracks = [], masterTracks = [], index = 0, ready = false, initPromise = null;
  var requestedPlaying = false, playGeneration = 0, streamFailures = 0;
  // Pilot only: selected favorites reuse the ONE radio audio element.
  // The official station playlist stays in masterTracks, never overwritten.
  var favoritesMode = false, stationTrackBeforeFavorites = null;
  // EQ PROTECTION: never put an ordinary no-CORS Suno player through WebAudio.
  var eqRequested = false, eqContext = null, eqAnalyser = null, eqData = null;
  var eqAttachedAudio = null, eqApproved = Object.create(null), eqProbes = Object.create(null);
  var eqLastReason = 'UNVERIFIED';
  // Shuffle is ON by default, and a returning listener can switch it off.
  // Start-track history is local to this browser; no tracking or server calls.
  var SHUFFLE_PREF = 'tscms-gamehouse-radio-shuffle-v1';
  var LAST_START = 'tscms-gamehouse-radio-last-start-v1';
  function stored(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function saveSetting(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }
  var shuffleEnabled = stored(SHUFFLE_PREF) !== 'off';
  function shuffledCopy(list, avoidFirstStream) {
    var copy = list.slice();
    // Fisher-Yates shuffles the entire upcoming play order, not just the first song.
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    if (copy.length > 1 && avoidFirstStream && copy[0].stream === avoidFirstStream) {
      var alternatives = [];
      for (var k = 1; k < copy.length; k++)
        if (copy[k].stream !== avoidFirstStream) alternatives.push(k);
      if (alternatives.length) {
        var swap = alternatives[Math.floor(Math.random() * alternatives.length)];
        var first = copy[0]; copy[0] = copy[swap]; copy[swap] = first;
      }
    }
    return copy;
  }

  function sourceKey(url) { return typeof url === 'string' ? url : ''; }
  // Read-only, tiny range probe. NO changes to the live media element.
  function verifyStreamCORS(url) {
    var key = sourceKey(url);
    if (!/^https:\/\//i.test(key) || !/(^|\.)suno\.ai$/i.test((function () { try { return new URL(key).hostname; } catch(e) { return ''; } })())) return Promise.resolve(false);
    if (eqApproved[key] === true) return Promise.resolve(true);
    if (eqProbes[key]) return eqProbes[key];
    if (typeof AbortController !== 'function') return Promise.resolve(false);
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 2500);
    eqProbes[key] = fetch(key, {
      mode:'cors', headers:{Range:'bytes=0-1'}, signal:controller.signal, cache:'no-store', credentials:'omit'
    }).then(function (response) {
      if (!response || !response.ok || response.type === 'opaque') return false;
      // Do not download the song; a successful CORS read of the first bytes is enough.
      if (response.body && typeof response.body.cancel === 'function') {
        try { response.body.cancel().catch(function(){}); } catch(e) {}
      }
      eqApproved[key] = true; return true;
    }).catch(function(){return false;}).then(function(ok){
      clearTimeout(timeout); delete eqProbes[key]; return ok;
    });
    return eqProbes[key];
  }
  function closeGraph() {
    eqAnalyser=null;eqData=null;eqAttachedAudio=null;
    if(eqContext){ try {eqContext.close().catch(function(){});}catch(e){} eqContext=null; }
  }
  function createPlayer(allowCors) {
    var old=audio, previousVolume=old?old.volume:1;
    if(old){try{old.pause();}catch(e){} }
    closeGraph();
    audio=document.createElement('audio');
    audio.preload='none';
    if(allowCors) audio.crossOrigin='anonymous';
    try{audio.volume=previousVolume;}catch(e){}
    wireMedia(audio);
  }
  function wireMedia(player) {
    player.addEventListener('ended', function () {
      if(player!==audio || !requestedPlaying || !tracks.length)return;
      loadTrack(index+1); fireTrackChange(); requestPlay();
    });
    player.addEventListener('timeupdate', function () {
      if(player!==audio)return;
      if(audio.currentTime>1)streamFailures=0;
      if(canDispatch())document.dispatchEvent(new CustomEvent(EVT_TIMEUPDATE, {
        detail:{currentTime:audio.currentTime,duration:audio.duration}
      }));
    });
    player.addEventListener('error', function () {
      if(player!==audio || !requestedPlaying || !tracks.length)return;
      // CORS might have failed after preflight. Restore normal playback of SAME track.
      if(player.crossOrigin==='anonymous'){
        eqApproved[sourceKey(tracks[index].stream)]=false;
        eqLastReason='STREAM CORS FAILED — NATIVE RADIO RESTORED';
        createPlayer(false);audio.src=tracks[index].stream;requestPlay();return;
      }
      streamFailures++;
      if(streamFailures>=tracks.length){++playGeneration;requestedPlaying=false;announce('unavailable','Radio streams are temporarily unavailable.');return;}
      loadTrack(index+1);fireTrackChange();requestPlay();
    });
  }
  function ensureGraph() {
    if(!eqRequested || !audio || audio.crossOrigin!=='anonymous' || !eqApproved[sourceKey(tracks[index] && tracks[index].stream)])return false;
    if(eqAttachedAudio===audio && eqAnalyser) {
      if(eqContext && eqContext.state==='suspended')Promise.resolve(eqContext.resume()).catch(function(){});
      return true;
    }
    if(!(window.AudioContext||window.webkitAudioContext)){eqLastReason='WEB AUDIO NOT SUPPORTED';return false;}
    try {
      eqContext=new (window.AudioContext||window.webkitAudioContext)();
      eqAnalyser=eqContext.createAnalyser(); eqAnalyser.fftSize=2048;
      eqAnalyser.smoothingTimeConstant=.72; eqAnalyser.minDecibels=-96; eqAnalyser.maxDecibels=-18;
      var source=eqContext.createMediaElementSource(audio);
      source.connect(eqAnalyser);eqAnalyser.connect(eqContext.destination);
      eqData=new Uint8Array(eqAnalyser.frequencyBinCount);
      eqAttachedAudio=audio;eqLastReason='REAL AUDIO FFT';
      if(eqContext.state==='suspended')Promise.resolve(eqContext.resume()).catch(function(){});
      return true;
    }catch(e){
      eqLastReason='WEB AUDIO ERROR — NATIVE RADIO RESTORED';
      createPlayer(false);audio.src=tracks[index].stream;return false;
    }
  }


  var EVT_TRACKCHANGE = 'tscms:jukebox:trackchange';
  var EVT_TIMEUPDATE = 'tscms:jukebox:timeupdate';

  function canDispatch() {
    return typeof document !== 'undefined' &&
      typeof document.dispatchEvent === 'function' &&
      typeof CustomEvent === 'function';
  }

  // v2.1: safe http(s) URL check for the suno link field.
  function safeUrl(u) {
    return (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : '';
  }

  // v2.1: native seekable TimeRanges as [[start,end],...]; [] when unknown.
  // Seekability is UNVERIFIED unless an actual range exists (Clara's probe:
  // duration can be finite while seekable.length is 0).
  function seekableRanges() {
    var out = [];
    try {
      var r = audio && audio.seekable;
      if (r && r.length) {
        for (var i = 0; i < r.length; i++) out.push([r.start(i), r.end(i)]);
      }
    } catch (e) { /* treat as unseekable */ }
    return out;
  }

  function announce(state, message) {
    if (canDispatch()) {
      document.dispatchEvent(new CustomEvent('tscms:jukebox', {
        detail: { state: state, message: message || '', track: tracks[index] || null }
      }));
    }
  }

  // Dedicated track-change channel (v2). Does NOT reuse the legacy
  // 'tscms:jukebox' event, so the existing tap-target UI keeps its behavior.
  function fireTrackChange() {
    if (!canDispatch()) return;
    document.dispatchEvent(new CustomEvent(EVT_TRACKCHANGE, {
      detail: { track: tracks[index] || null, index: index }
    }));
  }

  function loadTrack(i) {
    if (!tracks.length) return;
    index = ((i % tracks.length) + tracks.length) % tracks.length;
    var allowCors=eqRequested && eqApproved[sourceKey(tracks[index].stream)]===true;
    if(!audio || Boolean(audio.crossOrigin)==Boolean(allowCors)) {
      // Reuse normal player unless switching protected stream modes.
    } else createPlayer(allowCors);
    audio.src=tracks[index].stream;
    // Warm the next track permission in the background; never touch audible music.
    if(eqRequested && tracks.length>1)verifyStreamCORS(tracks[(index+1)%tracks.length].stream);
  }

  function requestPlay() {
    if (!ready) return false;
    requestedPlaying = true;
    var generation = ++playGeneration;
    // CORS is confirmed BEFORE routing WebAudio. False -> native audio untouched.
    ensureGraph();
    try {
      // CRITICAL: execute play() synchronously inside the tap handler for Android.
      var attempt = audio.play();
      announce('starting');
      Promise.resolve(attempt).then(function () {
        if (generation === playGeneration && requestedPlaying) {
          announce('playing');
        }
      }, function () {
        if (generation === playGeneration && requestedPlaying) {
          requestedPlaying = false;
          if(audio && audio.crossOrigin==='anonymous') {
            eqApproved[sourceKey(tracks[index].stream)]=false;
            createPlayer(false);audio.src=tracks[index].stream;
            eqLastReason='STREAM CORS REFUSED — NATIVE RADIO READY';
          }
          announce('blocked', 'Sound could not start. Tap Play to try native radio.');
        }
      });
    } catch (e) {
      if (generation === playGeneration) {
        requestedPlaying = false;
        announce('blocked', 'Sound could not start. Tap the jukebox to try again.');
      }
      return false;
    }
    return true;
  }

  var TSCMSJukebox = {
    // Fetch ahead of time on page load. Promise<boolean>. No autoplay.
    init: function (opts) {
      opts = opts || {};
      if (ready) return Promise.resolve(true);
      if (initPromise) return initPromise;
      eqRequested = opts.enableEq === true;
      if (!audio) createPlayer(false);
      var url = opts.playlistUrl || 'radio-data.json';
      announce('loading');
      initPromise = fetch(url, { cache: 'no-store' })
        .then(function (response) {
          if (!response || response.ok === false) throw new Error('Radio playlist unavailable');
          return response.json();
        })
        .then(function (data) {
          var list = Array.isArray(data && data.playlist) ? data.playlist : [];
          masterTracks = list.filter(function (item) {
            return item && typeof item.stream === 'string' && /^https?:\/\//i.test(item.stream);
          }).map(function (item) {
            // v2.1: preserve artist + suno for the V7 artist plate and
            // View Song link (safe URL validation here; UI validates again
            // at final link binding).
            return {
              title: item.title || 'TSCMS Radio',
              artist: item.artist || '',
              stream: item.stream,
              suno: safeUrl(item.suno)
            };
          });
          tracks = shuffleEnabled ? shuffledCopy(masterTracks, stored(LAST_START)) : masterTracks.slice();
          index = 0;
          ready = tracks.length > 0;
          if (ready && shuffleEnabled) saveSetting(LAST_START, tracks[0].stream);
          if(!ready){announce('unavailable', 'No playable TSCMS Radio tracks are available.');return false;}
          // Optional first-track probe is bounded; if it fails native radio plays as before.
          var permit=eqRequested?verifyStreamCORS(tracks[0].stream):Promise.resolve(false);
          return Promise.resolve(permit).then(function(ok){
            eqLastReason=ok?'CORS STREAM VERIFIED — FFT READY':'STREAM CORS RESTRICTED — NATIVE RADIO';
            loadTrack(0);fireTrackChange();announce('ready');return true;
          });
        })
        .catch(function () {
          ready = false;
          announce('unavailable', 'TSCMS Radio could not load. Please try again.');
          return false;
        })
        .then(function (loaded) {
          if (!loaded) initPromise = null; // allow a later retry
          return loaded;
        });
      return initPromise;
    },

    // Synchronous tap toggle; the return value is the requested playing state.
    toggle: function () {
      if (!ready || !audio) {
        announce('not-ready', 'Radio is loading. Please tap again in a moment.');
        return false;
      }
      if (requestedPlaying) {
        requestedPlaying = false;
        ++playGeneration; // ignore stale play() responses
        audio.pause();
        announce('paused');
        return false;
      }
      streamFailures = 0;
      return requestPlay();
    },
    isPlaying: function () { return !!(audio && ready && requestedPlaying && !audio.paused); },
    currentTrack: function () { return tracks.length ? tracks[index] : null; },
    isFavoritesMode: function () { return favoritesMode; },
    // NO new <audio>, no automatic activation. Caller must be an approved,
    // authenticated team user and act on a deliberate button click.
    setFavoritesPlaylist: function (list, opts) {
      opts = opts || {};
      if (!ready || !Array.isArray(list) || !list.length || list.length > 500) return false;
      var favorites = [];
      for(var k=0;k<list.length;k++){
        var item=list[k];
        if(!item || typeof item.title!=='string'||!item.title.trim()||
           typeof item.artist!=='string'||!item.artist.trim()||
           typeof item.stream!=='string'||!/^https:\/\/[a-z0-9.-]+\/\S+$/i.test(item.stream))return false;
        favorites.push({title:item.title,artist:item.artist,stream:item.stream,suno:''});
      }
      var current = tracks[index];
      if (!favoritesMode) stationTrackBeforeFavorites=current?.stream||null;
      favoritesMode=true;
      var keep=favorites.findIndex(function(t){return current && t.stream===current.stream;});
      // Server snapshot added/removed a different song: no reset of an audible
      // favorite that is still in the list.
      if(keep>=0 && opts.preserve===true){tracks=favorites;index=keep;fireTrackChange();return true;}
      requestedPlaying=false;++playGeneration;
      if(audio)try{audio.pause();}catch(e){}
      tracks=favorites;index=0;loadTrack(0);fireTrackChange();announce('favorites','Your saved playlist is ready');
      // Start ONLY from an actual user tap (explicit opts.play true).
      if(opts.play===true)return requestPlay();
      return true;
    },
    restoreStationPlaylist: function (opts) {
      opts=opts||{};
      if(!favoritesMode)return false;
      favoritesMode=false;
      requestedPlaying=false;++playGeneration;
      if(audio)try{audio.pause();}catch(e){}
      tracks=shuffleEnabled?shuffledCopy(masterTracks):masterTracks.slice();
      index=Math.max(0,tracks.findIndex(function(t){return t.stream===stationTrackBeforeFavorites;}));
      stationTrackBeforeFavorites=null;
      if(!tracks.length)return false;
      loadTrack(index);fireTrackChange();announce('ready','TSCMS Radio restored');
      if(opts.play===true)return requestPlay();
      return true;
    },
    isShuffleEnabled: function () { return shuffleEnabled; },
    // Change the play order without stopping or restarting the current song.
    // Turning Shuffle ON preserves the song currently playing, while randomizing
    // what comes next. OFF restores the original official playlist order.
    setShuffle: function (enabled) {
      shuffleEnabled = !!enabled;
      saveSetting(SHUFFLE_PREF, shuffleEnabled ? 'on' : 'off');
      if (favoritesMode) {
        announce('shuffle', 'Station shuffle preference saved for later');
        return shuffleEnabled; // Do not replace someone's private queue with the station.
      }
      if (ready && masterTracks.length) {
        var current = tracks[index];
        if (shuffleEnabled) {
          var remaining = shuffledCopy(masterTracks.filter(function(t){ return t !== current; }));
          tracks = [current].concat(remaining);
          index = 0;
        } else {
          tracks = masterTracks.slice();
          index = Math.max(0, tracks.indexOf(current));
        }
        fireTrackChange();
      }
      announce('shuffle', shuffleEnabled ? 'Shuffle on' : 'Shuffle off');
      return shuffleEnabled;
    },

    // v2: step the playlist with wrap-around. If music is playing, the new
    // track starts playing; if paused, it just loads. Fires trackchange.
    // Returns false when not ready.
    next: function () { return stepTrack(1); },
    prev: function () { return stepTrack(-1); },

    // v2: native volume only (no GainNode — see audio guidance). Clamped
    // 0..1. Returns the applied volume, or false when no audio element yet.
    // Game pause/Undo/Hint/New Game never call this — volume is the
    // jukebox's own state.
    setVolume: function (v) {
      if (!audio) return false;
      v = Number(v);
      if (!isFinite(v)) return false;
      v = Math.min(1, Math.max(0, v));
      try { audio.volume = v; } catch (e) { return false; }
      return v;
    },
    getVolume: function () { return audio ? audio.volume : 1; },
    // Returns only actual frequency samples from verified-CORS playing audio.
    // NEVER returns synthesized/fake-reactive values.
    getSpectrumFrame: function () {
      if(!eqAnalyser || !eqData || !eqAttachedAudio || eqAttachedAudio!==audio || !audio || audio.paused)return null;
      try {eqAnalyser.getByteFrequencyData(eqData);return {bins:eqData,sampleRate:eqContext.sampleRate};}
      catch(e){return null;}
    },
    getSpectrumStatus: function () {
      return {active:!!(eqAnalyser && eqAttachedAudio===audio),reason:eqLastReason};
    },

    // v2.1: guarded seek. Returns false unless an actual seekable TimeRange
    // exists — finite duration alone is NOT enough (Clara's probe). Clamps
    // the target into the nearest valid range. Never throws; never disturbs
    // playback state. UI stays display-only until the S24 real-stream proof.
    seekTo: function (sec) {
      if (!ready || !audio) return false;
      sec = Number(sec);
      if (!isFinite(sec) || sec < 0) return false;
      var ranges = seekableRanges();
      if (!ranges.length) return false;
      var t = sec, i, r, inside = false;
      for (i = 0; i < ranges.length; i++) {
        r = ranges[i];
        if (sec >= r[0] && sec <= r[1]) { inside = true; t = sec; break; }
      }
      if (!inside) {
        var best = ranges[0][0], bestDist = Math.abs(sec - ranges[0][0]);
        for (i = 0; i < ranges.length; i++) {
          r = ranges[i];
          var d0 = Math.abs(sec - r[0]), d1 = Math.abs(sec - r[1]);
          if (d0 < bestDist) { bestDist = d0; best = r[0]; }
          if (d1 < bestDist) { bestDist = d1; best = r[1]; }
        }
        t = best;
      }
      try { audio.currentTime = t; } catch (e) { return false; }
      return true;
    },
    getPosition: function () {
      if (!audio) return { currentTime: 0, duration: NaN, seekable: false, ranges: [] };
      var dur = audio.duration;
      var ranges = seekableRanges();
      return {
        currentTime: audio.currentTime || 0,
        duration: dur,
        seekable: ranges.length > 0,
        ranges: ranges
      };
    },

    // v2: subscribe to 'trackchange' ({ track, index }) or 'timeupdate'
    // ({ currentTime, duration }). Returns an unsubscribe function.
    on: function (name, cb) {
      var noop = function () {};
      var ev = name === 'trackchange' ? EVT_TRACKCHANGE
        : name === 'timeupdate' ? EVT_TIMEUPDATE : null;
      if (!ev || typeof cb !== 'function') return noop;
      if (typeof document === 'undefined' ||
          typeof document.addEventListener !== 'function') return noop;
      var wrap = function (e) { cb((e && e.detail) || {}); };
      document.addEventListener(ev, wrap);
      return function () {
        if (typeof document.removeEventListener === 'function') {
          document.removeEventListener(ev, wrap);
        }
      };
    },

    _state: function () {
      return { ready: ready, index: index, count: tracks.length, requestedPlaying: requestedPlaying, shuffle: shuffleEnabled, favoritesMode: favoritesMode };
    }
  };

  // v2 helper: shared step logic for next()/prev().
  function stepTrack(d) {
    if (!ready || !audio || !tracks.length) return false;
    loadTrack(index + d);
    fireTrackChange();
    if (requestedPlaying) return requestPlay();
    return true;
  }

  if (typeof window !== 'undefined') window.TSCMSJukebox = TSCMSJukebox;
  if (typeof module !== 'undefined' && module.exports) module.exports = TSCMSJukebox;
})();