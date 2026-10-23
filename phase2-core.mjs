// Phase 2 invitations — deterministic, isolated test helpers.
export const TEST_PROJECT = 'tscms-admin-login-test';
export const TTL_MS = 7*24*60*60*1000;
 // Conservative issue-time allowance for up to ~1h device clock skew plus network.
 // Server rules STILL enforce expiry <= (server request.time + 7d); never widen them.
export const EXPIRY_CLOCK_BUFFER_MS = 75*60*1000;
export function proposedInviteExpiryMs(clientNowMs){
  if(!Number.isFinite(clientNowMs))throw Error('Invalid clock');
  return clientNowMs + TTL_MS - EXPIRY_CLOCK_BUFFER_MS;
}
export function assertTestOnly(config,hostname){
  if(config?.projectId!==TEST_PROJECT)throw Error('STOP — wrong Firebase project');
  if(!config.apiKey||config.apiKey.includes('REQUIRED')||!config.appId||config.appId.includes('REQUIRED'))
    throw Error('STOP — isolated Firebase TEST app config is missing');
  if(['tscmsradio.com','www.tscmsradio.com'].includes(hostname))throw Error('STOP — live domain forbidden');
}
export function normalizeEmail(value){
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||!/^[^ @]+@[^ @]+\.[^ @]+$/.test(email))throw Error('Valid email required');
  return email;
}
export function inviteToken(cryptoSource){
  if(!cryptoSource?.getRandomValues)throw Error('Secure randomness unavailable');
  const bytes=new Uint8Array(32);
  cryptoSource.getRandomValues(bytes);
  const base64=typeof btoa==='function'?btoa(String.fromCharCode(...bytes)):Buffer.from(bytes).toString('base64');
  const id=base64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(!/^[A-Za-z0-9_-]{43}$/.test(id))throw Error('Token length invalid');
  return id;
}
export function isUnexpired(invite,now){
  return invite?.status==='issued' && typeof invite.expiresAt?.toMillis==='function' &&
    invite.expiresAt.toMillis()>now;
}
export function recipientCanClaim(invite,authEmail,now){
  return isUnexpired(invite,now)&&normalizeEmail(invite.email)===normalizeEmail(authEmail);
}
export function pendingProfile({authUser,fullName,username,inviteId,createdAt}){
  if(!authUser?.uid||!authUser.emailVerified)throw Error('Verified Firebase account required');
  const name=String(fullName||'').trim();
  const handle=String(username||'').toLowerCase().trim();
  if(!name||name.length>100||!/^[a-z0-9_]{3,30}$/.test(handle))throw Error('Invalid profile');
  if(!/^[A-Za-z0-9_-]{43}$/.test(inviteId))throw Error('Bad invitation');
  return {email:normalizeEmail(authUser.email),username:handle,fullName:name,
    createdAt,registrationPath:'invite',invitationId:inviteId,
    admin:false,owner:false,status:'pending'};
}
export function safeInviteUrl(origin,page,token){
  if(!/^https:\/\//i.test(origin))throw Error('HTTPS test host required');
  const url=new URL(page,origin);
  // Keep the opaque token in URL fragment, not in the server query log.
  url.hash='invite='+encodeURIComponent(token);
  return url.toString();
}
