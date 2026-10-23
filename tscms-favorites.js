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
  each('.tc-fav-heart,.tc-fav-door,.tc-fav-toolbar,.tc-fav-toast,.tc-fav-qj-link',el=>el.remove());
  byId('tscms-v7-modal-host')?.shadowRoot?.getElementById('tc-fav-game-controls')?.remove();
  if(lastGameRefresh){document.removeEventListener('tscms:jukebox:trackchange',lastGameRefresh);lastGameRefresh=null;}
  // If access is removed, immediately exit the private queue; no saved track
  // may remain queued in the shared jukebox after sign-out or revocation.
  if(window.TSCMSJukebox?.isFavoritesMode?.()) window.TSCMSJukebox.restoreStationPlaylist?.({play:false});
  const list=byId('tc-fav-playlist-list');if(list)list.replaceChildren();
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
function announce(msg,withLink=false){
  document.querySelector('.tc-fav-toast')?.remove();const box=document.createElement('div');box.className='tc-fav-toast';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  const t=document.createElement('span');t.textContent=msg;box.append(t);
  if(withLink){const a=document.createElement('a');a.href='./my-playlist.html';a.target='_self';a.textContent='View my playlist';a.className='tc-fav-toast-link';box.append(' ',a);}
  const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Dismiss playlist notification');close.textContent='×';close.addEventListener('click',()=>box.remove());box.append(close);document.body.append(box);
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.remove(),6500);
}
function addDoor(){
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
function playlist(){
  const root=byId('tc-fav-playlist-list');if(!root)return;
  root.replaceChildren();notice(currentCount()?currentCount()+' songs saved, newest first.':'No saved songs yet — tap the heart on any song you love and it’ll be waiting for you here.');
  if(!currentCount())return;
  const playAll=document.createElement('button');playAll.type='button';playAll.className='tc-fav-mode';playAll.textContent='▶ Play All';playAll.addEventListener('click',()=>playSequence());root.append(playAll);
  for(const song of source()){
    const row=document.createElement('div');row.className='tc-fav-row';
    const info=document.createElement('div'),title=document.createElement('strong');title.textContent=song.title;
    const artist=document.createElement('div');artist.textContent=song.artist;info.append(title,artist);
    const actions=document.createElement('div');actions.className='tc-fav-row-actions';
    const play=document.createElement('button');play.type='button';play.className='tc-fav-mode';play.dataset.stream=song.play_url;play.dataset.title=song.title;play.textContent='▶ Play';play.addEventListener('click',()=>void playSong(song,play,row));
    const remove=document.createElement('button');remove.type='button';remove.className='tc-fav-remove';remove.textContent='× Remove';remove.setAttribute('aria-label','Remove '+song.title+' by '+song.artist+' from my playlist');remove.addEventListener('click',()=>void toggle(song,remove));
    actions.append(play,remove);row.append(info,actions);root.append(row);
  }
}
function playSong(song,button,row){
  if(!window.dayPlay){announce('TSCMS player is not ready.');return;}
  const prior=byId('tscms-song-player');
  const onError=()=>{
    const msg="This one can't play right now";
    if(row){let p=row.querySelector('.tc-fav-play-error');if(!p){p=document.createElement('p');p.className='tc-fav-play-error';p.setAttribute('role','status');row.append(p);}p.textContent=msg;}
    else announce(msg);
  };
  if(prior)prior.addEventListener('error',onError,{once:true});
  window.dayPlay(button);
  const current=byId('tscms-song-player');
  if(current && current!==prior)current.addEventListener('error',onError,{once:true});
}
function playSequence(){
  const queue=[...source()];if(!queue.length)return;playlistQueue=queue;
  let index=0;
  function next(){if(!playlistQueue||index>=queue.length){playlistQueue=null;return;}
    const song=queue[index++];const button=byId('tc-fav-play-seq')||document.createElement('button');button.id='tc-fav-play-seq';button.dataset.stream=song.play_url;button.dataset.title=song.title;
    button.hidden=true;if(!button.isConnected)document.body.append(button);playSong(song,button,null);
    setTimeout(()=>{const audio=byId('tscms-song-player');if(audio){audio.addEventListener('ended',next,{once:true});audio.addEventListener('error',()=>{announce("This one can't play right now");next();},{once:true});}},0);
  }
  next();
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
