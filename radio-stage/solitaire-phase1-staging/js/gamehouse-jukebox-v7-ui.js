/* TSCMS Gamehouse — approved Design B / V7 modal, staging integration only.
 * One audio player: Cherish's v2.1 TSCMSJukebox owns the sole audio element.
 * The archived approved standalone V7 preview is read as inert HTML and only
 * its photographic CABINET subtree and STYLES are reused. No preview scripts,
 * audio tag, test controls or microphone access are ever installed.
 */
(function () {
  'use strict';
  const PREVIEW = 'solitaire-gamehouse-jukebox-DESIGN-B-v7-APPROVED-PREVIEW.html';
  const PLAYLIST = 'radio-data.json';
  const required = ['close','title','artist','trackNum','original','play','previous','next',
    'volume','seek','elapsed','duration','equalizer','eqTitle','eqAccess','analysisState','liveLed','status'];
  function init() {
    const trigger = document.getElementById('btn-jukebox');
    const J = window.TSCMSJukebox;
    if (!trigger || !J || trigger.dataset.v7Bound === 'true') return;
    trigger.dataset.v7Bound = 'true';
    trigger.setAttribute('aria-label', 'Open TSCMS Radio jukebox');
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.removeAttribute('aria-pressed');

    let panel = null, ui = null, preparing = null, lastFocus = null;
    let spectrumRaf = 0, lastSpectrumTime = 0, spectrumMode='idle', spriteLevels = Array(35).fill(0);
    function stopSpectrum(){if(spectrumRaf) cancelAnimationFrame(spectrumRaf);spectrumRaf=0;}
    // Direct FFT only. Never invent music-reactive values from timers/randomness.
    function spectrumFrame(t) {
      spectrumRaf=0;
      if(!ui||!panel||panel.hidden||!J.isPlaying())return;
      // 20fps max; reduce expensive canvas redraws on S24.
      if(t-lastSpectrumTime<50){spectrumRaf=requestAnimationFrame(spectrumFrame);return;}
      lastSpectrumTime=t;
      const frame=typeof J.getSpectrumFrame==='function'?J.getSpectrumFrame():null;
      if(frame && frame.bins && frame.bins.length){
        const bins=frame.bins, c=ui.equalizer;
        const width=c.width/Math.min(window.devicePixelRatio||1,2),height=c.height/Math.min(window.devicePixelRatio||1,2);
        const dpr=Math.min(window.devicePixelRatio||1,2);
        const ctx=c.getContext('2d');
        if(ctx){
          ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
          const count=35,gap=3,bw=(width-gap*(count-1))/count;
          const nyquist=(frame.sampleRate||44100)/2, hi=Math.min(14500,nyquist);
          for(let i=0;i<count;i++){
            const hz1=45*Math.pow(hi/45,i/count),hz2=45*Math.pow(hi/45,(i+1)/count);
            const a=Math.max(1,Math.floor(hz1/nyquist*bins.length)),b=Math.max(a,Math.min(bins.length-1,Math.ceil(hz2/nyquist*bins.length)));
            let peak=0,sum=0;for(let j=a;j<=b;j++){const e=bins[j]/255;peak=Math.max(peak,e);sum+=e;}
            const level=Math.min(1,(.65*peak+.35*sum/(b-a+1))*1.24);
            spriteLevels[i]=Math.max(level,spriteLevels[i]*.66); // realistic quick-fall decay
            const h=height*spriteLevels[i]*.87;
            const x=i*(bw+gap),y=height-h-3;
            const palette=[['#65ecff','#0979ba'],['#fc7fd0','#92376b'],['#ffe583','#aa7935']][i%3];
            const g=ctx.createLinearGradient(0,y,0,height);g.addColorStop(0,palette[0]);g.addColorStop(1,palette[1]);
            ctx.fillStyle=g;ctx.fillRect(x,y,bw,h);
          }
        }
        spectrumMode='live';
        ui.analysisState.textContent='REAL MUSIC FREQUENCIES · DIRECT FFT';
        ui.eqAccess.textContent='AUDIO REACTIVE';
        ui.eqTitle.textContent='LIVE DIGITAL EQUALIZER';
      } else {
        // Unverified/denied CORS -> honest idle bars; never silence normal music.
        const eq=typeof J.getSpectrumStatus==='function'?J.getSpectrumStatus():{reason:'UNVERIFIED'};
        if(spectrumMode!=='idle'){idleBars();spectrumMode='idle';}
        ui.eqAccess.textContent='SOUND ON · EQ LIMITED';
        ui.analysisState.textContent='IDLE — REAL FFT UNAVAILABLE';
        ui.analysisState.title=eq.reason||'Music plays normally; real analysis unavailable';
      }
      spectrumRaf=requestAnimationFrame(spectrumFrame);
    }
    function syncSpectrum(){
      stopSpectrum();
      if(!ui||!panel||panel.hidden)return;
      if(J.isPlaying()){lastSpectrumTime=0;spectrumRaf=requestAnimationFrame(spectrumFrame);}
      else { idleBars();spectrumMode='idle'; }
    }
    let originStatus = document.getElementById('gamehouse-radio-status');
    function notify(message) {
      if (!originStatus) {
        originStatus = document.createElement('div');
        originStatus.id = 'gamehouse-radio-status';
        originStatus.setAttribute('role','status');
        originStatus.setAttribute('aria-live','polite');
        document.body.appendChild(originStatus);
      }
      originStatus.textContent = message;
      originStatus.hidden = !message;
      // Status note is for error/fetch information; no app-level audio arbitration.
    }
    const fmt = value => {
      if (!Number.isFinite(value) || value < 0) return '0:00';
      const sec = Math.floor(value);
      return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    };
    // Fit the FULL, UNMODIFIED song title and artist into the engraved plate.
    // Measure rendered text, never guess from string length and never use ellipsis.
    // Called after the modal becomes visible and whenever the song/viewport changes.
    function fitPlaqueText() {
      if (!ui || !panel || panel.hidden) return;
      const title = ui.title, artist = ui.artist;
      const plate = title.closest('.plate');
      if (!plate || !plate.clientWidth || !plate.clientHeight) return;
      title.style.fontSize = '';
      artist.style.fontSize = '';
      let titleSize = parseFloat(getComputedStyle(title).fontSize) || 18;
      let artistSize = parseFloat(getComputedStyle(artist).fontSize) || 12;
      const p = getComputedStyle(plate);
      const limit = plate.clientHeight - (parseFloat(p.paddingTop) || 0)
        - (parseFloat(p.paddingBottom) || 0) - 1;
      const rows = Array.from(plate.children);
      function requiredHeight() {
        return rows.reduce((sum, row) => {
          const style = getComputedStyle(row);
          return sum + row.getBoundingClientRect().height
            + (parseFloat(style.marginTop) || 0)
            + (parseFloat(style.marginBottom) || 0);
        }, 0);
      }
      // The entire text must fit. No line-clamping, clipping or replaced names.
      for (let attempts = 0; attempts < 110; attempts++) {
        const fits = requiredHeight() <= limit
          && title.scrollWidth <= title.clientWidth + 1
          && artist.scrollWidth <= artist.clientWidth + 1;
        if (fits) break;
        if (titleSize > 9) {
          titleSize = Math.max(9, titleSize - .5);
          title.style.fontSize = titleSize + 'px';
        } else if (artistSize > 7) {
          artistSize = Math.max(7, artistSize - .5);
          artist.style.fontSize = artistSize + 'px';
        } else if (titleSize > 6) {
          titleSize = Math.max(6, titleSize - .5);
          title.style.fontSize = titleSize + 'px';
        } else break;
      }
    }
    function track() {
      if (!ui) return;
      const t = J.currentTrack(), state = J._state();
      ui.title.textContent = t ? t.title : 'TSCMS Radio';
      ui.artist.textContent = (t && t.artist) || 'Suno Country Music Spot';
      ui.trackNum.textContent = t ? 'TRACK ' + (state.index + 1) + ' OF ' + state.count : 'PLAYLIST UNAVAILABLE';
      // Measure *after* the title, artist and track count have all updated.
      fitPlaqueText();
      let song = null;
      try {
        const url = new URL(t && t.suno || '');
        if (url.protocol === 'https:' && (url.hostname === 'suno.com' || url.hostname.endsWith('.suno.com'))) song = url.href;
      } catch (e) { /* no valid song link */ }
      ui.original.href = song || '#';
      ui.original.target = '_blank';
      ui.original.rel = 'noopener noreferrer';
      ui.original.setAttribute('aria-disabled', String(!song));
      ui.original.tabIndex = song ? 0 : -1;
      ui.play.disabled = ui.previous.disabled = ui.next.disabled = !state.ready;
      progress();
    }
    function progress() {
      if (!ui) return;
      const p = J.getPosition();
      const good = Number.isFinite(p.duration) && p.duration > 0;
      const percent = good ? Math.max(0, Math.min(100, p.currentTime / p.duration * 100)) : 0;
      ui.elapsed.textContent = fmt(p.currentTime);
      ui.duration.textContent = fmt(p.duration);
      ui.seek.value = String(Math.round(percent));
      ui.seek.style.setProperty('--fill', percent.toFixed(2) + '%');
      // Owner wants scrub after real Suno + Galaxy S24 acceptance, not before.
      ui.seek.disabled = true;
      ui.seek.setAttribute('aria-label','Song progress (display only until phone verification)');
    }
    function reflect() {
      if (!ui) return;
      const playing = J.isPlaying();
      ui.play.textContent = playing ? '❚❚' : '▶';
      ui.play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
      ui.eqAccess.textContent = playing ? 'MUSIC ON' : 'STANDBY';
      ui.liveLed.style.opacity = playing ? '1' : '.45';
      syncSpectrum();
    }
    function idleBars() {
      if (!ui || !panel || panel.hidden) return;
      const c = ui.equalizer, box = c.getBoundingClientRect();
      const width = Math.max(210, Math.round(box.width || 320));
      const height = Math.max(75, Math.round(box.height || 120));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = width * dpr; c.height = height * dpr;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      const count = 35, gap = 3, bw = (width - gap * (count - 1)) / count;
      for (let i = 0; i < count; i++) {
        const h = height * (0.19 + .07 * Math.sin(i * .41) + .045 * Math.sin(i * .17));
        const x = i * (bw + gap), y = height - h - 3;
        const palette = [['#65ecff','#0979ba'],['#fc7fd0','#92376b'],['#ffe583','#aa7935']][i%3];
        const g = ctx.createLinearGradient(0, y, 0, height);
        g.addColorStop(0, palette[0]); g.addColorStop(1, palette[1]);
        ctx.fillStyle = g; ctx.fillRect(x, y, bw, h);
      }
      ui.analysisState.textContent = 'IDLE BARS — NOT AUDIO REACTIVE';
    }
    function close() {
      if (!panel || panel.hidden) return;
      panel.hidden = true;
      stopSpectrum();
      document.removeEventListener('keydown', keydown);
      (lastFocus && lastFocus.isConnected ? lastFocus : trigger).focus();
      // Intentionally NO playback/volume/playlist changes here.
    }
    function keydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !panel || panel.hidden) return;
      const all = [...panel.shadowRoot.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]:not([aria-disabled="true"])')]
        .filter(node => node.getClientRects().length > 0);
      if (!all.length) return;
      const first = all[0], last = all[all.length - 1];
      if (e.shiftKey && panel.shadowRoot.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && panel.shadowRoot.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function open() {
      if (!panel) return;
      lastFocus = document.activeElement;
      panel.hidden = false;
      track(); fitPlaqueText(); progress(); idleBars(); reflect();
      document.addEventListener('keydown', keydown);
      ui.close.focus();
      notify('');
    }
    function build() {
      if (preparing) return preparing;
      preparing = fetch(PREVIEW)
        .then(response => { if (!response.ok) throw new Error('Approved V7 visual is unavailable'); return response.text(); })
        .then(raw => {
          const doc = new DOMParser().parseFromString(raw,'text/html');
          const cabinet = doc.querySelector('#jukebox .cabinet');
          const originalStyle = doc.querySelector('head style');
          if (!cabinet || !originalStyle || !cabinet.querySelector('.photo') || !cabinet.querySelector('.neon-real'))
            throw new Error('Approved V7 visual is incomplete');
          panel = document.createElement('div');
          panel.id = 'tscms-v7-modal-host';
          panel.hidden = true;
          const shadow = panel.attachShadow({mode:'open'});
          const styles = document.createElement('style');
          // Style encapsulation protects the approved Solitaire board/controls.
          styles.textContent = originalStyle.textContent + '\n:host{--cream:#ffe9b9;--wood:#3d170b;--brass:#d1a363;--cyan:#28e6ff;--gold:#ffd97d;--pink:#ff54b9;position:fixed;inset:0;z-index:3000;display:block;font-family:Arial,Helvetica,sans-serif;color:#ffe9b9;} :host([hidden]){display:none!important} *{box-sizing:border-box} .preview-overlay{display:flex!important;} :host([hidden]) .preview-overlay{display:none!important} input:disabled{cursor:not-allowed;opacity:.7}';
          const overlay = document.createElement('div');
          overlay.className = 'preview-overlay';
          overlay.id = 'jukebox';
          overlay.setAttribute('role','dialog');
          overlay.setAttribute('aria-modal','true');
          overlay.setAttribute('aria-label','TSCMS Radio — full Design B V7 jukebox');
          const caption = document.createElement('p');
          caption.className = 'owner-label';
          caption.textContent = 'TSCMS RADIO';
          overlay.appendChild(caption);
          // Only import inert, owner-approved cabinet markup, never standalone scripts/audio.
          const approvedCabinet = document.importNode(cabinet, true);
          // V8 seam cleanup: preload corrected source image without touching audio/EQ.
          // On failure, keep original approved V7 photo and its mirror patch.
          const cabinetPhoto = approvedCabinet.querySelector('.photo');
          const comparisonPatch = approvedCabinet.querySelector('.photo-mirror');
          const repairedPhoto = new Image();
          repairedPhoto.onload = function () {
            if (cabinetPhoto) cabinetPhoto.src = repairedPhoto.src;
            if (comparisonPatch) comparisonPatch.remove();
          };
          repairedPhoto.onerror = function () {
            console.warn('V8 seamless cabinet photo unavailable; retaining V7 original');
          };
          repairedPhoto.src = new URL('solitaire-phase1-staging/assets/TSCMS_V7_CABINET_SEAM_CLEAN_v8.jpg', document.baseURI).href;
          approvedCabinet.querySelectorAll('.speaker-row,#speakerListen,#captureNote').forEach(n => n.remove());
          approvedCabinet.querySelectorAll('script,audio,iframe').forEach(n => n.remove());
          // Tactile shuffle setting on the existing photographic V7 cabinet.
          // This is the ONLY player: do not add preview audio or duplicate streams.
          const shuffleButton = document.createElement('button');
          shuffleButton.type = 'button';
          shuffleButton.id = 'tscms-v7-shuffle';
          shuffleButton.title = 'Shuffle the TSCMS Radio playlist';
          shuffleButton.setAttribute('aria-label', 'Toggle radio shuffle');
          approvedCabinet.appendChild(shuffleButton);
          overlay.appendChild(approvedCabinet);
          // V8.1: align live Play/Pause cap with the original photographed button.
          // Do not change side controls, EQ, player events, or approved cabinet photo.
          styles.textContent += '\n.transport button.primary{transform:translate(-7%,-4%)}';
          styles.textContent += "\n/* Complete artist/song credits are mandatory: never clamp or truncate. */\n.plate {justify-content:center;gap:0}\n.plate > .tiny-label, .plate > .song, .plate > .artist, .plate > .track-counter {flex:0 0 auto;min-height:0}\n.plate .song {display:block!important;-webkit-line-clamp:unset!important;\n  overflow:visible!important;text-overflow:clip!important;white-space:normal;\n  overflow-wrap:anywhere;word-break:normal;hyphens:none;line-height:1.05!important;\n  max-width:100%;text-align:center}\n.plate .artist {display:block;white-space:normal!important;overflow:visible!important;\n  text-overflow:clip!important;overflow-wrap:anywhere;word-break:normal;hyphens:none;\n  line-height:1.05!important}\n.plate .track-counter {white-space:nowrap}\n";
          styles.textContent += '\n#tscms-v7-shuffle{position:absolute;z-index:8;left:50%;top:94.6%;transform:translateX(-50%);min-width:40%;height:3.5%;padding:0 8px;border:1px solid #d5a966;border-radius:12px;background:linear-gradient(160deg,#704624,#28150e);color:#ffe7a8;font:800 clamp(9px,2.5vw,12px)/1 Arial,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 2px 6px #000b}#tscms-v7-shuffle[aria-pressed=true]{border-color:#70d9c7;color:#b6fff3;box-shadow:0 0 7px #29aa9a88}#tscms-v7-shuffle:focus-visible{outline:3px solid #fff4bd;outline-offset:2px}';
          shadow.append(styles, overlay);
          document.body.appendChild(panel);
          ui = Object.fromEntries(required.map(id => [id,shadow.getElementById(id)]));
          if (required.some(id => !ui[id])) { panel.remove(); panel = null; ui = null; throw new Error('V7 controls incomplete'); }
          function reflectShuffle() {
            const on = typeof J.isShuffleEnabled === 'function' && J.isShuffleEnabled();
            shuffleButton.textContent = on ? '🔀 SHUFFLE ON' : '🔀 SHUFFLE OFF';
            shuffleButton.setAttribute('aria-pressed',String(on));
          }
          shuffleButton.addEventListener('click',() => {
            if (typeof J.setShuffle === 'function') J.setShuffle(!J.isShuffleEnabled());
            reflectShuffle();
          });
          reflectShuffle();
          ui.close.setAttribute('aria-label','Close jukebox and return to Solitaire');
          ui.close.addEventListener('click',close);
          ui.play.addEventListener('click',() => { J.toggle(); reflect(); });
          ui.next.addEventListener('click',() => { J.next(); track(); reflect(); });
          ui.previous.addEventListener('click',() => { J.prev(); track(); reflect(); });
          ui.volume.value = String(Math.round(J.getVolume() * 100));
          ui.volume.style.setProperty('--fill',ui.volume.value + '%');
          ui.volume.addEventListener('input',() => {
            J.setVolume(Number(ui.volume.value) / 100);
            ui.volume.style.setProperty('--fill',ui.volume.value + '%');
          });
          ui.original.addEventListener('click',e => {
            if (ui.original.getAttribute('aria-disabled') === 'true') e.preventDefault();
          });
          J.on('trackchange',() => { track(); reflect(); reflectShuffle(); });
          J.on('timeupdate',progress);
          document.addEventListener('tscms:jukebox',e => {
            const d = e.detail || {};
            ui.status.textContent = d.message || (d.state === 'ready' ? 'TSCMS Radio ready' :
              d.state === 'playing' ? 'TSCMS Radio playing' :
              d.state === 'paused' ? 'TSCMS Radio paused' :
              d.state === 'loading' ? 'Loading TSCMS Radio…' : 'TSCMS Radio');
            track(); reflect();
          });
          window.addEventListener('resize',() => {fitPlaqueText();idleBars();syncSpectrum();});
          track(); reflect(); progress();
          return true;
        })
        .catch(error => { preparing = null; notify('Could not open approved V7 jukebox. Solitaire remains available.'); console.warn('V7 modal unavailable:', error.message); return false; });
      return preparing;
    }
    trigger.addEventListener('click',() => {
      // Painted jukebox OPENs the modal; does not play/pause or reset music.
      if (panel) { open(); return; }
      notify('Opening TSCMS Radio jukebox…');
      build().then(ok => { if (ok) open(); });
    });
    // Load official playlist without autoplay; all playback stays user-gesture gated.
    J.init({playlistUrl:PLAYLIST,enableEq:true});
    // Prefetch photographic HTML during idle rather than on the critical tap path.
    // Do not create a second audio element or execute any scripts from the preview.
    if ('requestIdleCallback' in window) window.requestIdleCallback(build,{timeout:2500});
    else setTimeout(build,150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();