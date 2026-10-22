// TSCMS Phase 2 isolated test-host only. Security is enforced by v5 TEST Firestore rules.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,
  sendSignInLinkToEmail,isSignInWithEmailLink,signInWithEmailLink,
  browserLocalPersistence,inMemoryPersistence,setPersistence,reload,getIdToken} from
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {getFirestore,doc,collection,getDocFromServer,writeBatch,setDoc,updateDoc,
  getDocs,onSnapshot,serverTimestamp,Timestamp} from
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {firebaseConfig,approvedTestRecipients} from './firebase-test-config.js';
import {assertTestOnly,normalizeEmail,inviteToken,recipientCanClaim,pendingProfile,safeInviteUrl,TTL_MS} from './phase2-core.mjs';
const $=id=>document.getElementById(id);
const status=(s)=>{$('status').textContent=s;};
try{assertTestOnly(firebaseConfig,location.hostname);}
catch(err){status(err.message);throw err;}
const app=initializeApp(firebaseConfig,'tcms-phase2-owner-test');
const ownerAuth=getAuth(app),db=getFirestore(app);
const recipientApp=initializeApp(firebaseConfig,'tcms-phase2-recipient-test');
const recipientAuth=getAuth(recipientApp);
await setPersistence(ownerAuth,browserLocalPersistence);
await setPersistence(recipientAuth,inMemoryPersistence);
const token=(new URLSearchParams(location.hash.slice(1))).get('invite')||'';
const isInvite=/^[A-Za-z0-9_-]{43}$/.test(token);
function requireTestRecipient(address){
  const email=normalizeEmail(address);
  if(!Array.isArray(approvedTestRecipients) || !approvedTestRecipients.includes(email))
    throw new Error('TEST destination not allowlisted');
  return email;
}
let stopOwnerFeed=null;
let ownerRequest=0;
function stopFeed(){if(stopOwnerFeed){stopOwnerFeed();stopOwnerFeed=null;}}
function hideOwner(){stopFeed();$('owner-console').hidden=true;$('owner-login').hidden=false;$('invites').replaceChildren();}
async function authorizedOwner(user){
  if(!user)return false;
  await reload(user);await getIdToken(user,true);
  if(!user.emailVerified)return false;
  const profile=await getDocFromServer(doc(db,'users',user.uid));
  if(!profile.exists())return false;
  const p=profile.data();
  return p.owner===true&&p.admin===true&&p.status==='approved';
}
function addElement(parent,tag,content){
  const el=document.createElement(tag);
  el.textContent=content;parent.appendChild(el);return el;
}
async function showOwner(user){
  const ticket=++ownerRequest;
  hideOwner();
  // Auth restoration must use the exact fresh-token/server-profile authorization chain.
  let ok=false;
  try{ok=await authorizedOwner(user);}catch(err){status('TEST Owner validation failed. No invitation controls opened.');}
  if(ticket!==ownerRequest||!ok||ownerAuth.currentUser?.uid!==user?.uid)return;
  $('owner-login').hidden=true;$('owner-console').hidden=false;
  status('Approved TEST Owner signed in. Invitations never grant access.');
  stopOwnerFeed=onSnapshot(collection(db,'invitations'),snap=>{
    if(ownerAuth.currentUser?.uid!==user.uid)return;
    const list=$('invites');list.replaceChildren();
    for(const item of snap.docs){
      const invite=item.data(),row=document.createElement('div');row.className='row';
      addElement(row,'p',invite.email+' · '+invite.status+' · expires '+invite.expiresAt?.toDate?.()?.toLocaleString());
      if(invite.status==='issued'&&invite.expiresAt?.toMillis?.()>Date.now()){
        // Token is disclosed only to the authorized owner UI. Copy/send by an owner-controlled method.
        const link=safeInviteUrl(location.origin,location.pathname,item.id);
        const copy=addElement(row,'button','Copy TEST invitation link');copy.type='button';
        copy.addEventListener('click',async()=>{
          await navigator.clipboard.writeText(link);status('TEST invitation link copied. Send only to its named recipient.');
        });
        const resend=addElement(row,'button','Resend / email-test route');resend.type='button';
        resend.addEventListener('click',async()=>{
          try{
            await updateDoc(doc(db,'invitations',item.id),{lastSentAt:serverTimestamp(),resendCount:invite.resendCount+1});
            // Spark fallback: Owner sends invite through their own email app.
            const to=encodeURIComponent(invite.email);
            const subject=encodeURIComponent('TSCMS — TEST invitation');
            const body=encodeURIComponent('This is an isolated test invitation. Link: '+link+
              '\nIt does not approve an Admin account; Fudgie must approve requests.');
            location.href='mailto:'+to+'?subject='+subject+'&body='+body;
            status('Opened your email app. You must tap Send; no email was sent by this page.');
          }catch(err){status('Resend denied or unavailable. Test invite unchanged.');}
        });
        const revoke=addElement(row,'button','Revoke this TEST invitation');revoke.type='button';
        revoke.addEventListener('click',async()=>{
          if(!confirm('Revoke this TEST invitation? Its link will stop working.'))return;
          try{await updateDoc(doc(db,'invitations',item.id),{status:'revoked'});status('Invitation revoked in TEST project.');}
          catch(err){status('Revocation was denied. Please inspect TEST rules.');}
        });
      }
      list.appendChild(row);
    }
    if(!snap.docs.length)addElement(list,'p','No TEST invitations yet.');
  },()=>{stopFeed();status('Owner invitation feed failed; controls require revalidation.');$('owner-console').hidden=true;});
}
onAuthStateChanged(ownerAuth,async user=>{
  if(!user){ownerRequest++;hideOwner();status('Sign in with approved TEST Owner credentials.');return;}
  try{await showOwner(user);}catch(_){ownerRequest++;hideOwner();status('TEST Owner authentication failed closed.');}
});
$('owner-login').addEventListener('submit',async ev=>{
  ev.preventDefault();
  try{
    const email=normalizeEmail($('owner-email').value);
    const result=await signInWithEmailAndPassword(ownerAuth,email,$('owner-password').value);
    $('owner-password').value='';
    await showOwner(result.user);
  }catch(err){status('Sign-in failed; verify TEST Owner account.');}
});
$('owner-signout').addEventListener('click',async()=>{
  ownerRequest++;hideOwner();
  await signOut(ownerAuth);location.reload();
});
$('invite-form').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const user=ownerAuth.currentUser;
  try{
    if(!await authorizedOwner(user))throw Error('Owner no longer approved');
    const email=requireTestRecipient($('invite-email').value);
    const id=inviteToken(crypto);
    await setDoc(doc(db,'invitations',id),{email,createdBy:user.uid,status:'issued',
      createdAt:serverTimestamp(),lastSentAt:serverTimestamp(),resendCount:0,
      expiresAt:Timestamp.fromMillis(Date.now()+TTL_MS)});
    $('invite-email').value='';
    status('Single-use TEST invitation issued. No recipient signed up or approved. Copy/send link from list.');
  }catch(_){status('TEST invite creation blocked; check project, Owner identity, or rules.');}
});
if(isInvite){
  $('owner').hidden=true;$('recipient').hidden=false;
  status('TEST invitation detected. Verify your exact recipient email using the email sign-in link.');
} else {
  $('owner').hidden=false;$('recipient').hidden=true;
}
$('request-email').addEventListener('submit',async ev=>{
  ev.preventDefault();
  try{
    if(!isInvite)throw Error('Invalid invitation');
    const email=requireTestRecipient($('recipient-email').value);
    if(isSignInWithEmailLink(recipientAuth,location.href)){
      const user=(await signInWithEmailLink(recipientAuth,email,location.href)).user;
      await reload(user);await getIdToken(user,true);
      if(!user.emailVerified||normalizeEmail(user.email)!==email)throw Error('Verified email mismatch');
      const snap=await getDocFromServer(doc(db,'invitations',token));
      if(!snap.exists()||!recipientCanClaim(snap.data(),email,Date.now()))throw Error('Invalid/expired invite');
      $('request-email').hidden=true;$('redeem').hidden=false;
      // Wipe Firebase one-time authorization code from location after use.
      history.replaceState(null,'',location.pathname+'#invite='+encodeURIComponent(token));
      status('Email verified. Submit a PENDING request; Fudgie still approves it.');
    }else{
      const url=safeInviteUrl(location.origin,location.pathname,token);
      await sendSignInLinkToEmail(recipientAuth,email,{url,handleCodeInApp:true});
      status('If eligible, follow the TEST sign-in email. No Admin access has been granted.');
    }
  }catch(_){status('TEST email-link check failed or expired. No access was granted.');}
});
if(isInvite && isSignInWithEmailLink(recipientAuth,location.href)){
  $('request-email').querySelector('button').textContent='Verify email sign-in link';
}
$('recipient-signup').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const user=recipientAuth.currentUser;
  try{
    if(!user?.emailVerified)throw Error('Verified recipient required');
    await reload(user);await getIdToken(user,true);
    const invitation=await getDocFromServer(doc(db,'invitations',token));
    if(!invitation.exists()||!recipientCanClaim(invitation.data(),user.email,Date.now()))throw Error('Invite expired');
    const createdAt=serverTimestamp();
    const profile=pendingProfile({authUser:user,fullName:$('full-name').value,
      username:$('user-name').value,inviteId:token,createdAt});
    const batch=writeBatch(db);
    batch.set(doc(db,'users',user.uid),profile);
    batch.set(doc(db,'usernames',profile.username),{uid:user.uid,createdAt});
    batch.update(doc(db,'invitations',token),{status:'used',claimUid:user.uid,usedAt:serverTimestamp()});
    await batch.commit();
    $('redeem').hidden=true;
    status('TEST request submitted and PENDING. You do not have Admin access until Fudgie approves.');
  }catch(_){status('TEST invitation submission denied. No access granted. Contact Fudgie.');}
});
