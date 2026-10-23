'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const shared=fs.readFileSync('tscms-sitewide-radio.js','utf8');
const engine=fs.readFileSync('solitaire-phase1-staging/js/gamehouse-jukebox.js','utf8');
const runtime=fs.readFileSync('tscms-public-runtime.js','utf8');
let passed=0;
function test(name,fn){fn();console.log('PASS '+(++passed)+' '+name);}
function snapshot(mode,at=47.5){
  return {v:1,stream:'https://cdn1.suno.ai/verified-song.mp4',at,mode,volume:.35,updated:Date.now()};
}
function harness(savedState=null,opts={}){
  const {document,window}=parseHTML('<html><head></head><body><main><h1>Test TSCMS page</h1></main></body></html>');
  const items=new Map();
  if(savedState)items.set('tscms-sitewide-radio-v1',JSON.stringify(savedState));
  const storage={getItem:key=>items.get(key)||null,setItem:(k,v)=>items.set(k,String(v))};
  let track={title:'Station Original',artist:'Artist',stream:'https://cdn1.suno.ai/station-original.mp4'};
  let pos=0,volume=1,playing=false,ready=false, playCalls=0, restoreCalls=[],stops=0,pauses=0;
  const J={
    init:async()=>{ready=true;return true;},
    isFavoritesMode:()=>!!opts.favorites,
    currentTrack:()=>track,
    getPosition:()=>({currentTime:pos,duration:222,seekable:true,ranges:[[0,222]]}),
    setVolume:x=>{volume=x;return x;},getVolume:()=>volume,
    isPlaying:()=>playing,
    _state:()=>({ready,requestedPlaying:playing}),
    restoreStationPosition:async(stream,seconds)=>{restoreCalls.push([stream,seconds]);
      if(opts.seekFails)return false;
      track={title:'Saved Verified Song',artist:'Station Member',stream};pos=seconds;return true;},
    toggle:()=>{
      playCalls++;
      if(opts.autoplayBlocks && !opts.allowed){
        playing=false;
        const ev=new window.Event('tscms:jukebox');ev.detail={state:'blocked'};
        document.dispatchEvent(ev);
        return true;
      }
      playing=!playing;
      const ev=new window.Event('tscms:jukebox');ev.detail={state:playing?'playing':'paused'};
      document.dispatchEvent(ev);
      return playing;
    },
    pauseStation:()=>{pauses++;playing=false;return true;},
    stopStation:()=>{stops++;playing=false;pos=0;return true;},
    prev:()=>{track={title:'Earlier',artist:'Member',stream:'https://cdn1.suno.ai/earlier.mp4'};pos=0;},
    next:()=>{track={title:'Next',artist:'Member',stream:'https://cdn1.suno.ai/next.mp4'};pos=0;},
    on:()=>()=>{}
  };
  // linkedom window proxies can inherit test-global properties across mounts.
  delete window.TSCMSSitewideRadio;
  window.TSCMSJukebox=J;window.localStorage=storage;
  const ctx={window,document,localStorage:storage,Promise,Number,Math,Date,console,setTimeout,clearTimeout,CustomEvent:window.CustomEvent};
  vm.runInNewContext(shared,ctx,{filename:'tscms-sitewide-radio.js'});
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return {
    document,J,opts,store:()=>JSON.parse(items.get('tscms-sitewide-radio-v1')||'null'),
    inspect:()=>({playCalls,restoreCalls,stops,pauses,track,pos,playing,volume}),
    flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();await new Promise(setImmediate);}
  };
}
(async()=>{
  function loadEntirePublicRuntime(html,pathname){
    const {document,window}=parseHTML(html);
    const context={
      window,document,location:{pathname},
      localStorage:{getItem:()=>null,setItem:()=>{}},
      Promise,console,Math,Number,Date,Set,Array,
      setTimeout,clearTimeout
    };
    // Runtime uses the same deferred asset on both standalone pages. Emulate
    // the completed HTML parse as well as the DOMContentLoaded fallback.
    vm.runInNewContext(runtime,context,{filename:'tscms-public-runtime.js'});
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    return document;
  }
  test('Search + My Playlist finish the ENTIRE shared runtime with radio loader mounted',()=>{
    for(const [page,pathname,preserved] of [
      ['tscms-search.html','/tscms-search.html','#tscms-search-form'],
      ['my-playlist.html','/my-playlist.html','#tc-fav-playlist-root']
    ]){
      const html=fs.readFileSync(page,'utf8');
      assert.doesNotMatch(html,/class=["']wrap["']/);
      assert.doesNotMatch(html,/most-loved-autumn/);
      const doc=loadEntirePublicRuntime(html,pathname);
      assert.ok(doc.querySelector(preserved),page+' preserved');
      assert.equal(doc.querySelectorAll('#tscms-september-spotlight-2026').length,0,page);
      assert.equal(Array.from(doc.querySelectorAll('style')).filter(s=>s.textContent.includes('#tscms-september-spotlight-2026')).length,0,page+' no Spotlight CSS injected');
      const scripts=doc.querySelectorAll('script[data-tscms-preserved="sitewide-radio"]');
      assert.equal(scripts.length,1,page+' single radio loader');
      assert.match(scripts[0].getAttribute('src'),/tscms-sitewide-radio\.js/);
      assert.equal(doc.querySelectorAll('link[data-tscms-preserved="sitewide-radio-style"]').length,1,page);
    }
  });
  test('Homepage Spotlight retains identical anchor placement and original artwork',()=>{
    const doc=loadEntirePublicRuntime(
      '<html><head></head><body><main class="wrap"><div class="most-loved-autumn"></div><footer class="mono">TSCMS</footer></main></body></html>','/'
    );
    const anchor=doc.querySelector('.most-loved-autumn');
    const spotlight=doc.querySelector('#tscms-september-spotlight-2026');
    assert.ok(spotlight,'original Spotlight retained');
    assert.equal(anchor.nextElementSibling,spotlight,'original after-most-loved position');
    assert.equal(spotlight.querySelector('img').getAttribute('src'),'assets/spotlight-september-2026.webp');
    assert.equal(spotlight.querySelectorAll('a.tscms-spotlight-hotspot').length,2);
    assert.ok(doc.querySelector('style').textContent.includes('.tscms-spotlight-frame'));
    assert.equal(doc.querySelectorAll('script[data-tscms-preserved="sitewide-radio"]').length,1);
  });
  test('Homepage fallback remains null-safe and does not create a non-homepage Spotlight',()=>{
    const homepage=loadEntirePublicRuntime('<html><head></head><body><main class="wrap"><footer class="mono">Foot</footer></main></body></html>','/');
    assert.equal(homepage.querySelector('.wrap').firstElementChild.id,'tscms-september-spotlight-2026');
    const withFooter=loadEntirePublicRuntime('<html><head></head><body><main><footer>Other page footer</footer></main></body></html>','/subpage.html');
    assert.equal(withFooter.querySelector('#tscms-september-spotlight-2026'),null);
    assert.equal(withFooter.querySelectorAll('script[data-tscms-preserved="sitewide-radio"]').length,1);
  });
  test('One shared UI, not a second audio engine',()=>{
    assert.equal((shared.match(/createElement\('audio'\)/g)||[]).length,0);
    assert.equal((engine.match(/audio=document\.createElement\('audio'\)/g)||[]).length,1);
    assert.match(shared,/window\.TSCMSJukebox/);
    assert.match(engine,/restoreStationPosition: function/);
    assert.match(engine,/masterTracks\.findIndex/);
    assert.match(engine,/pauseStation: function/);
    assert.match(engine,/stopStation: function/);
  });
  test('Canonical verified feed and no silent fallback to track zero',()=>{
    assert.match(shared,/playlistUrl:'\.\/radio-data\.json'/);
    assert.match(shared,/never restart at zero/i);
    assert.match(engine,/masterTracks\.findIndex/);
    assert.match(engine,/Math\.abs\(now-wanted\) <= 1\.5/);
  });
  test('Seven requested public routes inherit or embed the same module, never admin',()=>{
    assert.match(runtime,/data-tscms-preserved','sitewide-radio'/);
    assert.match(runtime,/tscms-sitewide-radio\.js/);
    for(const page of ['index.html','tscms-today.html','tscms-search.html','my-playlist.html'])
      assert.match(fs.readFileSync(page,'utf8'),/tscms-public-runtime\.js/,page);
    for(const page of ['town-journal.html','videos.html','gamehouse.html'])
      assert.equal((fs.readFileSync(page,'utf8').match(/src="\.\/tscms-sitewide-radio\.js\?/g)||[]).length,1,page);
    assert.doesNotMatch(fs.readFileSync('admin.html','utf8'),/tscms-sitewide-radio/);
  });
  test('Protected Gamehouse integration + private favorites never stored',()=>{
    assert.match(shared,/J\.isFavoritesMode\(\)/);
    assert.match(engine,/setFavoritesPlaylist: function/);
    assert.match(fs.readFileSync('gamehouse.html','utf8'),/gamehouse-jukebox-v7-ui\.js/);
    assert.match(fs.readFileSync('tscms-pathway-pack.js','utf8'),/tscms-pathway-video/);
    assert.match(fs.readFileSync('tscms-favorites.js','utf8'),/approvedTeam\(/);
  });
  test('Journal keeps its book, text and Brenda entry intact',()=>{
    const page=fs.readFileSync('town-journal.html','utf8');
    assert.match(page,/Brenda Carraway/);
    assert.match(page,/const sheets=\[founding,/);
    assert.match(page,/function turn\(n\)/);
    assert.doesNotMatch(page,/<audio\b/);
  });
  {
    const h=harness();await h.flush();
    test('First visit stays silent until a Play tap',()=>{
      assert.equal(h.inspect().playCalls,0);
      assert.equal(h.document.querySelectorAll('#tscms-sitewide-radio').length,1);
      assert.match(h.document.querySelector('.tc-radio-status').textContent,/Press Play/);
    });
    h.document.querySelector('.tc-radio-play').click();
    test('First explicit tap starts station, persists actual playing mode',()=>{
      assert.equal(h.inspect().playCalls,1);
      assert.equal(h.store().mode,'playing');
    });
  }
  {
    const h=harness(snapshot('paused'));await h.flush();
    test('Saved paused track and 47.5 seconds restored without autoplay',()=>{
      assert.equal(h.inspect().playCalls,0);
      assert.equal(h.inspect().restoreCalls[0][1],47.5);
      assert.equal(h.inspect().volume,.35);
      assert.match(h.document.querySelector('.tc-radio-title').textContent,/Saved Verified Song/);
    });
  }
  {
    const h=harness(snapshot('stopped',0));await h.flush();
    test('Stopped stays stopped on next page, no autoplay',()=>{
      assert.equal(h.inspect().playCalls,0);
      assert.match(h.document.querySelector('.tc-radio-status').textContent,/Stopped/);
    });
  }
  {
    const h=harness(snapshot('playing',77.8));await h.flush();
    test('Allowed autoplay carries SAME verified stream at 77.8 seconds',()=>{
      assert.equal(h.inspect().playCalls,1);
      assert.equal(h.inspect().restoreCalls[0][1],77.8);
      assert.equal(h.store().at,77.8);
      assert.equal(h.store().mode,'playing');
    });
  }
  {
    const opts={autoplayBlocks:true,allowed:false};
    const h=harness(snapshot('playing',91.25),opts);await h.flush();
    test('Autoplay-blocked browser shows named Tap prompt, not fake Playing',()=>{
      assert.equal(h.inspect().playing,false);
      assert.match(h.document.querySelector('.tc-radio-play').textContent,/Tap to keep listening/);
      assert.match(h.document.querySelector('.tc-radio-title').textContent,/Saved Verified Song/);
      assert.equal(h.store().at,91.25);
    });
    opts.allowed=true;
    h.document.querySelector('.tc-radio-play').click();await h.flush();
    test('One retry tap restores same 91.25-second position before play',()=>{
      assert.equal(h.inspect().restoreCalls.at(-1)[1],91.25);
      assert.equal(h.inspect().playing,true);
      assert.equal(h.store().at,91.25);
    });
  }
  {
    const opts={seekFails:true};
    const h=harness(snapshot('playing',58),opts);await h.flush();
    test('Unseekable track NEVER restarts at zero or auto plays',()=>{
      assert.equal(h.inspect().playCalls,0);
      assert.match(h.document.querySelector('.tc-radio-status').textContent,/never restart at zero/i);
    });
  }
  {
    const h=harness(snapshot('playing',40));await h.flush();
    h.document.querySelector('button[aria-label="Stop TSCMS Radio"]').click();
    test('Explicit Stop stores stopped / position zero',()=>{
      assert.equal(h.store().mode,'stopped');
      assert.equal(h.store().at,0);
      assert.equal(h.inspect().stops,1);
    });
  }
  test('No Drive-In secondary audio in shared module',()=>{
    assert.doesNotMatch(shared,/new Audio\(/);
    assert.match(shared,/silenceOtherMedia/);
    assert.match(shared,/addEventListener\('play',onExternalPlay,true\)/);
  });
  test('Browser autoplay NotAllowedError keeps same EQ audio / sought position',()=>{
    assert.match(engine,/error\.name!=='NotAllowedError'/);
  });

  // Exercise the actual Gamehouse jukebox source-selection/seek code, not
  // merely the shared visual mock. Real browser seek support remains a gate.
  {
    let created=0,playCalls=0;
    class AudioMock {
      constructor(){
        created++;this.paused=true;this.volume=1;this.preload='none';
        this.readyState=0;this.src='';this.seeking=false;this._current=0;
        this.duration=180;this.seekable={length:1,start:()=>0,end:()=>180};
        this.events=Object.create(null);
      }
      get currentTime(){return this._current;}
      set currentTime(x){
        this.seeking=true;this._current=Number(x);this.seeking=false;
        this.emit('seeked');
      }
      addEventListener(k,fn){(this.events[k]||(this.events[k]=new Set())).add(fn);}
      removeEventListener(k,fn){this.events[k]?.delete(fn);}
      emit(k){for(const fn of Array.from(this.events[k]||[]))fn();}
      load(){this.readyState=1;this.emit('loadedmetadata');}
      pause(){this.paused=true;}
      play(){playCalls++;this.paused=false;return Promise.resolve();}
    }
    const context={
      module:{exports:{}},Promise,Number,Date,Math,URL,isFinite,Uint8Array,
      console,setTimeout,clearTimeout,
      CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
      window:{localStorage:{getItem:()=>null,setItem:()=>{}}},
      document:{createElement:(tag)=>{assert.equal(tag,'audio');return new AudioMock();},dispatchEvent:()=>{}},
      fetch:async()=>({ok:true,json:async()=>({playlist:[
        {title:'Track Alpha',artist:'A',stream:'https://cdn1.suno.ai/alpha.mp4'},
        {title:'Track Bravo',artist:'B',stream:'https://cdn1.suno.ai/bravo.mp4'}
      ]})})
    };
    vm.runInNewContext(engine,context,{filename:'gamehouse-jukebox.js'});
    const radio=context.window.TSCMSJukebox;
    assert.equal(await radio.init({playlistUrl:'radio-data.json',enableEq:false}),true);
    const restored=await radio.restoreStationPosition('https://cdn1.suno.ai/bravo.mp4',63.75);
    test('Actual jukebox restores canonical song at 63.75 seconds without autoplay',()=>{
      assert.equal(restored,true);
      assert.equal(radio.currentTrack().title,'Track Bravo');
      assert.ok(Math.abs(radio.getPosition().currentTime-63.75)<.02);
      assert.equal(playCalls,0);
      assert.equal(created,1);
    });
    const bad=await radio.restoreStationPosition('https://unverified.example/mystery.mp3',54);
    test('Actual jukebox rejects unverified stream without replacing track',()=>{
      assert.equal(bad,false);assert.equal(radio.currentTrack().title,'Track Bravo');
      assert.equal(playCalls,0);
    });
    radio.pauseStation();
    test('Actual jukebox supports explicit pause without resetting timestamp',()=>{
      assert.ok(Math.abs(radio.getPosition().currentTime-63.75)<.02);
      assert.equal(playCalls,0);
    });
    radio.stopStation();
    test('Actual jukebox Stop sets time zero without audible replay',()=>{
      assert.equal(radio.getPosition().currentTime,0);
      assert.equal(playCalls,0);
    });
  }
  console.log('Site-wide radio staging preflight '+passed+'/'+passed+' PASS — real browsers / authentic audio seek still need Cherish verification.');
})().catch(err=>{console.error(err);process.exitCode=1;});
