// STRICT TEST-ONLY copied candidate: phase2-owner improvements + live pending inbox.
// Reference original production tscms-admin-dual.js unchanged; do NOT merge this file into main.
/* STAGING-ONLY: TSCMS dual-mode Admin. Keep old PIN in mc.js unchanged.
   NO production deployment without Owner approval, verified rules and v2 bundle QA. */
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,
  sendEmailVerification,sendPasswordResetEmail,reload,signOut,getIdToken,setPersistence,inMemoryPersistence,browserLocalPersistence,onAuthStateChanged,deleteUser} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {getFirestore,doc,collection,writeBatch,serverTimestamp,
  getDocFromServer,getDocs,onSnapshot,updateDoc} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {firebaseConfig as tscmsFirebaseConfig} from "./firebase-test-config.js";
if(tscmsFirebaseConfig.projectId!=="tscms-admin-login-test" ||
   !tscmsFirebaseConfig.apiKey || tscmsFirebaseConfig.apiKey.includes("REQUIRED") ||
   ["tscmsradio.com","www.tscmsradio.com"].includes(location.hostname))
  throw new Error("TEST-ONLY build REFUSES production or missing Firebase test configuration");

// Separate in-memory Auth context: registering staff must NEVER sign out the Owner.
const app=initializeApp(tscmsFirebaseConfig),auth=getAuth(app),db=getFirestore(app);
const registrationApp=initializeApp(tscmsFirebaseConfig,"tcms-staff-registration");
const signupAuth=getAuth(registrationApp),signupDb=getFirestore(registrationApp);
const gate=document.getElementById("admingate"),adminBody=document.getElementById("adminbody");
if(!gate||!adminBody||!gate.querySelector(".staff-panel"))throw new Error("Admin page structure changed");
const styles=document.createElement("style");
styles.textContent=".tc-auth{max-width:480px;margin:20px auto;padding:20px;background:#201b17;color:#fff0d3;border:1px solid #ad884c;border-radius:14px;font:15px system-ui,sans-serif}"
+".tc-auth h2{color:#ffda8d;margin:0 0 8px}.tc-auth p{line-height:1.5}.tc-auth label{display:block;font-size:13px;margin-top:12px}"
+".tc-auth input{width:100%;box-sizing:border-box;min-height:44px;padding:12px;margin:5px 0;background:#101314;color:white;border:1px solid #ac8e5d;border-radius:8px}"
+".tc-auth button,.tc-owner button{min-height:44px;margin:9px 6px 0 0;padding:9px 15px;background:#dfae54;border:1px solid #edc77d;border-radius:8px;color:#211602;font-weight:700;cursor:pointer}"
+".tc-auth .tc-later{background:#162326;color:#9ae2d9;border-color:#6ebcb1}.tc-auth-status{color:#ffda8d;min-height:20px;font-size:13px;padding:7px 0}"
+"dialog.tc-auth{width:min(95vw,500px);max-height:90vh;overflow:auto;box-shadow:0 10px 45px #000c}"
+"dialog.tc-auth::backdrop{background:#000c}.tc-owner{max-width:940px;margin:12px auto;padding:16px;background:#1d1710;color:#f3e9d2;border:1px solid #c9a227;border-radius:12px}.tc-owner h2{color:#e8c766;margin:0 0 6px;font-size:21px}.tc-owner p{margin:0 0 8px;line-height:1.5}"
 +".tc-owner-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #5a4a26}.tc-owner-waiting{font-weight:700;color:#ffda8d;padding:10px 0 2px;border-top:1px solid #5a4a26}"
+".tc-owner .tc-owner-approved-bar{display:block;width:100%;text-align:left;color:#fff1d4;background:#352715;border-color:#d6b36f;margin:16px 0 3px;white-space:normal;font:700 15px/1.4 system-ui,sans-serif}.tc-owner .tc-owner-approved-bar:focus-visible{outline:3px solid #fff;outline-offset:3px}"
+".tc-owner-approved-list[hidden]{display:none}.tc-owner-approved-list{padding:2px 4px 9px;border:1px solid #604b2a;border-radius:0 0 9px 9px}"
+".tc-owner-other{margin-top:10px}.tc-owner-other-label{font:700 13px/1.5 system-ui,sans-serif;color:#cdb78e;padding-top:11px}"
+".tc-owner button.tc-revoke-armed{background:#a9232a!important;border-color:#ffe0d2!important;color:#fff!important;box-shadow:0 0 0 2px #ff7d73}.tc-owner button.tc-revoke-armed:focus-visible{outline:3px solid white;outline-offset:2px}"
+".tc-signed-in{max-width:940px;margin:14px auto 10px;box-sizing:border-box;padding:14px 20px;border:1px solid #75ad83;border-radius:12px;background:linear-gradient(135deg,#192c21,#152019);color:#e1f5db;font:700 17px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 4px 18px #0005}"
+"button.tc-signout{display:block;min-height:44px;margin:10px auto 24px;padding:11px 28px;border:1px solid #d8a957;border-radius:12px;background:linear-gradient(180deg,#56351a,#25170e);color:#fbe7b8;font:700 15px/1.3 system-ui,sans-serif;box-shadow:0 4px 14px #0007;cursor:pointer}"
+"button.tc-signout:hover,button.tc-signout:focus-visible{background:linear-gradient(180deg,#76481e,#35210e);outline:2px solid #ffd68a;outline-offset:2px}";
document.head.appendChild(styles);
const login=document.createElement("section");
login.className="tc-auth";
login.innerHTML='<h2>Personal Admin Sign In</h2><p>Use the email and password you created for your own login.</p>'
+'<form id="tc-login-form"><label>Email address<input name="email" type="email" autocomplete="username" required></label>'
+'<label>Personal password<input name="password" type="password" autocomplete="current-password" required></label>'
+'<button type="submit">Enter Control Room</button><button class="tc-later" id="tc-reset" type="button">Forgot password?</button></form>'
+'<div id="tc-login-status" class="tc-auth-status" role="status"></div>';
gate.appendChild(login);
const signupSteps=document.createElement("p");
signupSteps.className="tc-registration-status";
signupSteps.style.cssText="max-width:500px;margin:16px auto 26px;padding:0 16px;text-align:center;color:#ffda8d;font:13px/1.6 system-ui,sans-serif";
signupSteps.textContent="How signing up works: create your login → verify your email → wait for Fudgie to approve → sign in. Nobody gets in without Fudgie's OK.";
gate.appendChild(signupSteps);
const dialog=document.createElement("dialog");
dialog.className="tc-auth";
dialog.setAttribute("aria-label","Create your personal Admin account");
dialog.innerHTML='<h2>👑 Create Your Personal Admin Account</h2>'
+'<p>Your PIN has unlocked the Admin Control Room. You may continue using it through October 31. Set up your personal login now for November 1 and later. New accounts require email verification and Fudgie’s approval.</p>'
+'<form id="tc-upgrade-form"><label>Real full name<input name="fullName" autocomplete="name" required maxlength="100"></label>'
+'<label>Choose a display username<input name="username" autocomplete="nickname" pattern="[a-zA-Z0-9_]{3,30}" minlength="3" maxlength="30" required></label>'
+'<label>Private login email<input name="email" type="email" autocomplete="email" required></label>'
+'<label>Personal password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>'
+'<label>Confirm personal password<input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>'
+'<button type="submit">Create Account & Request Approval</button>'
+'<button type="button" class="tc-later" id="tc-resend-verify" hidden>Resend Verification Email</button>'
+'<button type="button" class="tc-later" id="tc-notnow">Not now — continue with PIN</button>'
+'<div id="tc-upgrade-status" class="tc-auth-status" role="status"></div></form>';
document.body.appendChild(dialog);
const loginMsg=document.getElementById("tc-login-status"),signupMsg=document.getElementById("tc-upgrade-status");
const updateStatus=(node,message)=>node.textContent=message;
let pinPrompted=false,firebaseApproved=false,orphanSignupUid=null,registeredUser=null;
function offerPersonalSetupAfterPin(){
  // Observe normal PIN success AND detect a PIN unlock that happened while
  // the Firebase module was still loading. Do not change mc.js or PIN logic.
  if(adminBody.style.display!=="block"||pinPrompted||firebaseApproved)return;
  pinPrompted=true;
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute("open","");
}
const pinObserver=new MutationObserver(offerPersonalSetupAfterPin);
pinObserver.observe(adminBody,{attributes:true,attributeFilter:["style"]});
offerPersonalSetupAfterPin();
document.getElementById("tc-notnow").addEventListener("click",()=>dialog.close());
function readableError(err){
  if(err?.code==="auth/weak-password")return "Please choose a stronger password.";
  if(err?.code==="auth/retry-original-email")return "Finish the earlier registration using the same email, or contact Fudgie for assistance.";
  if(err?.code==="auth/email-already-in-use")return "This email already has an account. Use Personal Admin Login; if your profile is incomplete, ask Fudgie for help.";
  if(err?.code==="auth/too-many-requests")return "Too many attempts. Please wait and try again.";
  if(err?.name==="OperationError"||err?.name==="DataError")
    return "The protected Admin data could not be unlocked. Please contact Fudgie. The shared PIN is unaffected.";
  if(err?.code?.includes("permission-denied"))return "The registration was blocked by Firebase rules. Your email login might already exist; ask Fudgie to check before trying another account.";
  return "Unable to complete the request. Please try again or ask Fudgie for help. ("+(err?.code||"connection error")+")";
}
document.getElementById("tc-upgrade-form").addEventListener("submit",async(event)=>{
  event.preventDefault();
  const form=event.currentTarget,submit=form.querySelector('button[type="submit"]');
  const name=form.elements.fullName.value.trim();
  const username=form.elements.username.value.trim().toLowerCase();
  const email=form.elements.email.value.trim().toLowerCase();
  const password=form.elements.password.value;
  if(password!==form.elements.confirm.value){updateStatus(signupMsg,"Passwords do not match.");return;}
  if(!/^[a-z0-9_]{3,30}$/.test(username)||!name||name.length>100){
    updateStatus(signupMsg,"Check the full name and display username (3–30 letters, numbers, underscores).");return;
  }
  submit.disabled=true;updateStatus(signupMsg,"Creating account and pending request…");
  let newlyCreated=false,user=null,profileSaved=false;
  try{
    // In-memory registration context avoids replacing Fudgie's signed-in account.
    await setPersistence(signupAuth,inMemoryPersistence);
    if(orphanSignupUid && signupAuth.currentUser?.uid===orphanSignupUid){
      user=signupAuth.currentUser;
      if(user.email?.toLowerCase()!==email)throw {code:"auth/retry-original-email"};
    }else{
      const credential=await createUserWithEmailAndPassword(signupAuth,email,password);
      user=credential.user;newlyCreated=true;orphanSignupUid=user.uid;
    }
    // v4 rules require the two documents to be written atomically.
    const batch=writeBatch(signupDb),createdAt=serverTimestamp();
    batch.set(doc(signupDb,"usernames",username),{uid:user.uid,createdAt});
    batch.set(doc(signupDb,"users",user.uid),{
      email:user.email,username,fullName:name,admin:false,owner:false,
      status:"pending",createdAt,registrationPath:"pin"
    });
    await batch.commit();
    profileSaved=true;orphanSignupUid=null;registeredUser=user;
    document.getElementById("tc-resend-verify").hidden=false;
    submit.hidden=true;
    try{
      await sendEmailVerification(user);
      updateStatus(signupMsg,"Registration saved! Verify the email in your inbox, then wait for Fudgie to verify your identity and approve. You can continue with the PIN through Oct 31.");
    }catch(err){
      updateStatus(signupMsg,"Account saved and awaiting approval, but the verification email could not be sent. Use Resend Verification Email below, or ask Fudgie for assistance.");
    }
  }catch(err){
    if(newlyCreated && user && !profileSaved){
      try{
        // Remove an unusable Auth-only record, allowing a clean username retry.
        await deleteUser(user);orphanSignupUid=null;
        await signOut(signupAuth);
      }catch(_){
        updateStatus(signupMsg,"Registration was not completed, and your email sign-in may exist. Ask Fudgie for help before creating another account.");return;
      }
    }
    updateStatus(signupMsg,readableError(err));
  }finally{
    form.elements.password.value="";form.elements.confirm.value="";
    submit.disabled=false;
  }
});
document.getElementById("tc-resend-verify").addEventListener("click",async()=>{
  if(!registeredUser)return;
  try{
    await sendEmailVerification(registeredUser);
    updateStatus(signupMsg,"New verification email requested. Check your inbox.");
  }catch(_){updateStatus(signupMsg,"Could not resend now. Please try again later or contact Fudgie.");}
});
document.getElementById("tc-reset").addEventListener("click",async()=>{
  const email=document.getElementById("tc-login-form").elements.email.value.trim();
  if(!email){updateStatus(loginMsg,"Enter your email first.");return;}
  try{await sendPasswordResetEmail(auth,email);updateStatus(loginMsg,"If the account exists, check that inbox for a reset link.");}
  catch(e){updateStatus(loginMsg,"Password reset request could not be sent right now.");}
});
function base64Bytes(value){
  if(typeof value!=="string")throw new Error("Missing key or ciphertext");
  const decoded=atob(value),out=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)out[i]=decoded.charCodeAt(i);
  return out;
}
async function loadNewAdminData(){
  // Cherish/Clara confirmed v2 crypto contract. Production bundle NOT YET PREPARED:
  // Firestore /vault/keys {keys:{v2:<base64 of raw 32 bytes>}, current:"v2"}
  // CONFIRMED by Cherish at 06:52 CT Oct 20, 2026; still STAGING ONLY.
  // admin-data.v2.enc.json {formatVersion:2,kid:"v2",iv:<base64 12-byte GCM nonce>,ct:<base64 ciphertext+tag>}
  // AAD UTF8: tscms-admin-data|formatVersion=2|kid=v2 (no newline).
  // Cherish's 274-byte crypto-only synthetic fixture uses `danger_zone` rather than
  // the actual Admin UI's `danger` and omits `flags`; it validates crypto, NOT
  // dashboard schema parity. Request an actual Admin-shaped synthetic fixture.
  // Python AESGCM.encrypt and WebCrypto AES-GCM append the 16-byte tag to ct.
  const vaultSnapshot=await getDocFromServer(doc(db,"vault","keys"));
  if(!vaultSnapshot.exists())throw new Error("Personal-login data key is not prepared yet");
  const vault=vaultSnapshot.data();
  const response=await fetch("./admin-data.v2.enc.json",{cache:"no-store"});
  if(!response.ok)throw new Error("Personal-login dataset is not prepared yet");
  const envelope=await response.json();
  if(envelope.formatVersion!==2||envelope.kid!==vault.current||!envelope.iv||!envelope.ct)
    throw new Error("Personal-login data format or key version does not match bundle");
  const raw=base64Bytes(vault.keys?.[envelope.kid]);
  const iv=base64Bytes(envelope.iv),ct=base64Bytes(envelope.ct);
  if(raw.byteLength!==32)throw new Error("Expected a 256-bit encryption key");
  if(iv.byteLength!==12||ct.byteLength<16)throw new Error("Invalid encrypted Admin envelope");
  const key=await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["decrypt"]);
  const aad=new TextEncoder().encode("tscms-admin-data|formatVersion=2|kid="+envelope.kid);
  const clear=await crypto.subtle.decrypt(
    {name:"AES-GCM",iv,additionalData:aad,tagLength:128},key,ct);
  const data=JSON.parse(new TextDecoder().decode(clear));
  if(!data||typeof data.stats!=="object"||data.stats===null||!Array.isArray(data.danger)||!Array.isArray(data.flags)||typeof data.generated!=="string")throw new Error("New Admin dataset is incomplete");
  return data;
}
/* Approved sessions are rechecked when the Admin returns to the tab and
   once per minute while open. If revoked, expired, or disconnected, fail closed.
   This protects the CURRENT browser view; downloaded old ciphertext/key copies
   still require a separate v2 key rotation for effective historical revocation. */
function isAllowedPersonalAdmin(user,profile){
  return !!(user && user.emailVerified===true && profile &&
    profile.status==="approved" && (profile.admin===true || profile.owner===true));
}
let personalSessionEnding=false,personalSessionChecking=false;
let stopOwnerInboxListener=null;
function stopOwnerInbox(){if(stopOwnerInboxListener){stopOwnerInboxListener();stopOwnerInboxListener=null;}}
async function endPersonalSession(){
  if(personalSessionEnding)return;
  personalSessionEnding=true;firebaseApproved=false;
  stopOwnerInbox(); // Detach Owner-only Firestore listener BEFORE erasing/decrypting state.
  // Hide then actually remove decrypted text and controls, not only the overlay.
  adminBody.style.display="none";
  adminBody.replaceChildren();
  gate.style.display="block";
  document.title="TSCMS Admin — Staff Sign In";
  try{await signOut(auth);}catch(_){}
  // Clearing the JS heap by reloading is essential after using a raw v2 key.
  window.location.reload();
}
async function validateOpenPersonalSession(){
  if(!firebaseApproved||personalSessionEnding||personalSessionChecking)return;
  personalSessionChecking=true;
  try{
    const user=auth.currentUser;
    if(!user){await endPersonalSession();return;}
    await reload(user);await getIdToken(user,true);
    const fresh=await getDocFromServer(doc(db,"users",user.uid));
    if(!fresh.exists()||!isAllowedPersonalAdmin(user,fresh.data())){
      await endPersonalSession();
    }
  }catch(_){
    // A stale/offline verification isn't permission to keep decrypted data open.
    await endPersonalSession();
  }finally{personalSessionChecking=false;}
}
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)void validateOpenPersonalSession();
});
window.addEventListener("focus",()=>{void validateOpenPersonalSession();});
setInterval(()=>{void validateOpenPersonalSession();},60000);

// Refresh restoration (TEST project): don't store plaintext or keys in localStorage.
// Firebase saves only its Auth session. The same personalLogin() does fresh reload,
// refreshed token, server profile read and second post-decrypt authorization check.
let initialAuthStateHandled=false;
void setPersistence(auth,browserLocalPersistence).then(()=>{
  onAuthStateChanged(auth,user=>{
    if(initialAuthStateHandled)return;
    initialAuthStateHandled=true;
    if(!user||firebaseApproved||personalSessionEnding)return;
    void personalLogin(user).then(async()=>{
      if(!firebaseApproved){await signOut(auth);gate.style.display="block";adminBody.style.display="none";}
    }).catch(async()=>{
      stopOwnerInbox();adminBody.style.display="none";gate.style.display="block";
      try{await signOut(auth);}catch(_){}
      updateStatus(loginMsg,"Your TEST session could not be verified. Please sign in again.");
    });
  });
}).catch(()=>updateStatus(loginMsg,"TEST browser session storage unavailable. Manual sign-in is still available."));

async function personalLogin(user){
  await reload(user);
  await getIdToken(user,true); // Refresh the email_verified security-rules claim.
  if(!user.emailVerified){updateStatus(loginMsg,"Check your email verification link first. Then sign in again.");return;}
  const ref=await getDocFromServer(doc(db,"users",user.uid));
  if(!ref.exists()){updateStatus(loginMsg,"Account registration incomplete. Contact Fudgie.");return;}
  const profile=ref.data();
  if(!isAllowedPersonalAdmin(user,profile)){
    updateStatus(loginMsg,"Your account is not approved or is no longer active. Only Fudgie can grant access.");return;
  }
  if(!window.isSecureContext||!crypto?.subtle)throw new Error("HTTPS required");
  updateStatus(loginMsg,"Account approved. Loading the Control Room…");
  const data=await loadNewAdminData();
  // Do not display even briefly if approval was withdrawn during decryption.
  await reload(user);await getIdToken(user,true);
  const finalCheck=await getDocFromServer(doc(db,"users",user.uid));
  if(auth.currentUser?.uid!==user.uid ||
     !finalCheck.exists() || !isAllowedPersonalAdmin(user,finalCheck.data())){
    throw {code:"permission-denied"};
  }
  firebaseApproved=true;
  document.title="TSCMS Admin — Control Room";
  gate.style.display="none";adminBody.style.display="block";
  if(typeof window.zi==="function")window.zi(data.danger,data.generated);
  if(typeof window.ziIssues==="function")window.ziIssues(data.flags||[]);
  const logout=document.createElement("button");
  logout.textContent="Sign Out";
  logout.className="tc-signout";
  logout.addEventListener("click",()=>{void endPersonalSession();});
  // Put Sign Out beside the shared Return to Public Homepage link.
  // The link itself is plain navigation: it never signs out or mutates the session.
  const roomExitTop=document.getElementById("tc-room-exit-top");
  if(roomExitTop)roomExitTop.appendChild(logout);
  else adminBody.prepend(logout);
  if(profile.owner===true)await showOwnerApprovals(user.uid);
  // Put the login confirmation above approvals and Sign Out so nobody
  // mistakes the Owner inbox for their own approval status.
  const signedIn=document.createElement("div");
  signedIn.className="tc-signed-in";
  signedIn.setAttribute("role","status");
  const displayName=String(profile.username||profile.fullName||"Admin").trim();
  const friendlyName=displayName.charAt(0).toUpperCase()+displayName.slice(1);
  signedIn.textContent="✅ Signed in as "+friendlyName+" · "+(profile.owner===true?"Owner":"Admin")+" — this room is yours";
  adminBody.prepend(signedIn);
}
document.getElementById("tc-login-form").addEventListener("submit",async(ev)=>{
  ev.preventDefault();
  const form=ev.currentTarget,button=form.querySelector('button[type="submit"]');
  button.disabled=true;updateStatus(loginMsg,"Signing in…");
  try{
    const loginResult=await signInWithEmailAndPassword(auth,form.elements.email.value.trim(),form.elements.password.value);
    form.elements.password.value="";
    await personalLogin(loginResult.user);
  }catch(err){updateStatus(loginMsg,readableError(err));form.elements.password.value="";}
  finally{button.disabled=false;}
});
async function showOwnerApprovals(ownerUid){
  const panel=document.createElement("section");panel.id="tc-owner-panel";panel.className="tc-owner";
  panel.innerHTML="<h2>👑 Admin Requests — Your Approval Inbox</h2><p>Your approval inbox — when someone creates a login, their name lands here for your OK. Nobody gets in without you.</p>";
  adminBody.prepend(panel);
  // Two deliberate taps on this SAME button are required before Firestore changes.
  // Leave the owner approval and Firebase permission checks untouched.
  let armedRevoke=null;
  let armedReject=null;
  function disarmReject(){
    if(!armedReject)return;
    const previous=armedReject;
    armedReject=null;
    clearTimeout(previous.timer);
    if(previous.button.isConnected){
      previous.button.classList.remove("tc-revoke-armed");
      previous.button.textContent="Reject";
      previous.button.setAttribute("aria-label",previous.button.dataset.idleAriaLabel||"Reject application");
    }
  }
  function disarmRevoke(){
    if(!armedRevoke)return;
    const previous=armedRevoke;
    armedRevoke=null;
    clearTimeout(previous.timer);
    if(previous.button.isConnected){
      previous.button.classList.remove("tc-revoke-armed");
      previous.button.textContent="Revoke";
      previous.button.setAttribute("aria-label",previous.button.dataset.idleAriaLabel||"Revoke access");
    }
  }
  // A tap/click anywhere else, a scroll, a tab switch or a re-render cancels.
  document.addEventListener("pointerdown",ev=>{
    if(armedRevoke && !armedRevoke.button.contains(ev.target))disarmRevoke();
  },true);
  document.addEventListener("click",ev=>{
    if(armedRevoke && !armedRevoke.button.contains(ev.target))disarmRevoke();
  },true);
  document.addEventListener("scroll",disarmRevoke,true);
  document.addEventListener("keydown",ev=>{
    if(armedRevoke && (ev.key==="Escape" || ev.key==="Tab"))disarmRevoke();
  },true);
  window.addEventListener("blur",disarmRevoke);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)disarmRevoke();});
  // Mirror the destructive-action safety used for Revoke: any other action,
  // scroll, keyboard navigation, tab switching or re-render cancels an armed Reject.
  document.addEventListener("pointerdown",ev=>{
    if(armedReject && !armedReject.button.contains(ev.target))disarmReject();
  },true);
  document.addEventListener("click",ev=>{
    if(armedReject && !armedReject.button.contains(ev.target))disarmReject();
  },true);
  document.addEventListener("scroll",disarmReject,true);
  document.addEventListener("keydown",ev=>{
    if(armedReject && (ev.key==="Escape" || ev.key==="Tab"))disarmReject();
  },true);
  window.addEventListener("blur",disarmReject);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)disarmReject();});
  let approvedExpanded=false;
  async function refresh(){
    disarmRevoke();
    disarmReject();
    panel.querySelectorAll(".tc-owner-entry-list").forEach(n=>n.remove());
    const profiles=arguments.length?arguments[0]:await getDocs(collection(db,"users")); // TEST live snapshots, original fallback preserved
    const others=profiles.docs.filter(d=>d.id!==ownerUid);
    const waiting=others.filter(d=>d.data().status==="pending").length;
    const approved=others.filter(d=>d.data().status==="approved").length;
    const pendingZone=document.createElement("div");
    pendingZone.className="tc-owner-entry-list";
    const w=document.createElement("div");
    w.className="tc-owner-waiting";
    w.textContent="🔔 "+waiting+" waiting for your OK";
    pendingZone.appendChild(w);
    panel.appendChild(pendingZone);
    const approvedShell=document.createElement("div");
    approvedShell.className="tc-owner-entry-list";
    const approvedBar=document.createElement("button");
    approvedBar.type="button";
    approvedBar.className="tc-owner-approved-bar";
    const approvedList=document.createElement("div");
    approvedList.className="tc-owner-approved-list";
    approvedList.id="tc-owner-approved-list";
    function syncApprovedBar(){
      approvedBar.textContent=approvedExpanded
        ?"✅ Approved Team ("+approved+") · tap to hide"
        :"✅ Approved Team — "+approved+" so far · tap to show";
      approvedBar.setAttribute("aria-expanded",String(approvedExpanded));
      approvedList.hidden=!approvedExpanded;
    }
    approvedBar.setAttribute("aria-controls",approvedList.id);
    approvedBar.addEventListener("click",()=>{disarmRevoke();approvedExpanded=!approvedExpanded;syncApprovedBar();});
    approvedShell.appendChild(approvedBar);
    approvedShell.appendChild(approvedList);
    panel.appendChild(approvedShell);
    syncApprovedBar();
    const otherZone=document.createElement("div");
    otherZone.className="tc-owner-entry-list tc-owner-other";
    const otherLabel=document.createElement("div");
    otherLabel.className="tc-owner-other-label";
    otherLabel.textContent="Other accounts";
    otherZone.appendChild(otherLabel);
    panel.appendChild(otherZone);
    let otherCount=0;
    for(const profile of others){
      const data=profile.data(),row=document.createElement("div");row.className="tc-owner-row";
      const label=document.createElement("span");
      label.textContent=[data.fullName,data.username,data.email,"Status: "+data.status].filter(Boolean).join(" · ");
      row.appendChild(label);
      async function update(changes){
        try{await updateDoc(doc(db,"users",profile.id),changes);await refresh();}
        catch(err){updateStatus(loginMsg,"Account review action failed. No change was confirmed.");}
      }
      if(data.status==="pending"){
        for(const [text,changes] of [
          ["Approve",{status:"approved",admin:true,approvedAt:serverTimestamp(),approvedBy:ownerUid}],
          ["Reject",{status:"rejected",admin:false}]
        ]){
          const button=document.createElement("button");button.textContent=text;
          button.type="button";
          button.setAttribute("aria-label",text+" "+(data.fullName||data.username||"this person"));
          if(text==="Reject"){
            const identity=data.fullName||data.username||"this person";
            button.dataset.idleAriaLabel="Reject application for "+identity;
            button.setAttribute("aria-label",button.dataset.idleAriaLabel);
            button.addEventListener("click",()=>{
              if(armedReject && armedReject.button===button &&
                  armedReject.profileId===profile.id && Date.now()<=armedReject.expiresAt){
                disarmReject();
                button.disabled=true;
                void update(changes);
                return;
              }
              disarmReject();disarmRevoke();
              button.textContent="Tap again to REJECT "+identity;
              button.setAttribute("aria-label","Tap again to reject application for "+identity);
              button.classList.add("tc-revoke-armed");
              const expiresAt=Date.now()+5000;
              const timer=setTimeout(disarmReject,5000);
              armedReject={button,profileId:profile.id,expiresAt,timer};
            });
          }else{
            button.addEventListener("click",()=>{
              disarmReject();
              if(window.confirm(
                "Have you personally contacted and verified "+(data.fullName||data.username||"this person")+
                " and confirmed their email? Approve only after your own identity check."
              ))void update(changes);
            });
          }
          row.appendChild(button);
        }
      }else if(data.status==="approved"){
        const revoke=document.createElement("button");
        revoke.type="button";
        revoke.textContent="Revoke";
        revoke.dataset.idleAriaLabel="Revoke access for "+(data.fullName||data.username||"this person");
        revoke.setAttribute("aria-label",revoke.dataset.idleAriaLabel);
        revoke.addEventListener("click",()=>{
          if(armedRevoke && armedRevoke.button===revoke &&
              armedRevoke.profileId===profile.id && Date.now()<=armedRevoke.expiresAt){
            disarmRevoke();
            revoke.disabled=true;
            void update({status:"revoked",admin:false});
            return;
          }
          disarmRevoke();
          const identity=data.fullName||data.username||"this person";
          revoke.textContent="Tap again to REVOKE "+identity;
          revoke.setAttribute("aria-label","Tap again to revoke access for "+identity);
          revoke.classList.add("tc-revoke-armed");
          const expiresAt=Date.now()+5000;
          const timer=setTimeout(disarmRevoke,5000);
          armedRevoke={button:revoke,profileId:profile.id,expiresAt,timer};
        });
        row.appendChild(revoke);
      }else if(data.status==="revoked"){
        const restore=document.createElement("button");
        restore.type="button";
        restore.textContent="Restore access";
        restore.setAttribute("aria-label","Restore access for "+(data.fullName||data.username||"this person"));
        restore.addEventListener("click",()=>{
          const identity=data.fullName||data.username||"this person";
          if(window.confirm(
            "Have you personally contacted and verified "+identity+
            " and confirmed their email? Restore access only after your own identity check."
          )){
            void update({status:"approved",admin:true,approvedAt:serverTimestamp(),approvedBy:ownerUid});
          }
        });
        row.appendChild(restore);
      }
      if(data.status==="pending")pendingZone.appendChild(row);
      else if(data.status==="approved")approvedList.appendChild(row);
      else {otherZone.appendChild(row);otherCount++;}
    }
    if(!otherCount)otherZone.remove();
    if(!others.length){const p=document.createElement("p");p.className="tc-owner-row";p.textContent="🎉 All quiet — no one is waiting right now.";pendingZone.appendChild(p);}
  }
  await refresh();
  stopOwnerInbox();
  stopOwnerInboxListener=onSnapshot(collection(db,"users"),
    {includeMetadataChanges:true},
    snapshot=>{
      if(!firebaseApproved||personalSessionEnding||auth.currentUser?.uid!==ownerUid)return;
      if(snapshot.metadata.fromCache){
        updateStatus(loginMsg,"TEST inbox cannot confirm current requests while offline.");
        return;
      }
      void refresh(snapshot).catch(()=>{
        // Don't trust an old list once the Owner loses real-time read permission.
        void endPersonalSession();
      });
    },
    ()=>{void endPersonalSession();}
  );
}
