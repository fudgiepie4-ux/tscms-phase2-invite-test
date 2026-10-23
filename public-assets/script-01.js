
/* ===== TSCMS SHARED AUDIO COORDINATOR (Fudgie 2026-10-14) =====
   Single arbitrator for: radio (#raudio), songs (#songAudio), video (#dubbyVideo).
   RULES:
   - requestPlay(who): pauses every player except `who`. who='radio'|'song'|'video'.
   - videoStarting(): snapshots whichever music is playing (player+position+src),
     then pauses music. Called when Sponsor TV begins.
   - videoEnding(): returns the snapshot (or null) and clears it. Called when
     Sponsor TV pauses/ends/stops so the caller can resume.
   - No audio ever auto-starts; every entry point is a user gesture.
   - Song buttons are true toggles (pause resumes, never restarts); stop resets.
*/
window.TSCMSAudio=(function(){
  'use strict';
  var saved=null;
  function el(id){return document.getElementById(id);}
  function isPlaying(m){return !!m&&!m.paused&&!m.ended;}
  function pauseRadio(){
    var r=el('raudio');
    if(!r||r.paused)return;
    if(typeof radioPause==='function'){try{radioPause();return;}catch(e){}}
    try{r.pause();}catch(e){}
  }
  return{
    requestPlay:function(who){
      var r=el('raudio'),s=el('songAudio'),v=el('dubbyVideo');
      if(who!=='video'){
        /* A song/radio is taking over: clear video resume state FIRST,
           then pause video, so the video 'pause' event cannot resurrect music. */
        saved=null;
        if(v&&!v.paused){try{v.pause();}catch(e){}}
      }
      if(who!=='radio')pauseRadio();
      if(who!=='song'&&s&&!s.paused){try{s.pause();}catch(e){}}
    },
    videoStarting:function(){
      var r=el('raudio'),s=el('songAudio');
      saved=null;
      if(isPlaying(r)){saved={player:'radio',pos:r.currentTime||0};}
      else if(isPlaying(s)){saved={player:'song',pos:s.currentTime||0,src:s.currentSrc||s.src||''};}
      pauseRadio();
      if(s&&!s.paused){try{s.pause();}catch(e){}}
    },
    videoEnding:function(){var s=saved;saved=null;return s;},
    _debug:function(){return {hasSaved:!!saved};}
  };
})();
