/* Team-only Favorites v1, pure contract shared by runtime and staging tests.
 * No UI may be inserted until an approved verified team account is confirmed.
 */
export const TEAM_ONLY = true;
export const MAX_SAVED = 500;
export const approvedTeam = (user,profile) => Boolean(user?.uid && user.emailVerified===true && profile?.status==='approved' && (profile.admin===true||profile.owner===true));
export const validStream = url => typeof url==='string' && /^https:\/\/[a-z0-9.-]+\/\S+$/i.test(url) && url.length<=1600;
export function cleanSong(input){
  if (!input || !validStream(input.play_url || input.stream)) return null;
  const title=String(input.title||'').trim().slice(0,500),artist=String(input.artist||'').trim().slice(0,200);
  if(!title||!artist)return null;
  return {title,artist,play_url:input.play_url||input.stream};
}
export function newestFirst(items){return [...items].sort((a,b)=>(b.savedAt?.seconds||0)-(a.savedAt?.seconds||0)||(b.savedAt?.nanoseconds||0)-(a.savedAt?.nanoseconds||0));}
export function artistFromCard(text){return String(text||'').replace(/^\s*by\s+/i,'').split('·')[0].trim();}
export async function songKey(url){
  if(!validStream(url))throw Error('Invalid song stream');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));
  return 'song-'+Array.from(new Uint8Array(bytes),c=>c.toString(16).padStart(2,'0')).join('');
}
