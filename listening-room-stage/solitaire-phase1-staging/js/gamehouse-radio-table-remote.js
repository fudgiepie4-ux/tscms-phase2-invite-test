/* Approved tabletop remote integrated with existing TSCMSJukebox; no second audio player. */

/* Clara / TSCMS Gamehouse: saloon radio remote and miniature cabinet display.
 * VIEW LAYER ONLY: uses the existing TSCMSJukebox single audio element.
 * Real FFT from J.getSpectrumFrame() only; no fabricated reactive animation.
 * The full approved V7 jukebox, its equalizer, and gameplay are unchanged.
 */
(function () {
  'use strict';
  function init() {
    const J=window.TSCMSJukebox, stage=document.getElementById('stage');
    if(!stage || !J || document.getElementById('tscms-radio-remote')) return;

    const remote=document.createElement('section');
    remote.id='tscms-radio-remote';
    remote.className='tscms-radio-remote';
    remote.setAttribute('aria-label','TSCMS Radio jukebox remote');
    remote.dataset.playing='false';
    remote.innerHTML='<div class="remote-brand"><span>♫ JUKEBOX REMOTE</span><span class="remote-indicator" aria-hidden="true"></span></div>'+
      '<div class="remote-transport" role="group" aria-label="Radio playback">'+
        '<button class="remote-key" id="radio-remote-prev" type="button" aria-label="Previous song" title="Previous song" disabled>⏮</button>'+
        '<button class="remote-key remote-toggle" id="radio-remote-play" type="button" aria-label="Play radio" title="Play radio" disabled>▶</button>'+
        '<button class="remote-key" id="radio-remote-next" type="button" aria-label="Next song" title="Next song" disabled>⏭</button>'+
      '</div>'+
      '<label class="remote-volume"><span class="remote-volume-icon" aria-hidden="true">♪</span>'+
        '<input id="radio-remote-volume" type="range" min="0" max="100" step="1" aria-label="Radio volume">'+
        '<span class="remote-volume-level" aria-hidden="true">100%</span></label>'+
      '<span class="radio-remote-srstatus" role="status" aria-live="polite"></span>';

    const face=document.createElement('section');
    face.id='tscms-radio-face';
    face.className='tscms-radio-face';
    face.setAttribute('aria-label','TSCMS Radio song and equalizer');
    face.innerHTML='<div class="radio-face-brand">TSCMS RADIO</div>'+
      '<div class="radio-face-track">'+
        '<span class="radio-face-title" id="radio-face-title">Radio Ready</span>'+
        '<span class="radio-face-artist" id="radio-face-artist">Tap ▶ to listen</span></div>'+
      '<canvas id="radio-face-eq" aria-label="Static equalizer until verified music frequencies are available" role="img"></canvas>';

    // Draw these AFTER the artwork and BEFORE the game controls in the stack.
    // Neither the approved photographic master nor the painted jukebox is edited.
    stage.append(remote,face);
    const prev=remote.querySelector('#radio-remote-prev');
    const play=remote.querySelector('#radio-remote-play');
    const next=remote.querySelector('#radio-remote-next');
    const volume=remote.querySelector('#radio-remote-volume');
    const volumeLevel=remote.querySelector('.remote-volume-level');
    const srstatus=remote.querySelector('.radio-remote-srstatus');
    const title=face.querySelector('#radio-face-title');
    const artist=face.querySelector('#radio-face-artist');
    const canvas=face.querySelector('#radio-face-eq');
    let raf=0,lastRefresh=0,lastStatic=-1,resizeStamp='';

    function currentState(){
      return typeof J._state==='function' ? J._state() : {ready:false,count:0};
    }
    function mirrorModalVolume(){
      // The full jukebox preloads independently; keep its volume slider in
      // sync if present, without causing recursive input events.
      const host=document.getElementById('tscms-v7-modal-host');
      const control=host && host.shadowRoot && host.shadowRoot.getElementById('volume');
      if(control){
        control.value=volume.value;
        control.style.setProperty('--fill',volume.value+'%');
      }
    }
    function volumeDisplay(syncFromPlayer) {
      let val=syncFromPlayer ? Math.round(J.getVolume()*100) : Number(volume.value);
      if(!Number.isFinite(val)) val=100;
      val=Math.max(0,Math.min(100,val));
      volume.value=String(val);
      volume.style.setProperty('--remote-fill',val+'%');
      volumeLevel.textContent=val+'%';
    }
    function updateTrack(){
      const track=J.currentTrack&&J.currentTrack();
      const state=currentState();
      const song=track&&track.title|| (state.ready?'TSCMS Radio':'Radio Loading');
      const singer=track&&track.artist||'Suno Country Music Spot';
      title.textContent=song;
      artist.textContent=singer;
      face.setAttribute('aria-label','TSCMS Radio — '+song+' by '+singer);
      title.title=song;
      artist.title=singer;
      remote.setAttribute('aria-label','Jukebox remote. '+song+' by '+singer);
      srstatus.textContent=state.ready ? 'Selected '+song+' by '+singer : 'Loading TSCMS Radio';
    }
    function updateControls(){
      const state=currentState(),playing=!!J.isPlaying();
      prev.disabled=play.disabled=next.disabled=!state.ready;
      play.textContent=playing?'❚❚':'▶';
      play.title=playing?'Pause radio':'Play radio';
      play.setAttribute('aria-label',playing?'Pause radio':'Play radio');
      play.setAttribute('aria-pressed',String(playing));
      remote.dataset.playing=String(playing);
      volumeDisplay(true);
      if(!playing) {stopFrames();drawBars(null);}
      else startFrames();
    }
    function stopFrames(){if(raf){cancelAnimationFrame(raf);raf=0;}lastRefresh=0;lastStatic=-1;}
    function setUpCanvas(){
      const box=canvas.getBoundingClientRect();
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const w=Math.max(50,Math.round(box.width*dpr));
      const h=Math.max(20,Math.round(box.height*dpr));
      const sz=w+'x'+h;
      if(sz!==resizeStamp){canvas.width=w;canvas.height=h;resizeStamp=sz;}
    }
    function drawBars(spectrum){
      setUpCanvas();
      const ctx=canvas.getContext('2d');
      if(!ctx)return;
      const w=canvas.width,h=canvas.height,count=13,gap=Math.max(1,Math.round(w*.022));
      const pad=Math.max(2,Math.floor(w*.038));
      const bw=(w-2*pad-(count-1)*gap)/count;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle='#03080b';ctx.fillRect(0,0,w,h);
      const trueSignal=!!(spectrum && spectrum.bins && spectrum.bins.length);
      canvas.setAttribute('aria-label',trueSignal?'Real measured music frequency equalizer':'Decorative stationary bars; real frequency data unavailable or music paused');
      face.dataset.eqMode=trueSignal?'real':'stationary';
      for(let i=0;i<count;i++){
        let fraction;
        if(trueSignal){
          const bins=spectrum.bins;
          // Log-spaced frequency buckets, read ONLY actual analyser data.
          const maxIndex=Math.min(bins.length-1,430);
          const start=Math.max(1,Math.floor(Math.pow(maxIndex,(i+.1)/count)));
          const end=Math.max(start+1,Math.floor(Math.pow(maxIndex,(i+1)/count)));
          let peak=0;
          for(let b=start;b<=Math.min(end,maxIndex);b++)peak=Math.max(peak,bins[b]);
          fraction=Math.max(.06,Math.min(.98,peak/255));
        } else {
          const still=[.21,.28,.17,.37,.32,.44,.29,.35,.48,.28,.39,.24,.19];
          fraction=still[i];
        }
        const bh=Math.max(2,Math.round((h-4)*fraction));
        const x=pad+i*(bw+gap),y=h-bh-2;
        const palette=[['#67f5fe','#087ba1'],['#ff79bc','#863562'],['#ffe88d','#916029']][i%3];
        const fill=ctx.createLinearGradient(0,y,0,h);
        fill.addColorStop(0,palette[0]);fill.addColorStop(1,palette[1]);
        ctx.fillStyle=fill;ctx.fillRect(x,y,bw,bh);
      }
    }
    function animate(ts){
      raf=0;
      if(!J.isPlaying() || document.hidden)return;
      if(ts-lastRefresh >= 80){
        const measured=typeof J.getSpectrumFrame==='function' ? J.getSpectrumFrame() : null;
        // Do NOT animate invented levels if CORS prevents the real FFT.
        if(measured){drawBars(measured);lastStatic=-1;}
        else if(lastStatic<0){drawBars(null);lastStatic=ts;}
        lastRefresh=ts;
      }
      raf=requestAnimationFrame(animate);
    }
    function startFrames(){
      if(document.hidden || raf || !J.isPlaying())return;
      raf=requestAnimationFrame(animate);
    }

    prev.addEventListener('click',()=>{
      if(!currentState().ready)return;
      J.prev();updateTrack();updateControls();
    });
    next.addEventListener('click',()=>{
      if(!currentState().ready)return;
      J.next();updateTrack();updateControls();
    });
    play.addEventListener('click',()=>{
      if(!currentState().ready){
        srstatus.textContent='Radio is loading. Try again shortly.';
        return;
      }
      // IMPORTANT: synchronous call within tap for Samsung/Android autoplay.
      J.toggle();
      updateControls();
    });
    volume.addEventListener('input',()=>{
      J.setVolume(Number(volume.value)/100);
      volumeDisplay(false);
      mirrorModalVolume();
    });
    document.addEventListener('tscms:jukebox',e=>{
      const detail=e.detail||{};
      updateTrack();updateControls();
      if(detail.message)srstatus.textContent=detail.message;
    });
    J.on('trackchange',()=>{updateTrack();updateControls();});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)stopFrames();
      else {updateControls();drawBars(null);}
    });
    window.addEventListener('resize',()=>{resizeStamp='';drawBars(null);if(J.isPlaying())startFrames();},{passive:true});
    // When full V7 cabinet volume is changed, refresh miniature remote.
    document.addEventListener('input',e=>{
      const path=typeof e.composedPath==='function' ? e.composedPath() : [];
      if(path.some(node=>node&&node.id==='volume'))volumeDisplay(true);
    },true);
    // When the user opens the full cabinet, its slider should reflect any
    // changes made on this remote, without resetting playback.
    document.getElementById('btn-jukebox')?.addEventListener('click',()=>{
      setTimeout(mirrorModalVolume,0);
    });
    updateTrack();updateControls();drawBars(null);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

