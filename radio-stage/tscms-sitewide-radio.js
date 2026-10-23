/* TSCMS SITE-WIDE RADIO — STAGING ONLY, 2026-10-23.
 * One canonical TSCMSJukebox media engine per page; never create a second audio.
 * Cross-document resume is best effort: browser autoplay denial produces an
 * explicit tap-to-resume state at the VERIFIED saved track and position.
 * Never persist private Favorites tracks or fabricate a playing state.
 */
(function(){
  'use strict';
  if(window.TSCMSSitewideRadio)return;
  var STATE_KEY='tscms-sitewide-radio-v1';
  var OWNER_KEY='tscms-sitewide-radio-owner-v1';
  var owner=String(Date.now())+'-'+Math.random().toString(36).slice(2);
  var J=null, ui=null, title=null, status=null, play=null, previous=null, next=null, stop=null, volume=null;
  var chosen='stopped', wanted=null, loaded=false, restoring=false, needTap=false, seekFailed=false, lastSaved=0, owns=false, yieldingToTab=false;
  function read(){
    try{
      var value=JSON.parse(localStorage.getItem(STATE_KEY)||'null');
      if(!value || value.v!==1 || !['playing','paused','stopped'].includes(value.mode) ||
         typeof value.stream!=='string' || !/^https?:\/\//.test(value.stream) ||
         !Number.isFinite(value.at) || value.at<0 || value.at>86400 ||
         !Number.isFinite(value.volume) || value.volume<0 || value.volume>1)return null;
      return value;
    }catch(_){return null;}
  }
  function take(){
    owns=true;
    try{localStorage.setItem(OWNER_KEY,owner);}catch(_){}
  }
  function isOwner(){
    try{var current=localStorage.getItem(OWNER_KEY);return !current || current===owner;}
    catch(_){return owns;}
  }
  function saved(mode){
    if(!J || !loaded || restoring || J.isFavoritesMode())return;
    var song=J.currentTrack();
    if(!song || !song.stream)return;
    var position=J.getPosition();
    var seconds=mode==='stopped'?0:Number(position.currentTime);
    if(!Number.isFinite(seconds) || seconds<0)seconds=0;
    var snapshot={v:1,stream:song.stream,at:seconds,mode:mode,volume:J.getVolume(),updated:Date.now()};
    try{localStorage.setItem(STATE_KEY,JSON.stringify(snapshot));}catch(_){}
    wanted=snapshot;lastSaved=Date.now();
  }
  function text(el,value){if(el)el.textContent=value;}
  function announce(message){text(status,message);}
  function display(){
    if(!J || !loaded)return;
    var t=J.currentTrack();
    text(title,t?(t.title+(t.artist?' — '+t.artist:'')):'Station unavailable');
    if(volume)volume.value=String(J.getVolume());
    var playing=J.isPlaying();
    text(play,needTap?'▶ Tap':playing?'❚❚ Pause':'▶ Play');
    play.setAttribute('aria-label',needTap?'Tap to keep listening to '+(t?t.title:'the station'):playing?'Pause TSCMS Radio':'Play TSCMS Radio');
    play.setAttribute('aria-pressed',playing?'true':'false');
    // Normal load previously forgot to enable Play and Volume.
    [previous,play,next,stop,volume].forEach(function(control){control.disabled=!!restoring;});
    if(ui){
      ui.setAttribute('data-playback',playing?'playing':needTap?'needs-tap':chosen);
      var tab=ui.querySelector('.tc-radio-tab');
      if(tab){
        tab.setAttribute('aria-label',(ui.getAttribute('data-open')==='true'?'Close':'Open')+
          ' TSCMS Radio player — '+(playing?'music playing':needTap?'tap to keep listening':chosen)+(t?' — '+t.title:''));
        tab.title=playing?'TSCMS Radio is playing':needTap?'Tap to keep listening':'TSCMS Radio '+chosen;
      }
    }
  }
  function silenceOtherMedia(){
    document.querySelectorAll('audio,video').forEach(function(media){
      if(!media.paused && typeof media.pause==='function')media.pause();
    });
  }
  function makeUI(){
    if(document.getElementById('tscms-sitewide-radio'))return null;
    var root=document.createElement('section');root.id='tscms-sitewide-radio';
    root.setAttribute('aria-label','TSCMS Radio — follows you around the site');
    root.setAttribute('data-open','false');root.setAttribute('data-playback','stopped');
    var tab=document.createElement('button');tab.type='button';tab.className='tc-radio-tab';
    tab.setAttribute('aria-label','Open TSCMS Radio player');
    tab.setAttribute('aria-controls','tc-radio-panel');tab.setAttribute('aria-expanded','false');
    var tabIcon=document.createElement('span');tabIcon.className='tc-radio-tab-icon';
    tabIcon.setAttribute('aria-hidden','true');tabIcon.textContent='♫';
    var indicator=document.createElement('span');indicator.className='tc-radio-indicator';
    indicator.setAttribute('aria-hidden','true');
    tab.append(tabIcon,indicator);
    var panel=document.createElement('div');panel.id='tc-radio-panel';panel.className='tc-radio-panel';
    panel.setAttribute('aria-hidden','true');
    var head=document.createElement('div');head.className='tc-radio-head';
    var heading=document.createElement('strong');heading.textContent='TSCMS RADIO';
    title=document.createElement('span');title.className='tc-radio-title';title.textContent='Loading station…';
    head.append(heading,title);
    var row=document.createElement('div');row.className='tc-radio-controls';
    function button(label,aria,cls){var b=document.createElement('button');b.type='button';b.className=cls||'';b.textContent=label;b.setAttribute('aria-label',aria);return b;}
    previous=button('⏮','Previous TSCMS Radio song');
    play=button('▶ Play','Play TSCMS Radio','tc-radio-play');
    next=button('⏭','Next TSCMS Radio song');
    stop=button('■','Stop TSCMS Radio');
    var volLabel=document.createElement('label');volLabel.textContent='Vol ';
    volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='0.05';volume.value='1';volume.setAttribute('aria-label','TSCMS Radio volume');
    volLabel.append(volume);row.append(previous,play,next,stop,volLabel);
    status=document.createElement('p');status.className='tc-radio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    status.textContent='Station loading. No autoplay on first visit.';
    panel.append(head,row,status);root.append(tab,panel);
    function setOpen(open){
      root.setAttribute('data-open',open?'true':'false');
      panel.setAttribute('aria-hidden',open?'false':'true');
      tab.setAttribute('aria-expanded',open?'true':'false');
      tab.setAttribute('aria-label',(open?'Close':'Open')+' TSCMS Radio player');
      if(loaded)display();
    }
    tab.addEventListener('click',function(){setOpen(root.getAttribute('data-open')!=='true');});
    // Do not wake the separate Drive-In ambient audio on a radio tap.
    root.addEventListener('pointerdown',function(e){e.stopPropagation();});
    root.addEventListener('keydown',function(e){
      if(e.key==='Escape' && root.getAttribute('data-open')==='true'){
        setOpen(false);tab.focus();e.preventDefault();
      }
      e.stopPropagation();
    });
    document.body.append(root);ui=root;
    [previous,play,next,stop,volume].forEach(function(x){x.disabled=true;});
    return root;
  }
  function initialPlay(){
    if(!loaded || restoring || !J || J.isFavoritesMode())return;
    take();silenceOtherMedia();
    chosen='playing';needTap=false;seekFailed=false;
    var started=J.toggle();
    if(!started || needTap){needTap=true;announce('Tap to keep listening to '+(J.currentTrack()?J.currentTrack().title:'the saved song')+' — your browser did not start sound.');}
    else announce('Starting the saved station track…');
    display();
  }
  async function retry(){
    if(!wanted || !J || restoring)return;
    restoring=true;[previous,play,next,stop,volume].forEach(function(x){x.disabled=true;});announce('Finding your saved position…');
    var ok=await J.restoreStationPosition(wanted.stream,wanted.at);
    restoring=false;[previous,play,next,stop,volume].forEach(function(x){x.disabled=false;});
    if(!ok){
      needTap=true;seekFailed=true;
      announce('Saved position unavailable for this track. Tap to retry; the song will not restart at zero.');
      display();return;
    }
    needTap=false;seekFailed=false;
    initialPlay();
  }
  function connectControls(){
    play.addEventListener('click',function(){
      if(!loaded || restoring)return;
      if(J.isFavoritesMode()){announce('Your private Gamehouse Favorites are playing in its jukebox.');return;}
      if(needTap || seekFailed){void retry();return;}
      if(J.isPlaying() || J._state().requestedPlaying){
        J.pauseStation();chosen='paused';saved(chosen);announce('Paused — your place is saved.');display();
      }else initialPlay();
    });
    previous.addEventListener('click',function(){step(-1);});
    next.addEventListener('click',function(){step(1);});
    stop.addEventListener('click',function(){
      if(!loaded || restoring || J.isFavoritesMode())return;
      J.stopStation();chosen='stopped';needTap=false;seekFailed=false;
      take();saved(chosen);announce('Stopped. It will stay stopped on the next page.');display();
    });
    volume.addEventListener('input',function(){
      if(!loaded || restoring)return;
      J.setVolume(Number(volume.value));
      if(!J.isFavoritesMode())saved(chosen);
    });
  }
  function step(direction){
    if(!loaded || restoring || J.isFavoritesMode())return;
    take();
    needTap=false;seekFailed=false;wanted=null;
    var wasPlaying=J.isPlaying();
    if(wasPlaying)silenceOtherMedia();
    if(direction<0)J.prev();else J.next();
    chosen=wasPlaying?'playing':'paused';
    saved(chosen);display();
  }
  function onMedia(e){
    if(!loaded || restoring || yieldingToTab || J.isFavoritesMode())return;
    var d=e.detail||{};
    if(d.state==='playing'){
      needTap=false;seekFailed=false;chosen='playing';silenceOtherMedia();take();saved('playing');
      announce('Playing TSCMS Radio. Your song will follow you to the next page.');
    }else if(d.state==='blocked'){
      needTap=true;chosen='playing';
      announce('Tap to keep listening to this song — your browser blocked automatic sound.');
    }else if(d.state==='paused' || d.state==='stopped'){
      chosen=d.state;needTap=false;take();saved(chosen);
      announce(chosen==='paused'?'Paused. Your place is saved.':'Stopped.');
    }else if(d.state==='unavailable'){
      needTap=true;announce('Station unavailable. Your saved song will not be replaced or restarted.');
    }
    display();
  }
  function onExternalPlay(e){
    if(!loaded || restoring || !J || J.isFavoritesMode())return;
    // The native Gamehouse jukebox audio is detached, so DOM media events
    // here describe OTHER media (member songs, Drive-In sound and video).
    if(e.target && e.target !== ui && (J.isPlaying() || J._state().requestedPlaying)){
      J.pauseStation();chosen='paused';saved(chosen);
      announce('Radio paused while other audio plays.');
    }
  }
  async function start(){
    if(!makeUI())return;
    connectControls();
    wanted=read();
    try{
      if(!window.TSCMSJukebox){
        await new Promise(function(resolve,reject){
          var s=document.createElement('script');
          s.src='./solitaire-phase1-staging/js/gamehouse-jukebox.js?v=20261023-radio-stage';
          s.onload=resolve;s.onerror=reject;document.head.append(s);
        });
      }
      J=window.TSCMSJukebox;
      if(!J)throw new Error('Jukebox engine missing');
      var ok=await J.init({playlistUrl:'./radio-data.json',enableEq:false});
      if(!ok)throw new Error('Verified station feed unavailable');
      restoring=true;
      if(wanted){
        J.setVolume(wanted.volume);
        var restored=await J.restoreStationPosition(wanted.stream,wanted.at);
        if(!restored){needTap=true;seekFailed=true;}
      }
      restoring=false;loaded=true;
      document.addEventListener('tscms:jukebox',onMedia);
      J.on('trackchange',function(){if(!restoring && loaded && !J.isFavoritesMode()){saved(chosen);display();}});
      J.on('timeupdate',function(){if(!restoring && loaded && J.isPlaying() && Date.now()-lastSaved>2200)saved('playing');});
      document.addEventListener('play',onExternalPlay,true);
      document.addEventListener('tscms:jukebox:volumechange',function(){
        if(!restoring && loaded && !J.isFavoritesMode()){saved(chosen);display();}
      });
      window.addEventListener('storage',function(e){
        if(e.key===OWNER_KEY && e.newValue!==owner && J &&
           (J.isPlaying() || J._state().requestedPlaying)){
          // The previous tab yields WITHOUT re-acquiring ownership in onMedia.
          yieldingToTab=true;
          J.pauseStation();
          yieldingToTab=false;
          owns=false;chosen='paused';
          announce('Radio moved to another tab.');display();
        }
      });
      window.addEventListener('pagehide',function(){
        if(!J || !loaded || restoring || !isOwner())return;
        // Do not falsely claim autoplay when it was denied; preserve requested intent.
        saved(needTap?'playing':chosen);
      });
      display();
      if(!wanted){chosen='stopped';announce('Press Play to start TSCMS Radio.');return;}
      chosen=wanted.mode;
      if(seekFailed){
        announce('Saved position could not be restored yet. Tap to retry — never restart at zero.');
        display();return;
      }
      if(chosen==='playing'){
        // This may be blocked by autoplay policy; the rejection handler clearly
        // presents one-tap continuation and keeps the same saved timestamp.
        needTap=false;
        initialPlay();
      }else{
        announce(chosen==='paused'?'Paused at your saved position.':'Stopped. Press Play when you want music.');
      }
      display();
    }catch(_){
      restoring=false;announce('The station could not load. No other audio has been started.');
      text(title,'TSCMS Radio unavailable');
    }
  }
  window.TSCMSSitewideRadio={version:'stage-20261023',getState:function(){return {loaded:loaded,mode:chosen,needsTap:needTap,restoring:restoring};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();