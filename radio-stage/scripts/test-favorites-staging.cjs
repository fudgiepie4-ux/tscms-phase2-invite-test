'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const check=(what,test)=>{try{test();console.log('PASS '+what);}catch(e){console.error('FAIL '+what);throw e;}};
const paths=['index.html','tscms-today.html','tscms-search.html','gamehouse.html'];
const src=fs.readFileSync('tscms-favorites.js','utf8');
const lib=fs.readFileSync('tscms-favorites-core.mjs','utf8');
const rules=fs.readFileSync('favorites-pilot/favorites-v4-TEST-ONLY.rules.fragment','utf8');
const jukebox=fs.readFileSync('solitaire-phase1-staging/js/gamehouse-jukebox.js','utf8');
const page=fs.readFileSync('my-playlist.html','utf8');
check('Original core tests pass',()=>{const r=spawnSync(process.execPath,['test-favorites-core.mjs'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/12\/12/);});
check('All four pilot pages load module once, no static heart/door',()=>{for(const p of paths){const h=fs.readFileSync(p,'utf8');assert.equal((h.match(/src="\.\/tscms-favorites\.js"/g)||[]).length,1,p);assert.equal((h.match(/href="\.\/tscms-favorites\.css"/g)||[]).length,1,p);assert.doesNotMatch(h,/class="tc-fav-heart|class="tc-fav-door|tc-fav-qj-link/g,p);}});
check('No signed-out DOM creation outside approved-user gate in module',()=>{assert.match(src,/if\(!approvedTeam\(user,profile\)\)\{revokeView\(\);return;\}/);assert.match(src,/onSnapshot\(collection\(db,'users',user\.uid,'favorites'\)/);assert.match(src,/function sync\(\)\{if\(!signedIn\(\)\)return;/);assert.match(src,/function strip\(\)/);assert.match(src,/const ticket=\+\+generation/);assert.match(src,/subscriptionGeneration/);assert.match(src,/if\(sameApprovedIdentity\)\{/);assert.match(src,/getDocFromServer/);});
check('Signed-out bookmark only offers private sign-in path',()=>{assert.match(page,/id="tc-fav-playlist-root"/);assert.doesNotMatch(page,/class="tc-fav-row|class="tc-fav-heart|class="tc-fav-door/);assert.match(src,/Go to Team Sign In/);});
check('Pilot account and ownership constraints remain exact',()=>{assert.match(lib,/TEAM_ONLY = true/);assert.match(lib,/emailVerified===true/);assert.match(lib,/profile\?\.status==='approved'/);assert.match(rules,/request\.auth\.uid == uid/);assert.match(rules,/request\.auth\.token\.email_verified == true/);assert.match(rules,/allow update: if false/);});
check('Favorites song snapshots never truncate stream, use full title',()=>{assert.match(src,/title:row\.querySelector\('\.s-title,\.feat-title'\)/);assert.match(src,/songFromSearchRow/);assert.match(src,/serverTimestamp\(\)/);assert.match(src,/\.tc-fav-heart/);});
check('Jukebox still has one audio creator and dedicated Favorites API',()=>{assert.equal((jukebox.match(/audio=document\.createElement\('audio'\)/g)||[]).length,1);assert.match(jukebox,/setFavoritesPlaylist: function/);assert.match(jukebox,/restoreStationPlaylist: function/);assert.match(jukebox,/isFavoritesMode: function/);assert.match(jukebox,/favoritesMode/);assert.ok(!src.includes("createElement('audio')"));});
check('Saving a song presents an accessible, non-clipped playlist link',()=>{
  const css=fs.readFileSync('tscms-favorites.css','utf8');
  assert.match(src,/a\.textContent='View my playlist'/);
  assert.match(src,/a\.href='\.\/my-playlist\.html'/);
  assert.match(src,/const close=document\.createElement\('button'\)/);
  assert.match(src,/Dismiss playlist notification/);
  assert.match(css,/\.tc-fav-toast\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\) 44px/);
  assert.match(css,/\.tc-fav-toast>\.tc-fav-toast-link\{[^}]*grid-row:2/);
  assert.match(css,/\.tc-fav-toast>button\{[^}]*width:44px;[^}]*height:44px/);
  assert.match(css,/\.tc-fav-toast>\.tc-fav-toast-link:focus-visible/);
  assert.match(css,/bottom:var\(--tc-fav-toast-bottom,/);
  assert.doesNotMatch(css,/\.tc-fav-toast\{position:fixed;bottom:1rem;right:1rem/);
});
check('Saved confirmation clears higher-layer Feedback at phone width',()=>{
  const begin=src.indexOf('function positionToastAboveFeedback(box){');
  const end=src.indexOf('function repositionActiveToast(){',begin);
  assert.ok(begin>=0&&end>begin,'Test actual deployed collision-avoidance routine');
  const css=fs.readFileSync('tscms-favorites.css','utf8');
  const fb=fs.readFileSync('tscms-feedback.js','utf8');
  assert.match(fb,/#tscms-fb-btn\{position:fixed;z-index:99990;bottom:18px;right:18px/);
  assert.match(css,/z-index:10050/); // Less than Feedback; must separate by geometry.
  function run(bounds,height){
    const props=new Map();
    const box={isConnected:true,style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)}};
    const feedback=bounds?{getBoundingClientRect:()=>bounds}:null;
    const sandbox={byId:id=>id==='tscms-fb-btn'?feedback:null,window:{innerHeight:height},document:{documentElement:{clientHeight:height}}};
    vm.runInNewContext(src.slice(begin,end)+'this.place=positionToastAboveFeedback;',sandbox);
    sandbox.place(box);
    return props.get('--tc-fav-toast-bottom')||null;
  }
  for(const height of [600,760,900]){
    const top=height-95,rect={width:144,height:72,top,bottom:top+72};
    const bottom=Number.parseInt(run(rect,height),10);
    assert.ok(Number.isFinite(bottom)&&height-bottom<=rect.top-12, 'Toast lower edge must clear Feedback by 12px');
  }
  assert.equal(run({width:0,height:0,top:0,bottom:0},760),null,'Hidden button should not reserve a bogus giant gap');
  assert.equal(run(null,760),null,'Missing Feedback leaves safe CSS fallback');
  assert.match(src,/window\.addEventListener\('resize',repositionActiveToast/);
  assert.match(src,/positionToastAboveFeedback\(box\);\s*requestAnimationFrame/);
});
check('Radio stays linked to original playlist for restore',()=>{assert.match(jukebox,/masterTracks = list\.filter/);assert.match(jukebox,/stationTrackBeforeFavorites/);assert.match(jukebox,/Station shuffle preference saved for later/);});
check('Rules fragment explicitly is not deployed or production root',()=>{assert.match(rules,/DO NOT DEPLOY/);assert.match(rules,/match \/users\/\{uid\}\/favorites\/\{songId\}/);assert.ok(!fs.existsSync('firestore.rules'));});
check('Staging never adds hearts to Dicey',()=>{assert.doesNotMatch(src,/\.dicey|dice-card|\.dice-card/);});
const backend=fs.readFileSync('favorites-pilot/backend/team-favorites-aggregate.cjs','utf8');
const owner=fs.readFileSync('tscms-favorites-owner.js','utf8');
const admin=fs.readFileSync('admin.html','utf8');
check('Owner pilot counts are server-only, with owner Auth+profile check',()=>{
  assert.match(backend,/request\.auth\?\.uid/);
  assert.match(backend,/profile\.owner!==true/);
  assert.match(backend,/profile\.status!=='approved'/);
  assert.match(backend,/\.collection\('favorites'\)\.count\(\)/);
  assert.match(backend,/return \{totalHearts,activeMembers,countedAt:/);
  assert.doesNotMatch(owner,/collection\(db,'users'/);
  assert.match(owner,/httpsCallable\(getFunctions\(app,'us-central1'\)/);
  assert.match(owner,/p\?\.owner!==true/);
  assert.equal((admin.match(/src="\.\/tscms-favorites-owner\.js"/g)||[]).length,1);
  assert.doesNotMatch(admin,/class="tc-owner-favorites-aggregate/);
});
check('Backend proposal cannot run without separately provisioned Firebase Functions',()=>{
  assert.match(backend,/STAGING SOURCE ONLY/);
  assert.ok(!fs.existsSync('firebase.json'));
});
(async()=>{
  let audioCount=0,playCalls=0;
  class AudioMock{constructor(){this.paused=true;this.volume=1;this.currentTime=0;this.duration=NaN;this.seekable={length:0};this.events={};}
    addEventListener(k,fn){this.events[k]=fn;}pause(){this.paused=true;}play(){this.paused=false;playCalls++;return Promise.resolve();}
  }
  const ctx={module:{exports:{}},Promise,Math,Number,Date,isFinite,URL,console,Uint8Array,setTimeout,clearTimeout,
   CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts?.detail;}},
   window:{localStorage:{getItem:()=>null,setItem:()=>{}}},
   document:{createElement:(name)=>{assert.equal(name,'audio');audioCount++;return new AudioMock();},dispatchEvent:()=>{}},
   fetch:async()=>({ok:true,json:async()=>({playlist:[{title:'Official A',artist:'Station Artist',stream:'https://example.com/a.mp3'},{title:'Official B',artist:'Station Artist',stream:'https://example.com/b.mp3'}]})})
  };
  vm.runInNewContext(jukebox,ctx,{filename:'gamehouse-jukebox.js'});
  const J=ctx.window.TSCMSJukebox;
  assert.equal(await J.init({playlistUrl:'radio-data.json',enableEq:false}),true);
  check('Station init does not autoplay',()=>{assert.equal(playCalls,0);assert.equal(J.isFavoritesMode(),false);assert.equal(audioCount,1);});
  const officialTrackBeforeFavorites=J.currentTrack().stream;
  const favorite=[{title:'Original Full Song Title',artist:'Exact Artist',stream:'https://example.com/saved.mp3'}];
  check('Private Favorites queue swaps into same audio without autoplay',()=>{assert.equal(J.setFavoritesPlaylist(favorite,{play:false}),true);assert.equal(J.currentTrack().title,'Original Full Song Title');assert.equal(audioCount,1);assert.equal(playCalls,0);});
  check('Shuffle does not replace favorites with station tracks',()=>{J.setShuffle(true);assert.equal(J.currentTrack().stream,favorite[0].stream);assert.equal(J.isFavoritesMode(),true);});
  check('Returning to station preserves the official song and stays paused',()=>{assert.equal(J.restoreStationPlaylist({play:false}),true);assert.equal(J.currentTrack().stream,officialTrackBeforeFavorites);assert.equal(playCalls,0);assert.equal(J.isFavoritesMode(),false);});
  check('Explicit user Favorites tap can start playback',()=>{assert.equal(J.setFavoritesPlaylist(favorite,{play:true}),true);assert.equal(playCalls,1);});
  check('Revocation restores station without private playback resuming',()=>{assert.equal(J.restoreStationPlaylist({play:false}),true);assert.equal(playCalls,1);assert.equal(J.isFavoritesMode(),false);});
  console.log('Favorites staging safety preflight PASS. Server Rules emulator / live signed-out DOM / two-device / owner UI remain NOT TESTED.');
})().catch(e=>{console.error(e);process.exitCode=1;});
