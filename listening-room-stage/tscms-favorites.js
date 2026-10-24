/* TSCMS signed-in TEAM-ONLY Favorites, staging implementation.
 * Does not create hearts, playlist links or personalization DOM before the
 * verified approved user profile and own favorites collection are loaded.
 * Firebase Security Rules MUST be deployed/tested separately before ship.
 */
import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {getAuth,onAuthStateChanged,reload,getIdToken} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {getFirestore,doc,collection,getDocFromServer,onSnapshot,setDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {tscmsFirebaseConfig} from './firebase-admin-config.js';
import {approvedTeam,cleanSong,newestFirst,artistFromCard,songKey,MAX_SAVED} from './tscms-favorites-core.mjs';
const app=getApps().length?getApp():initializeApp(tscmsFirebaseConfig);
const auth=getAuth(app),db=getFirestore(app),STATE={uid:null,ready:false,items:[],profile:null};
let unsub=null,generation=0,subscriptionGeneration=0,pending=false,scanning=false,scanScheduled=false,playlistQueue=null,toastTimer=null;
let lastGameRefresh=null;
const byId=id=>document.getElementById(id);
const each=(css,fn)=>document.querySelectorAll(css).forEach(fn);
const source=()=>STATE.items;
const signedIn=()=>STATE.ready&&Boolean(STATE.uid);
const currentCount=()=>STATE.items.length;
function event(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}));}
function notice(msg){const p=byId('tc-fav-playlist-message');if(p)p.textContent=msg;}
function strip(){
  if(roomAudio&&!roomAudio.paused)roomAudio.pause();roomNow=null;roomQueue=null;roomSeq=false;
  each('.tc-fav-heart,.tc-fav-door,.tc-fav-toolbar,.tc-fav-toast,.tc-fav-qj-link',el=>el.remove());
  byId('tscms-v7-modal-host')?.shadowRoot?.getElementById('tc-fav-game-controls')?.remove();
  if(lastGameRefresh){document.removeEventListener('tscms:jukebox:trackchange',lastGameRefresh);lastGameRefresh=null;}
  // If access is removed, immediately exit the private queue; no saved track
  // may remain queued in the shared jukebox after sign-out or revocation.
  if(window.TSCMSJukebox?.isFavoritesMode?.()) window.TSCMSJukebox.restoreStationPlaylist?.({play:false});
  const list=byId('tc-fav-playlist-list');if(list)list.replaceChildren();
  // Hide old per-user count immediately on staff sign-out or revocation.
  const plaque=byId('tc-fav-crate-count');if(plaque){plaque.hidden=true;plaque.textContent='';}
  // Hide all personal controls, counts and populated imagery on access loss.
  const tools=byId('tc-room-tools');if(tools)tools.hidden=true;
  byId('tc-room-action-holder')?.replaceChildren();
  const filled=byId('tc-room-art-filled'),empty=byId('tc-room-art-empty');
  if(filled)filled.hidden=true;
  if(empty)empty.hidden=false;
  if(byId('tc-room-search'))byId('tc-room-search').value='';
  if(byId('tc-room-sort'))byId('tc-room-sort').value='newest';
}
function revokeView(){
  subscriptionGeneration++; // invalidate old Firestore snapshot callbacks
  STATE.uid=null;STATE.ready=false;STATE.items=[];STATE.profile=null;
  if(unsub){unsub();unsub=null;} strip();
  playlistQueue=null;event('tscms:favorites-revoked');
  if(byId('tc-fav-playlist-root')){
    notice('Sign in using your approved team account to view your own playlist.');
    const el=byId('tc-fav-playlist-list');if(el){const a=document.createElement('a');a.href='./admin.html';a.textContent='Go to Team Sign In';el.append(a);}
  }
}
async function confirmUser(user,ticket){
  const sameApprovedIdentity=Boolean(user?.uid && STATE.uid===user.uid && STATE.ready);
  // Actual sign-out or switching accounts removes all personal controls
  // immediately; a periodic privilege refresh for the SAME approved owner
  // must not reset the audio queue or invalidate the active snapshot listener.
  if(!sameApprovedIdentity)revokeView();
  if(!user)return;
  try{
    await reload(user);await getIdToken(user,true);
    const snap=await getDocFromServer(doc(db,'users',user.uid));
    if(ticket!==generation || auth.currentUser?.uid!==user.uid)return;
    const profile=snap.exists()?snap.data():null;
    if(!approvedTeam(user,profile)){revokeView();return;}
    if(sameApprovedIdentity){
      STATE.profile=profile; // keep audio, hearts and Firestore listener intact
      return;
    }
    STATE.uid=user.uid;STATE.profile=profile;
    // Rule gate: until own collection really loads, NO hearts or playlist door.
    const mySubscription=subscriptionGeneration;
    unsub=onSnapshot(collection(db,'users',user.uid,'favorites'),snapshot=>{
      if(mySubscription!==subscriptionGeneration||STATE.uid!==user.uid)return;
      STATE.items=newestFirst(snapshot.docs.map(x=>({id:x.id,...x.data()})).filter(x=>cleanSong(x)));
      STATE.ready=true;sync();
    },()=>{if(mySubscription===subscriptionGeneration){revokeView();notice('Playlist temporarily unavailable. Please try again later.');}});
  }catch(_){if(ticket===generation)revokeView();}
}
onAuthStateChanged(auth,user=>{const ticket=++generation;void confirmUser(user,ticket);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&auth.currentUser){const ticket=++generation;void confirmUser(auth.currentUser,ticket);}});
// Recheck privilege independently at a bounded interval; Firestore rules remain
// the authority on every read/write. Avoid clearing controls every minute.
setInterval(()=>{if(auth.currentUser){const ticket=++generation;void confirmUser(auth.currentUser,ticket);}},300000);
function stableFor(s){return STATE.items.find(x=>x.play_url===s.play_url);}
function songFromSongRow(row){
  const el=row.querySelector('.btn.play[data-stream]');
  return cleanSong({play_url:el?.dataset.stream,title:row.querySelector('.s-title,.feat-title')?.textContent||el?.dataset.title,
    artist:artistFromCard(row.querySelector('.s-by,.feat-by')?.textContent)});
}
function songFromSearchRow(row){const play=row.querySelector('.tscms-search-play[data-stream]');const metadata=row.querySelector('.tscms-search-meta')?.textContent||'';
  return cleanSong({play_url:play?.dataset.stream,title:play?.dataset.title||row.querySelector('strong')?.textContent,artist:metadata.split(' · Week of ')[0]});
}
function createHeart(song){
  const button=document.createElement('button');button.type='button';button.className='tc-fav-heart';
  button.dataset.stream=song.play_url;button.dataset.artist=song.artist;button.dataset.title=song.title;
  button.addEventListener('click',()=>void toggle(song,button));styleHeart(button,song);return button;
}
function styleHeart(button,song){
  const active=Boolean(stableFor(song));button.textContent=active?'♥ Saved':'♡ Save';button.setAttribute('aria-pressed',String(active));
  button.setAttribute('aria-label',(active?'Remove ':'Save ')+song.title+' by '+song.artist+(active?' from':' to')+' my playlist');
}
async function toggle(song,button){
  if(!signedIn()||pending)return;
  const found=stableFor(song);if(!found&&currentCount()>=MAX_SAVED){announce('Playlist is full.');return;}
  pending=true;if(button)button.disabled=true;
  try{
    if(found)await deleteDoc(doc(db,'users',STATE.uid,'favorites',found.id));
    else {const id=await songKey(song.play_url);await setDoc(doc(db,'users',STATE.uid,'favorites',id),{...song,savedAt:serverTimestamp()});}
    // Firestore's onSnapshot confirms persisted state; do not fabricate success while pending.
    if(!found)announce('Saved to your playlist',true);
    else announce('Removed from your playlist');
  }catch(_){announce('Could not update your playlist. Please try again.');}
  finally{pending=false;if(button)button.disabled=false;}
}
// Feedback is separately fixed to the bottom-right with a higher z-index.
// The save action must remain visibly above that button, including enlarged
// font settings, Chrome/Brave viewport changes, and floating safe-area insets.
function positionToastAboveFeedback(box){
  if(!box || !box.isConnected)return;
  box.style.removeProperty('--tc-fav-toast-bottom');
  const feedback=byId('tscms-fb-btn');
  if(!feedback || typeof feedback.getBoundingClientRect!=='function')return;
  const rect=feedback.getBoundingClientRect();
  const height=window.innerHeight || document.documentElement.clientHeight;
  // Only reserve space when Feedback is a visible, lower-screen control.
  if(rect.width>0 && rect.height>0 && rect.top>height*.45 && rect.top<height && rect.bottom>height*.55){
    const bottom=Math.ceil(height-rect.top+14);
    box.style.setProperty('--tc-fav-toast-bottom',bottom+'px');
  }
}
function repositionActiveToast(){
  const box=document.querySelector('.tc-fav-toast');if(box)positionToastAboveFeedback(box);
}
window.addEventListener('resize',repositionActiveToast,{passive:true});
window.visualViewport?.addEventListener('resize',repositionActiveToast,{passive:true});
function announce(msg,withLink=false){
  document.querySelector('.tc-fav-toast')?.remove();const box=document.createElement('div');box.className='tc-fav-toast';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  const t=document.createElement('span');t.textContent=msg;box.append(t);
  if(withLink){const a=document.createElement('a');a.href='./my-playlist.html';a.target='_self';a.textContent='View my playlist';a.className='tc-fav-toast-link';box.append(a);}
  const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Dismiss playlist notification');close.textContent='×';close.addEventListener('click',()=>box.remove());box.append(close);document.body.append(box);
  positionToastAboveFeedback(box);
  requestAnimationFrame(()=>positionToastAboveFeedback(box));
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.remove(),6500);
}
function addDoor(){
  // This page IS My Playlist: do not prepend a redundant self-link into its approved illustrated masthead.
  if(byId('tc-fav-playlist-root'))return;
  const host=document.querySelector('header,.tc-signed-in,.tscms-search-wrap,.main,#tc-fav-playlist-root');
  if(host&&!host.querySelector('.tc-fav-door')){
    const row=document.createElement('div');row.className='tc-fav-toolbar';
    const name=document.createElement('span');name.textContent=String(STATE.profile?.fullName||STATE.profile?.username||'Team member');
    const a=document.createElement('a');a.href='./my-playlist.html';a.target='_self';a.className='tc-fav-door';a.textContent='♥ My Playlist ('+currentCount()+')';row.append(name,a);host.prepend(row);
  }
  each('.tc-fav-door',a=>a.textContent='♥ My Playlist ('+currentCount()+')');
  // Quick Jump itself has no static item: zero signed-out playlist doors in DOM.
  for(const container of document.querySelectorAll('.tscms-qj-desktop,.tscms-qj-drawer-links')){
    let a=container.querySelector('.tc-fav-qj-link');
    if(!a){a=document.createElement('a');a.className='tc-fav-qj-link';a.href='./my-playlist.html';a.target='_self';container.append(a);}
    a.textContent='♥ My Playlist ('+currentCount()+')';
  }
}
function injectRows(){
  const rows=[...document.querySelectorAll('.daypanel .song,.feat,.tscms-search-result')];
  for(const row of rows){
    const song=row.classList.contains('tscms-search-result')?songFromSearchRow(row):songFromSongRow(row);
    if(!song)continue;
    const box=row.querySelector('.s-links,.tscms-search-actions')||row;
    let button=box.querySelector('.tc-fav-heart');
    if(!button){button=createHeart(song);box.append(button);}else styleHeart(button,song);
  }
}
/* Approved Gate A: all filtering and ordering uses ONLY STATE.items,
   the authenticated owner's already-loaded Firestore collection.
   Public station files below supply link enrichment ONLY, not saved-song results. */
const roomCompare=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
let roomMetadata=null,roomMetadataPending=null,roomView='list';
function normalized(text){
  return String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
}
function verifiedLink(url,kind){
  if(typeof url!=='string')return false;
  try{
    const parsed=new URL(url);
    if(parsed.protocol!=='https:')return false;
    const host=parsed.hostname.toLowerCase();
    return kind==='post'
      ? ['facebook.com','www.facebook.com','m.facebook.com'].includes(host)&&parsed.pathname!=='/'
      : ['suno.com','www.suno.com'].includes(host)&&(parsed.pathname.startsWith('/song/')||parsed.pathname.startsWith('/s/'))&&parsed.pathname.split('/').filter(Boolean).length>=2;
  }catch(_){return false;}
}
function indexExtras(){
  if(roomMetadataPending)return roomMetadataPending;
  // Exact stream matching only. Never synthesize source URLs or change favorites.
  roomMetadataPending=Promise.allSettled([
    fetch('./search-index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('archive unavailable');return r.json();}),
    fetch('./radio-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog unavailable');return r.json();})
  ]).then(results=>{
    const entries=new Map();
    const key=s=>String(s||'').trim();
    if(results[0].status==='fulfilled'&&Array.isArray(results[0].value?.songs)){
      for(const item of results[0].value.songs){
        if(!item?.play_url||!verifiedLink(item.post_url,'post'))continue;
        const s=key(item.play_url),existing=entries.get(s)||{};
        entries.set(s,{...existing,post:item.post_url});
      }
    }
    if(results[1].status==='fulfilled'&&Array.isArray(results[1].value?.playlist)){
      for(const item of results[1].value.playlist){
        if(!item?.stream||!verifiedLink(item.suno,'suno'))continue;
        const s=key(item.stream),existing=entries.get(s)||{};
        entries.set(s,{...existing,suno:item.suno});
      }
    }
    roomMetadata=entries;
    if(signedIn())updateRoomLinks();
    return entries;
  }).catch(()=>{roomMetadata=new Map();return roomMetadata;});
  return roomMetadataPending;
}
function updateRoomLinks(){
  if(!signedIn()||!roomMetadata)return;
  const root=byId('tc-fav-playlist-list');if(!root)return;
  for(const row of root.querySelectorAll('.tc-fav-row')){
    // Rows exist only for the signed-in owner's saved streams.
    const extras=roomMetadata.get(row.dataset.stream)||{};
    for(const [field,kind,caption] of [['post','post','View Post'],['suno','suno','Suno']]){
      const prior=row.querySelector('.tc-room-'+field);
      if(!prior)continue;
      let replacement;
      if(verifiedLink(extras[field],kind)){
        replacement=document.createElement('a');
        replacement.href=extras[field];replacement.target='_blank';
        replacement.rel='noopener noreferrer';
        replacement.textContent=caption+' ↗';
        replacement.setAttribute('aria-label',caption+' for '+row.dataset.title+' by '+row.dataset.artist);
      }else{
        replacement=document.createElement('span');
        replacement.className='tc-room-unavailable';
        replacement.textContent=caption+' unavailable';
        replacement.setAttribute('aria-label',caption+' link unavailable for this saved song');
      }
      replacement.classList.add('tc-room-'+field);
      prior.replaceWith(replacement);
    }
  }
}
function savedDate(song){
  let timestamp=null;
  if(song.savedAt && typeof song.savedAt.seconds==='number')timestamp=new Date(song.savedAt.seconds*1000);
  else if(song.savedAt && typeof song.savedAt.toDate==='function')timestamp=song.savedAt.toDate();
  if(!timestamp||!Number.isFinite(timestamp.getTime()))return '';
  return ' · Saved '+timestamp.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Chicago'});
}
function applyRoomView(){
  const root=byId('tc-fav-playlist-list');if(!root||!signedIn())return;
  root.classList.toggle('tc-room-grid',roomView==='grid');
  for(const [id,value] of [['tc-room-list-view','list'],['tc-room-grid-view','grid']]){
    byId(id)?.setAttribute('aria-pressed',String(roomView===value));
  }
}
function applyRoomFilters(){
  if(!signedIn())return;
  const root=byId('tc-fav-playlist-list');if(!root)return;
  const query=normalized(byId('tc-room-search')?.value);
  const sort=byId('tc-room-sort')?.value||'newest';
  const rows=[...root.querySelectorAll('.tc-fav-row')];
  rows.sort((a,b)=>{
    if(sort==='title')return roomCompare.compare(a.dataset.title,b.dataset.title)||Number(a.dataset.order)-Number(b.dataset.order);
    if(sort==='artist')return roomCompare.compare(a.dataset.artist,b.dataset.artist)||Number(a.dataset.order)-Number(b.dataset.order);
    return Number(a.dataset.order)-Number(b.dataset.order);
  });
  let visible=0;
  for(const row of rows){
    const keep=!query||normalized(row.dataset.title).includes(query)||normalized(row.dataset.artist).includes(query);
    row.hidden=!keep;if(keep)visible++;
    root.appendChild(row); // Reorder existing nodes: never replace audio-active song buttons.
  }
  root.querySelector('.tc-room-no-results')?.remove();
  if(rows.length&&!visible){
    const empty=document.createElement('p');empty.className='tc-room-no-results';empty.textContent='No records in your crate match that search.';
    root.appendChild(empty);
  }
  if(currentCount())notice(query?visible+' of '+currentCount()+' saved records match your search.':currentCount()+' songs saved in your crate.');
  applyRoomView();
}
function shuffleRoomRecord(){
  if(!signedIn())return;
  const saved=source();if(!saved.length)return;
  // Bias-free bounded selection when Web Crypto is available; Math.random fallback.
  let index=Math.floor(Math.random()*saved.length);
  if(window.crypto?.getRandomValues){
    const v=new Uint32Array(1),range=0x100000000,limit=range-(range%saved.length);
    do{crypto.getRandomValues(v);}while(v[0]>=limit);
    index=v[0]%saved.length;
  }
  const song=saved[index],root=byId('tc-fav-playlist-list');
  const row=[...(root?.querySelectorAll('.tc-fav-row')||[])].find(el=>el.dataset.stream===song.play_url);
  let button=row?.querySelector('.tc-fav-row-actions .tc-fav-mode');
  if(!button){
    button=byId('tc-room-shuffle-proxy');
    if(!button){button=document.createElement('button');button.type='button';button.id='tc-room-shuffle-proxy';button.hidden=true;document.body.append(button);}
    button.dataset.stream=song.play_url;button.dataset.title=song.title;button.dataset.artist=song.artist;
  }
  playSong(song,button,row||null); // unchanged per-song playback path
  announce('Random record: '+song.title+' by '+song.artist);
}
function installRoomTools(){
  const search=byId('tc-room-search'),sort=byId('tc-room-sort');
  if(search&&!search.dataset.wired){search.dataset.wired='1';search.addEventListener('input',applyRoomFilters);}
  if(sort&&!sort.dataset.wired){sort.dataset.wired='1';sort.addEventListener('change',applyRoomFilters);}
  for(const [id,value] of [['tc-room-list-view','list'],['tc-room-grid-view','grid']]){
    const button=byId(id);
    if(button&&!button.dataset.wired){button.dataset.wired='1';button.addEventListener('click',()=>{roomView=value;applyRoomView();});}
  }
}
function playlist(){
  const root=byId('tc-fav-playlist-list');if(!root)return;
  root.replaceChildren();
  const actionHolder=byId('tc-room-action-holder');if(actionHolder)actionHolder.replaceChildren();
  const count=currentCount(),plaque=byId('tc-fav-crate-count');
  const filled=byId('tc-room-art-filled'),emptyArt=byId('tc-room-art-empty');
  if(filled)filled.hidden=!count;
  if(emptyArt)emptyArt.hidden=!!count;
  if(plaque){plaque.textContent='Your crate holds '+count+' '+(count===1?'record':'records');plaque.hidden=false;}
  const toolbar=byId('tc-room-tools');if(toolbar)toolbar.hidden=!count;
  installRoomTools();roomConsoleInit();
  notice(count?count+' songs saved, newest first.':'No saved songs yet — tap the heart on any song you love and it’ll be waiting for you here.');
  if(!count){
    const empty=document.createElement('section');empty.className='tc-room-empty';
    const record=document.createElement('div');record.className='tc-room-empty-record';record.setAttribute('aria-hidden','true');
    const title=document.createElement('h2');title.textContent='Your first favorite belongs here.';
    const hint=document.createElement('p');hint.textContent='The crate is ready. Explore today’s songs and save one you love.';
    const door=document.createElement('a');door.href='./';door.className='tc-room-door';door.textContent='Browse Today’s Songs →';
    empty.append(record,title,hint,door);root.append(empty);return;
  }
  const playAll=document.createElement('button');playAll.type='button';playAll.className='tc-fav-mode';playAll.textContent='▶ Play All';playAll.addEventListener('click',()=>playSequence());root.append(playAll);
  // Reposition original button without changing its callback or the sequence player.
  playAll.textContent='▶ Play My Crate';
  if(actionHolder)actionHolder.append(playAll);
  const shuffle=document.createElement('button');shuffle.type='button';shuffle.className='tc-room-shuffle';
  shuffle.textContent='⇄ Shuffle a Record';shuffle.addEventListener('click',shuffleRoomRecord);
  if(actionHolder)actionHolder.append(shuffle);
  for(const [order,song] of source().entries()){
    const row=document.createElement('div');row.className='tc-fav-row';
    row.dataset.stream=song.play_url;row.dataset.title=song.title;
    row.dataset.artist=song.artist;row.dataset.order=String(order);
    const sleeve=document.createElement('div');sleeve.className='tc-room-thumb';
    sleeve.dataset.style=String(order%4);sleeve.setAttribute('aria-hidden','true');
    const info=document.createElement('div');info.className='tc-room-song-info';
    const title=document.createElement('strong');title.textContent=song.title;
    const artist=document.createElement('div');artist.className='tc-room-meta';
    artist.textContent=song.artist+savedDate(song);info.append(title,artist);
    const actions=document.createElement('div');actions.className='tc-fav-row-actions';
    const play=document.createElement('button');play.type='button';play.className='tc-fav-mode';
    play.dataset.stream=song.play_url;play.dataset.title=song.title;play.dataset.artist=song.artist;
    play.textContent='▶ Play';play.setAttribute('aria-label','Play '+song.title+' by '+song.artist);
    play.addEventListener('click',()=>void playSong(song,play,row));
    actions.append(play);
    const more=document.createElement('details');more.className='tc-room-more';
    const summary=document.createElement('summary');summary.textContent='⋮';
    summary.setAttribute('aria-label','More options for '+song.title+' by '+song.artist);
    const menu=document.createElement('div');menu.className='tc-room-menu';
    for(const [cls,label] of [['post','View Post'],['suno','Suno']]){
      const unavailable=document.createElement('span');unavailable.className='tc-room-'+cls+' tc-room-unavailable';
      unavailable.textContent=label+' unavailable';menu.append(unavailable);
    }
    const remove=document.createElement('button');remove.type='button';remove.className='tc-fav-remove';
    remove.textContent='× Remove';remove.setAttribute('aria-label','Remove '+song.title+' by '+song.artist+' from my playlist');
    remove.addEventListener('click',()=>void toggle(song,remove));
    menu.append(remove);more.append(summary,menu);row.append(sleeve,info,actions,more);root.append(row);
  }
  updateRoomLinks();applyRoomFilters();void indexExtras();
}
/* ROOM PLAYER (Oct 24 2026, Fudgie's morning notes): the room owns its
   audio. dayPlay's white bar never appears here; the console transport
   + equalizer glow are the control. The sitewide station pauses itself
   when this plays and pauses this when it starts (its own
   coordination), so the two never talk over each other. */
let roomAudio=null,roomNow=null,roomQueue=null,roomIndex=-1,roomSeq=false;
function roomPlayer(){
  if(roomAudio)return roomAudio;
  const a=document.createElement('audio');a.id='tc-room-player';a.preload='none';a.hidden=true;document.body.append(a);
  a.addEventListener('play',()=>roomSyncState(true));
  a.addEventListener('pause',()=>roomSyncState(false));
  a.addEventListener('ended',()=>{if(roomSeq)roomStep(1);else roomSyncState(false);});
  a.addEventListener('error',()=>{roomPlayError(roomNow?.row||null);if(roomSeq)roomStep(1);});
  roomAudio=a;return a;
}
function roomRowFor(song){
  const root=byId('tc-fav-playlist-list');if(!root)return null;
  return [...root.querySelectorAll('.tc-fav-row')].find(el=>el.dataset.stream===song.play_url)||null;
}
function roomSyncState(playing){
  const fig=byId('tc-room-console');if(fig)fig.classList.toggle('tc-console-on',playing);
  const root=byId('tc-fav-playlist-root');if(root)root.classList.toggle('tc-room-playing',playing);
  const playBtn=fig?.querySelector('.tc-console-play');
  if(playBtn)playBtn.setAttribute('aria-label',playing?'Pause':'Play');
  document.querySelectorAll('.tc-fav-row').forEach(r=>{
    const b=r.querySelector('.tc-fav-row-actions .tc-fav-mode');
    const on=playing&&roomNow&&r.dataset.stream===roomNow.song.play_url;
    r.classList.toggle('tc-fav-row-playing',!!on);
    if(b){b.textContent=on?'⏸ Pause':'▶ Play';
      b.setAttribute('aria-label',(on?'Pause ':'Play ')+(r.dataset.title||'this song')+(r.dataset.artist?' by '+r.dataset.artist:''));}
  });
}
function roomPlayError(row){
  const msg="This one can't play right now";
  if(row){let p=row.querySelector('.tc-fav-play-error');if(!p){p=document.createElement('p');p.className='tc-fav-play-error';p.setAttribute('role','status');row.append(p);}p.textContent=msg;}
  else announce(msg);
}
function roomStart(song,seq){
  const a=roomPlayer();roomNow={song,row:roomRowFor(song)};roomSeq=seq;
  a.src=song.play_url;
  a.play().catch(()=>{roomPlayError(roomNow.row);});
}
function playSong(song,button,row){
  const a=roomPlayer();
  if(roomNow&&roomNow.song.play_url===song.play_url){
    if(!a.paused){a.pause();return;}
    a.play().catch(()=>roomPlayError(roomNow.row));return;
  }
  roomStart(song,false);
}
function playSequence(){
  const queue=[...source()];if(!queue.length)return;
  roomQueue=queue;roomIndex=-1;roomStep(1);
}
function roomStep(dir){
  if(!roomQueue)return;roomIndex+=dir;
  if(roomIndex<0)roomIndex=0;
  if(roomIndex>=roomQueue.length){roomQueue=null;roomSeq=false;roomSyncState(false);return;}
  roomStart(roomQueue[roomIndex],true);
}
function roomConsoleInit(){
  const fig=byId('tc-room-console');if(!fig||fig.dataset.wired)return;fig.dataset.wired='1';
  fig.querySelector('.tc-console-play')?.addEventListener('click',()=>{
    const a=roomPlayer();
    if(roomNow&&!a.paused){a.pause();return;}
    if(roomNow&&a.paused&&a.src){a.play().catch(()=>roomPlayError(roomNow.row));return;}
    if(source().length)playSequence();
  });
  fig.querySelector('.tc-console-prev')?.addEventListener('click',()=>{
    if(roomQueue)roomStep(-1);
    else if(roomNow){const list=source();const i=list.findIndex(s=>s.play_url===roomNow.song.play_url);if(i>0)roomStart(list[i-1],false);}
  });
  fig.querySelector('.tc-console-next')?.addEventListener('click',()=>{
    if(roomQueue)roomStep(1);
    else if(roomNow){const list=source();const i=list.findIndex(s=>s.play_url===roomNow.song.play_url);if(i>=0&&i<list.length-1)roomStart(list[i+1],false);}
  });
}

function gamehouse(){
  const J=window.TSCMSJukebox;if(!J)return;
  const host=byId('tscms-v7-modal-host');if(!host?.shadowRoot)return;
  const shadow=host.shadowRoot,overlay=shadow.getElementById('jukebox');if(!overlay||shadow.getElementById('tc-fav-game-controls'))return;
  const box=document.createElement('section');box.id='tc-fav-game-controls';box.className='tc-fav-game-controls';
  box.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:clamp(8px,3vh,28px);z-index:10;padding:7px;max-width:94vw;display:flex;flex-wrap:wrap;gap:7px;justify-content:center;border:1px solid #edc780;border-radius:9px;background:#21150deb;color:#fff4d1;font:700 13px system-ui';
  const heart=document.createElement('button');heart.type='button';heart.className='tc-fav-heart';
  const mode=document.createElement('button');mode.type='button';mode.className='tc-fav-mode';
  const remove=document.createElement('button');remove.type='button';remove.className='tc-fav-remove';remove.textContent='Remove saved track';
  const style='min-height:44px;padding:6px 10px;border:2px solid #c69d63;border-radius:8px;background:#422710;color:#ffe7aa;font:700 13px system-ui;';for(const e of [heart,mode,remove])e.style.cssText=style;
  const track=()=>{const x=J.currentTrack();return cleanSong({title:x?.title,artist:x?.artist||'TSCMS Radio',play_url:x?.stream});};
  const refresh=()=>{const song=track();heart.disabled=!song;remove.disabled=!song||!stableFor(song);if(song){styleHeart(heart,song);remove.setAttribute('aria-label','Remove '+song.title+' by '+song.artist+' from Favorites');}mode.textContent=J.isFavoritesMode?.()?'♫ Favorites PLAYING':'♫ Play Favorites ('+currentCount()+')';};
  heart.addEventListener('click',async()=>{const song=track();if(song)await toggle(song,heart);refresh();});
  remove.addEventListener('click',async()=>{const song=track();if(song && stableFor(song))await toggle(song,remove);refresh();});
  mode.addEventListener('click',()=>{if(!J.setFavoritesPlaylist)return announce('Jukebox Favorites integration unavailable.');
    if(J.isFavoritesMode())J.restoreStationPlaylist({play:false});
    else if(source().length)J.setFavoritesPlaylist(source().map(s=>({title:s.title,artist:s.artist,stream:s.play_url})),{play:true});else announce('Save a song first.');refresh();});
  box.append(heart,mode,remove);shadow.append(box);refresh();lastGameRefresh=refresh;document.addEventListener('tscms:jukebox:trackchange',refresh);
}
function sync(){if(!signedIn())return;try{scanning=true;addDoor();injectRows();playlist();gamehouse();}finally{scanning=false;}}
function schedule(){if(scanScheduled||scanning||!signedIn())return;scanScheduled=true;queueMicrotask(()=>{scanScheduled=false;sync();});}
new MutationObserver(muts=>{if(scanning)return;
  if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1 && (n.matches?.('.daypanel .song,.tscms-search-result,#tscms-v7-modal-host') || n.querySelector?.('.daypanel .song,.tscms-search-result,#tscms-v7-modal-host')))))schedule();
}).observe(document.documentElement,{subtree:true,childList:true});
// A revoke makes the client view disappear immediately; server Security Rules enforce ownership.
window.TSCMSFavoritesPilot={isApproved:()=>signedIn(),getCount:()=>signedIn()?currentCount():0};
