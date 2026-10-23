/* TSCMS owner-only Favorites pilot totals — STAGING. Aggregate data is
 * calculated inside a privileged callable Function, never from other users'
 * favorites in a public browser. No UI inserted until verified owner profile.
 */
import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {getAuth,onAuthStateChanged,reload} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {getFirestore,doc,getDocFromServer} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-functions.js';
import {tscmsFirebaseConfig} from './firebase-admin-config.js';
const app=getApps().length?getApp():initializeApp(tscmsFirebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
let epoch=0,panel=null;
function clear(){if(panel){panel.remove();panel=null;}}
function render(totals){
  clear();
  const host=document.getElementById('adminbody');
  if(!host)return;
  const section=document.createElement('section');section.className='tc-owner-favorites-aggregate';
  section.setAttribute('aria-label','Owner Favorites pilot summary');
  section.style.cssText='border:2px solid #cca45d;border-radius:12px;margin:14px auto;padding:16px;max-width:880px;background:#25190f;color:#fceac8;font:15px/1.5 system-ui,sans-serif';
  const heading=document.createElement('h2');heading.textContent='♥ Favorites pilot · Team totals';heading.style.cssText='margin:0 0 9px;font:700 19px Georgia,serif';
  const copy=document.createElement('p');copy.setAttribute('role','status');copy.setAttribute('aria-live','polite');copy.style.margin='0';
  const valid=totals&&Number.isSafeInteger(totals.totalHearts)&&totals.totalHearts>=0&&Number.isSafeInteger(totals.activeMembers)&&totals.activeMembers>=0;
  copy.textContent=valid
   ? totals.totalHearts+' hearts saved by '+totals.activeMembers+' team members · Checked '+String(totals.countedAt||'time unavailable')
   : 'Favorites team totals unavailable — not verified.';
  section.append(heading,copy);host.prepend(section);panel=section;
}
async function checkOwner(user,ticket){
  clear();
  if(!user)return;
  try{
    await reload(user);
    if(ticket!==epoch||!auth.currentUser||auth.currentUser.uid!==user.uid||!user.emailVerified)return;
    const snap=await getDocFromServer(doc(db,'users',user.uid));
    if(ticket!==epoch||!auth.currentUser||auth.currentUser.uid!==user.uid)return;
    const p=snap.exists()?snap.data():null;
    if(p?.status!=='approved'||p?.owner!==true)return;
    render(null);
    const fn=httpsCallable(getFunctions(app,'us-central1'),'getTeamFavoritesAggregate');
    const result=await fn({});
    if(ticket===epoch && auth.currentUser?.uid===user.uid)render(result.data);
  }catch(_){if(ticket===epoch&&panel)render(null);}
}
onAuthStateChanged(auth,user=>{const ticket=++epoch;void checkOwner(user,ticket);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&auth.currentUser){const ticket=++epoch;void checkOwner(auth.currentUser,ticket);}});
