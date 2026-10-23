/* TSCMS Solitaire GoatCounter activity telemetry — Phase A, owner approved 2026-10-20.
   Only counts actual new deals, wins, and Swiper encounters; no player-facing counts.
   Firebase Phase B is intentionally not implemented. */
window.TSCMS_SOLITAIRE_TRACK = (function () {
  'use strict';
  var installed = false;
  function isTestRun() {
    try { return new URLSearchParams(window.location.search).has('swiper_test'); }
    catch(e) { return false; }
  }
  function send(path) {
    if(isTestRun()) return;
    try {
      if(window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({path:path,event:true});
      }
    } catch(e) { /* tracking must never interfere with the game */ }
  }
  function modeOf(theme) {
    if(String(theme || '').toLowerCase()==='halloween') return 'halloween';
    try {
      var p=(typeof SwiperLaunchBootstrap!=='undefined' && SwiperLaunchBootstrap.preferences)
        ? SwiperLaunchBootstrap.preferences() : {};
      return p && p.ghostMode===true ? 'swiper' : 'classic';
    } catch(e) { return 'classic'; }
  }
  function installStartHook() {
    try {
      if(installed || typeof SaloonEngine==='undefined' || typeof SaloonEngine.newGame!=='function') return false;
      var previous=SaloonEngine.newGame;
      SaloonEngine.newGame=function(timerMode,drawMode,theme) {
        var result=previous.apply(this,arguments);
        var chosenTheme=theme;
        try {
          if(!chosenTheme && window.TSCMSHalloween && typeof window.TSCMSHalloween.getTheme==='function') {
            chosenTheme=window.TSCMSHalloween.getTheme();
          }
        }catch(e){}
        // Only successful deals. Resuming an existing saved game doesn't invoke newGame.
        if(result) {
          var mode=modeOf(chosenTheme);
          send('/solitaire/start');
          send('/solitaire/start/'+mode);
        }
        return result;
      };
      installed=true;
      return true;
    } catch(e){ return false; }
  }
  return {
    installStartHook:installStartHook,
    start:function(mode){
      send('/solitaire/start');
      var m=String(mode||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
      if(m)send('/solitaire/start/'+m);
    },
    win:function(){send('/solitaire/win');},
    swiper:function(){send('/solitaire/swiper-appears');}
  };
})();
