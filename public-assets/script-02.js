
(function(){
  'use strict';
  // Staging player coordinator. Use the production radio's actual media APIs on integration.
  const vid=document.getElementById('dubbyVideo'), song=document.getElementById('songAudio');
  const tvButton=document.getElementById('dubbyPlay'), notice=document.getElementById('audioNotice');
  const playlistStatus=document.getElementById('playlistStatus');
  let currentRow=null, pendingResume=false;
  let resume=null;function showResume(){if(resume)resume.hidden=!pendingResume;}
  function syncButtons(){
    document.querySelectorAll('.songPlay').forEach(function(btn){
      const row=btn.closest('.song'), playing=row===currentRow&&!song.paused&&!song.ended;
      btn.textContent=playing?'Ⅱ PAUSE':'▶ PLAY';
      btn.setAttribute('aria-label',(playing?'Pause ':'Play ')+row.querySelector('.song-title').textContent);
    });
  }
  function restoreMusic(reason){
    const saved=(window.TSCMSAudio&&TSCMSAudio.videoEnding())||null;
    tvButton.hidden=false;showResume();
    if(typeof syncDubbyBtns==='function')syncDubbyBtns();
    if(!saved){notice.textContent=reason+' · no music to resume';return;}
    if(document.hidden){
      window._pendingVideoResume=saved;pendingResume=true;showResume();
      notice.textContent=reason+' · return to this page to resume your music';return;
    }
    resumeSavedMusic(saved,reason);
  }
  function resumeSavedMusic(saved,reason){
    if(saved.player==='radio'&&typeof radioPlay==='function'){
      try{const r=document.getElementById('raudio');if(r)r.currentTime=saved.pos||0;}catch(e){}
      radioPlay();
      playlistStatus.textContent='\u266B Returning to your music';
      notice.textContent=reason+' \u00B7 music returning';
      return;
    }
    // song player
    try{
      if(saved.src&&song.src!==saved.src)song.src=saved.src;
      song.currentTime=saved.pos||0;
    }catch(e){}
    if(window.TSCMSAudio)TSCMSAudio.requestPlay('song');
    let promise;
    try{promise=song.play();}catch(e){
      window._pendingVideoResume=saved;pendingResume=true;showResume();
      notice.textContent='Tap Resume Music if your browser blocks playback';return;
    }
    if(promise&&promise.catch)promise.catch(function(){
      window._pendingVideoResume=saved;pendingResume=true;showResume();
      notice.textContent='Your browser paused the music \u00B7 tap Resume Music';
    });
    playlistStatus.textContent='\u266B Returning to your song';
    notice.textContent=reason+' \u00B7 music returning';
    syncButtons();if(typeof syncDayButtons==='function')syncDayButtons();
  }
  function startVideoSession(){
    if(window.TSCMSAudio)TSCMSAudio.videoStarting();
    else{if(!song.paused){try{song.pause();}catch(e){}}}
    pendingResume=false;window._pendingVideoResume=null;showResume();
    syncButtons();if(typeof syncDayButtons==='function')syncDayButtons();
    if(typeof syncDubbyBtns==='function')syncDubbyBtns();
    tvButton.hidden=true;
    notice.textContent='Sponsor TV playing · playlist paused';
    playlistStatus.textContent='\u266B Playlist paused while the Sponsor TV plays';
  }
  vid.addEventListener('play',startVideoSession);
  vid.addEventListener('playing',function(){tvButton.hidden=true;});
  vid.addEventListener('pause',function(){
    if(vid.ended)return; // let the ended event handle it once.
    restoreMusic('Sponsor TV paused');
  });
  vid.addEventListener('ended',function(){restoreMusic('Sponsor TV finished');});
  vid.addEventListener('error',function(){restoreMusic('Video unavailable');tvButton.hidden=false;});
  tvButton.addEventListener('click',function(){
    const p=vid.play(); if(p&&p.catch)p.catch(function(){restoreMusic('Video could not start');tvButton.hidden=false;});
  });
  // Fudgie 2026-10-14: explicit video controls (play/pause/stop) below the player
  const dPlayBtn=document.getElementById('dubbyPlayBtn'),
        dPauseBtn=document.getElementById('dubbyPauseBtn'),
        dStopBtn=document.getElementById('dubbyStopBtn');
  function syncDubbyBtns(){
    const playing=!vid.paused&&!vid.ended;
    if(dPlayBtn)dPlayBtn.style.opacity=playing?0.45:1;
    if(dPauseBtn)dPauseBtn.style.opacity=playing?1:0.45;
  }
  if(dPlayBtn)dPlayBtn.addEventListener('click',function(){
    const p=vid.play();if(p&&p.catch)p.catch(function(){restoreMusic('Video could not start');});
    syncDubbyBtns();
  });
  if(dPauseBtn)dPauseBtn.addEventListener('click',function(){
    if(!vid.paused){vid.pause();}syncDubbyBtns();
  });
  if(dStopBtn)dStopBtn.addEventListener('click',function(){
    vid.pause();try{vid.currentTime=0;}catch(e){}
    restoreMusic('Sponsor TV stopped');syncDubbyBtns();
  });
  vid.addEventListener('play',syncDubbyBtns);
  vid.addEventListener('pause',syncDubbyBtns);
  vid.addEventListener('ended',syncDubbyBtns);
  syncDubbyBtns();
  song.addEventListener('play',function(){
    pendingResume=false;window._pendingVideoResume=null;showResume();
    /* A newly chosen song takes priority over video. The coordinator normally
       pauses video first (clearing resume state); this is a safety net. */
    if(!vid.paused){
      if(window.TSCMSAudio)TSCMSAudio.requestPlay('song');
      else{try{vid.pause();}catch(e){}}
    }
    tvButton.hidden=false;syncButtons();notice.textContent='Enjoying TSCMS music';
    if(currentRow)playlistStatus.textContent='♫ Playing: '+currentRow.querySelector('.song-title').textContent;
  });
  song.addEventListener('pause',function(){
    syncButtons();if(typeof syncDayButtons==='function')syncDayButtons();
    /* Don't overwrite the video status line when Sponsor TV caused the pause. */
    const v=document.getElementById('dubbyVideo');
    if(v&&!v.paused&&!v.ended)return;
    if(currentRow)playlistStatus.textContent='\u266B Paused: '+currentRow.querySelector('.song-title').textContent;
  });
  song.addEventListener('ended',function(){syncButtons();playlistStatus.textContent='♫ Song finished';});
  song.addEventListener('error',function(){syncButtons();playlistStatus.textContent='♫ Preview song unavailable · full playlist remains on the live page';});
  document.querySelectorAll('.songPlay').forEach(function(btn){btn.addEventListener('click',function(){
    const row=btn.closest('.song');
    /* True toggle: only pause when THIS row's song is the one playing.
       (The shared element may be playing a day-list or dice song.) */
    const streamKey=(row.dataset.stream||'').split('/').pop().split('.')[0];
    const isThisRow=row===currentRow&&!song.paused&&!song.ended&&streamKey&&song.src.indexOf(streamKey)>=0;
    if(isThisRow){song.pause();return;}
    if(window.TSCMSAudio)TSCMSAudio.requestPlay('song');
    else{if(!vid.paused){try{vid.pause();}catch(e){}}tvButton.hidden=false;}
    pendingResume=false;window._pendingVideoResume=null;showResume();
    tvButton.hidden=false;
    if(typeof clearDayPlaying==='function')clearDayPlaying();
    if(row!==currentRow||!song.src){currentRow=row;song.src=row.dataset.stream;try{song.load();}catch(e){}}
    const p=song.play();if(p&&p.catch)p.catch(function(){playlistStatus.textContent='♫ Preview audio could not load. Check the connection.';syncButtons();});
  });});
  /* Expose for day/dice players so switching sources clears stale static state. */
  window.TSCMSClearStaticRow=function(){currentRow=null;syncButtons();};
  document.querySelectorAll('.songStop').forEach(function(btn){btn.addEventListener('click',function(){
    try{song.pause();song.currentTime=0;}catch(e){}
    currentRow=null;
    if(typeof clearDayPlaying==='function')clearDayPlaying();
    syncButtons();if(typeof syncDayButtons==='function')syncDayButtons();
    playlistStatus.textContent='♫ Stopped';
  });});
  document.querySelectorAll('.tab').forEach(function(btn){btn.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(b){const selected=b===btn;b.classList.toggle('active',selected);b.setAttribute('aria-selected',selected?'true':'false');});
    document.querySelectorAll('.song').forEach(function(row){row.style.display=btn.dataset.day==='wed'?'':'none';});
    playlistStatus.textContent=btn.dataset.day==='wed'?'♫ Wednesday sample songs are shown':'♫ Only Wednesday examples are in this concept preview; the live page keeps its full song list.';
  });});
  // Explicit restore button for restrictive mobile browsers. Native play() will often succeed,
  // but this user gesture makes a graceful fallback if it doesn't.
  resume=document.createElement('button');resume.type='button';resume.className='mini-resume';resume.hidden=true;
  resume.textContent='▶ Resume Music';resume.setAttribute('aria-label','Resume your paused music');
  notice.insertAdjacentElement('afterend',resume);
  resume.addEventListener('click',function(){
    if(!pendingResume)return;
    pendingResume=false;showResume();
    const saved=window._pendingVideoResume;window._pendingVideoResume=null;
    if(saved&&typeof resumeSavedMusic==='function'){resumeSavedMusic(saved,'Resumed');return;}
    const p=song.play();if(p&&p.catch)p.catch(function(){notice.textContent='Tap Play on the playlist to continue';});
  });
  showResume();
  // Expose diagnostics to staging tests, not required for live player.
  window.TSCMSAudioPreview={state:function(){return {coord:(window.TSCMSAudio&&TSCMSAudio._debug())||null,pendingResume:pendingResume,currentSong:currentRow&&currentRow.dataset.song,videoPaused:vid.paused,songPaused:song.paused};}};
})();
