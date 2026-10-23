#!/usr/bin/env node
/* TSCMS protected-features pre-publish gate — owner approved 2026-10-20.
   Run AFTER the generated HTML is built but BEFORE any GitHub publish/push:
      node scripts/verify-public-preservation.mjs [build-directory]
   A nonzero exit status is a BLOCKER: report the failed feature by name.
   Keep this script and the protected feature source files outside generated HTML.
   Cherish maintains the registry; Fudgie approves changes to it. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(scriptDir,'..'));
let failures = [], passed = 0;
function read(name) {
  try { return fs.readFileSync(path.join(root,name),'utf8'); }
  catch(e) {failures.push(name+': required protected source missing');return '';}
}
function assert(label,ok) {
  if(ok) {passed++;console.log('PASS '+label);}
  else {failures.push(label);console.error('BLOCK '+label);}
}
function count(s,re) {return (s.match(re)||[]).length;}
const index=read('index.html');
const today=read('tscms-today.html');
const runtime=read('tscms-public-runtime.js');
const siteCss=read('site.css');
const quickJs=read('tscms-quick-jump.js');
const quickCss=read('tscms-quick-jump.css');
const feedback=read('tscms-feedback.js');
const siteJs=read('site.js');
const game=read('gamehouse.html');
const museJs=read('tscms-muse-referral.js');
const museCss=read('tscms-muse-referral.css');
const homeDubbyJs=read('tscms-home-dubby.js');
const homeDubbyCss=read('tscms-home-dubby.css');
const pages=[['index.html',index],['tscms-today.html',today]];
for(const [label,s] of pages) {
  assert(label+' → public runtime exactly once',count(s,/<script\b[^>]*src=["']tscms-public-runtime\.js(?:\?[^"']*)?["']/g)===1);
  assert(label+' → Quick Jump exactly once',count(s,/<script\b[^>]*src=["']tscms-quick-jump\.js(?:\?[^"']*)?["']/g)===1);
  assert(label+' → Feedback exactly once',count(s,/<script\b[^>]*src=["']tscms-feedback\.js(?:\?[^"']*)?["']/g)===1);
  assert(label+' → site styles exactly once',count(s,/<link\b[^>]*href=["']site\.css(?:\?[^"']*)?["']/g)===1);
  assert(label+' → PLAY NOW Gamehouse entrance',/class=["']saloon-playnow["'][^>]*href=["']gamehouse\.html/.test(s));
  assert(label+' → PUBLIC tab',/class=["']tscms-site-tab is-active["']/.test(s));
  assert(label+' → song day tabs',/class=["']tabs["']/.test(s)&&/id=["']day-0["']/.test(s));
  assert(label+' → protected footer anchor',/<footer class=["']mono["']>MADE WITH LOVE FOR THE TSCMS FAMILY/.test(s));
  assert(label+' → public icon links',/favicon-32\.png/.test(s)&&/manifest-public\.json/.test(s));
  assert(label+' → dynamic stats and Dubby insertion anchors',count(s,/class=["']stats["']/g)===1&&count(s,/class=["']yt-banner["']/g)===1&&count(s,/class=["']feat["']/g)===1&&/<h1 class=["']slab["']>Today in/.test(s));
}
assert('Gamehouse Play Now + PUBLIC gold styles in safe CSS',/\.saloon-playnow\{/.test(siteCss)&&/\.tscms-site-tab\{/.test(siteCss));
assert('Quick Jump drawer + Home/Gamehouse routes',/tscms-qj-drawer/.test(quickJs)&&/href:'gamehouse\.html'/.test(quickJs)&&/tscms-qj-drawer/.test(quickCss));
assert('Personal Note letter preserved in external public runtime',/tscms-personal-note/.test(runtime)&&/tnLetter/.test(runtime));
assert('Dicey protected runtime intact',/diceCount/.test(runtime)&&/dicePool/.test(runtime));
const diceSkin=read('tscms-dicey-autumn-v3.css');
const diceLogic=read('tscms-dicey-autumn-v3.js');
assert('Dicey standalone style + code preserved',
  /dicey-autumn-v3/.test(diceSkin)&&/dicey-v3-cards/.test(diceSkin)&&
  /dicey-v3-visit/.test(diceSkin)&&/TSCMSDiceyUpgrade/.test(diceLogic));
assert('Dicey V6 isolated loaders retained in protected runtime',
  /data-dicey-v6-css/.test(runtime)&&/data-dicey-v6-js/.test(runtime)&&
  /tscms-dicey-v6\.css/.test(runtime)&&/tscms-dicey-v6\.js/.test(runtime)&&
  /TSCMSDiceyUpgrade\.roll\(dicePool/.test(runtime));
const v6Css=read('tscms-dicey-v6.css');
const v6Js=read('tscms-dicey-v6.js');
assert('Dicey V6 approved saloon is fully included in its own protected file',
  /dicey-v4-sign/.test(v6Css)&&/dicey-v4-felt/.test(v6Css)&&
  /dicey-v4-plaque/.test(v6Css)&&
  (v6Css.match(/data:image\/webp;base64,/g)||[]).length===9&&
  /dicey-v4 \.die-col/.test(v6Css));
assert('Dicey V6 shared-table collisions + secure outcome-first face decisions preserved',
  /crypto\.getRandomValues/.test(v6Js)&&
  /const nums=\[rand\(6\)\+1,rand\(6\)\+1\]/.test(v6Js)&&
  /const doClack=rand\(10\)<4/.test(v6Js)&&
  /edgeGap=s\.size\*\.80/.test(v6Js)&&
  /columns\.forEach\(\(c,i\)=>/.test(v6Js));
assert('Dicey V6 retains original post, unique voices and ONLY one Facebook link',
  /chooseSongs\(pool,doubles\?2:1,bridge\)/.test(v6Js)&&
  /used\.add\(v\)/.test(v6Js)&&
  /bridge\.saveSeen/.test(v6Js)&&
  /bridge\.diceLog/.test(v6Js)&&
  /a\.href=p\.post_url/.test(v6Js)&&
  /a\.textContent='❤️ VISIT FACEBOOK POST'/.test(v6Js)&&
  !/createElement\(['"]audio['"]\)/.test(v6Js)&&
  !/TEST A DICE-TO-DICE COLLISION/.test(v6Js)&&
  !/Sarah Johnson/.test(v6Js));
assert('Dicey single Facebook action with full text and new-tab safety',
  /'❤️ VISIT FACEBOOK POST'/.test(diceLogic)&&
  /link\.href=p\.post_url/.test(diceLogic)&&/noopener noreferrer/.test(diceLogic)&&
  !/createElement\(['"]audio['"]\)/.test(diceLogic));
assert('Dicey outcome-first crypto + distinct doubles retained',
  /cryptoSource\.getRandomValues/.test(diceLogic)&&
  /doublesFaces=\[dieFace\(\),dieFace\(\)\]/.test(diceLogic)&&
  /selectSongs\(pool,doubles\?2:1/.test(diceLogic)&&
  /used\.add\(voice\)/.test(diceLogic));

assert('Monthly Spotlight runtime/markup retained',/tscms-september-spotlight-2026/.test(index)||/tscms-september-spotlight-2026/.test(runtime));
assert('Radio player runtime preserved',/tscms-song-player/.test(runtime)&&/dayPlay/.test(runtime));
assert('Daily song pagination preserved',/song-page-btn/.test(siteJs)&&/window\.showDay/.test(siteJs));
assert('Shared Feedback widget preserved',/tscms-fb-btn/.test(feedback)&&/openModal/.test(feedback));
assert('Gamehouse retains Solitaire/Swiper/Jukebox without extra Feedback widget',/swiper-launch-bootstrap\.js/.test(game)&&/gamehouse-jukebox-v7-ui\.js/.test(game)&&count(game,/src=["']tscms-feedback\.js/g)===1);
assert('Halloween playlist navigation survives',/tscms-halloween-jump/.test(quickJs)&&/tscms-halloween-jump/.test(quickCss));
if(Date.now()<Date.parse('2026-11-01T05:00:00Z')) {
  assert('Halloween pinned favorites protected until Oct 31',/halloween-pin-head/.test(index));
}
assert('Muse card loader exists in protected runtime exactly once',count(runtime,/script\.setAttribute\('data-tscms-preserved', 'muse-referral'\)/g)===1&&/tscms-muse-referral\.js/.test(runtime));
assert('Muse card uses isolated CSS and footer insertion',/tscms-muse-referral\.css/.test(museJs)&&/footer\.insertAdjacentElement\('beforebegin', section\)/.test(museJs));
assert('Muse referral code exact, letter O not zero',/var CODE = '1BZI4O'/.test(museJs)&&!/1BZI40/.test(museJs));
assert('Muse 48-hour and 1-billion-token disclosure',/48 hours of joining/.test(museJs)&&/1 BILLION Muse tokens/.test(museJs));
assert('Muse independent CSS is present',/\.tscms-muse-referral-inner/.test(museCss)&&/\.tscms-muse-copy/.test(museCss));

/* Homepage enhancements live in independent protected files so regenerated daily
   HTML cannot erase them. These tests guard wiring, assets, links, and failover. */
function validAsset(name,minBytes) {
  try {
    const info=fs.statSync(path.join(root,name));
    return info.isFile()&&info.size>=minBytes;
  } catch(e) {return false;}
}
assert('Autumn navigation artwork safely present',
  validAsset('assets/tscms-autumn-public-links.webp',100000));
assert('Autumn artwork + guarded fallback in Quick Jump',
  /var artwork='assets\/tscms-autumn-public-links\.webp'/.test(quickJs)&&
  /preflight\.onload/.test(quickJs)&&/preflight\.onerror/.test(quickJs)&&
  /tscms-autumn-nav-ready/.test(quickJs));
assert('Autumn navigation has all five clickable destinations',
  /hotspot\('button','quick'/.test(quickJs)&&
  /hotspot\('a','group'/.test(quickJs)&&
  /hotspot\('a','youtube'/.test(quickJs)&&
  /hotspot\('a','public'/.test(quickJs)&&
  /hotspot\('a','game'/.test(quickJs)&&
  /www\.facebook\.com\/share\/g\/1HhNCD6FSS\//.test(quickJs)&&
  /www\.facebook\.com\/share\/19z71PkNja\//.test(quickJs)&&
  /www\.youtube\.com\/@TSCMSLive/.test(quickJs));
assert('Home statistics and Sponsor TV boot once via protected Quick Jump file',
  count(quickJs,/data-tscms-preserved','home-dubby-style'/g)===1&&
  count(quickJs,/data-tscms-preserved','home-dubby'/g)===1&&
  /tscms-home-dubby\.css/.test(quickJs)&&/tscms-home-dubby\.js/.test(quickJs)&&
  /style\.onload/.test(quickJs)&&/style\.onerror/.test(quickJs));
assert('Stats relocated intact above YouTube and sponsor takes original spot',
  /stats\.parentNode\.insertBefore\(sponsor, stats\)/.test(homeDubbyJs)&&
  /youtube\.parentNode\.insertBefore\(stats, youtube\)/.test(homeDubbyJs)&&
  /stats\.classList\.add\('tscms-home-stats'\)/.test(homeDubbyJs)&&
  /stats\.tscms-home-stats/.test(homeDubbyCss));
assert('Home stats remain dynamic, with three small evenly spaced tiles',
  !/SONGS TODAY[\s\S]{0,70}267/.test(homeDubbyJs)&&
  /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(homeDubbyCss)&&
  /tscms-home-stats \.stat \.v/.test(homeDubbyCss));
assert('Dubby promotional poster and original video backed by repository assets',
  validAsset('public-assets/dubby-poster.jpg',10000)&&
  validAsset('public-assets/dubby-promo.mp4',1000000)&&
  /public-assets\/dubby-poster\.jpg/.test(homeDubbyJs)&&
  /public-assets\/dubby-promo\.mp4/.test(homeDubbyJs));
assert('Dubby referral link, coupon, disclosure and accessible playback controls',
  /https:\/\/www\.dubby\.gg\/discount\/TSCMSLIVE\?ref=xdejzekt/.test(homeDubbyJs)&&
  /Save 10%/.test(homeDubbyJs)&&/TSCMSLIVE/.test(homeDubbyJs)&&
  /Affiliate partner/.test(homeDubbyJs)&&
  /data-dubby-action="play"/.test(homeDubbyJs)&&
  /data-dubby-action="pause"/.test(homeDubbyJs)&&
  /data-dubby-action="stop"/.test(homeDubbyJs)&&
  /pauseOtherMedia/.test(homeDubbyJs)&&/preload="metadata"/.test(homeDubbyJs));
assert('Dubby independent CSS and control styles preserved',
  /tscms-home-dubby/.test(homeDubbyCss)&&
  /tscms-dubby-actions/.test(homeDubbyCss)&&
  /tscms-dubby-shop/.test(homeDubbyCss));


/* TSCMS Western Drive-In — owner-approved public showcase.
   A generator rebuild MUST NOT publish a Quick Jump video link unless its
   standalone page, exact reviewed art, and real (non-synthetic) audio exist.
   Prevent accidental opening of submissions before server-side consent exists. */
const driveIn=read('videos.html');
const driveInAssets=[
  ['assets/drive-in/western-drive-in.jpg',250759,'3894f121c33fb733069454e54002336d62283b762c246a37b48d504030d7f942'],
  ['assets/drive-in/wood-sides.jpg',284714,'70efea49d064f2f5aad631ff7609f92ebd744a216bda2e99d5b090251bd6fce2'],
  ['assets/drive-in/submit-title.jpg',43073,'49db3f9fb933a4311ee1e75588e2197ce6370a4b0c87a0919b137efa929e874b'],
  ['assets/drive-in/night-sounds-20min.m4a',7420428,'fa22cbb19ea17b316467c193c836f3662225e858b56bb9a4ec27ea9fff6a3202']
];
for (const [filename,size,sha256] of driveInAssets) {
  let ok=false;
  try {
    const bytes=fs.readFileSync(path.join(root,filename));
    ok=bytes.byteLength===size&&
      crypto.createHash('sha256').update(bytes).digest('hex')===sha256;
  } catch {}
  assert('Western Drive-In reviewed asset unchanged: '+filename,ok);
}
assert('Quick Jump has approved Videos link and navigates there normally',
  /key:'videos'/.test(quickJs)&&/href:'videos\.html'/.test(quickJs)&&
  /key==='gamehouse'\|\|key==='videos'/.test(quickJs));
assert('Western Drive-In page preserves vinyl easter egg, one coherent hero and spotlight',
  /Jim B Records/.test(driveIn)&&/www\.facebook\.com\/share\/1LdqyvJKso/.test(driveIn)&&
  /western-drive-in\.jpg/.test(driveIn)&&/beam-one/.test(driveIn)&&/signal-drift/.test(driveIn));
assert('Western Drive-In uses only original 20-minute audio and on-off control',
  /night-sounds-20min\.m4a/.test(driveIn)&&/id="sound-toggle"/.test(driveIn)&&
  !/data:audio\/mp4;base64,/.test(driveIn));
assert('Western Drive-In consent and actual-video-only rules remain visible',
  /Read the Full Video Submission Terms/.test(driveIn)&&/id="agree"/.test(driveIn)&&
  /ACTUAL VIDEO FILES ONLY/.test(driveIn)&&!/Video Link \(Optional\)/.test(driveIn));
assert('Western Drive-In email-only activation requires completed form and checkbox, with no Messenger',
  /email\.disabled=!ready/.test(driveIn)&&
  /const ready=consent\.checked&&fields\.every/.test(driveIn)&&
  /mailto:fudgiepie4@gmail\.com\?subject=/.test(driveIn)&&
  /TSCMS Drive-In Submission/.test(driveIn)&&
  /IMPORTANT: attach your video file/.test(driveIn)&&
  /AGREEMENT CONFIRMED BY CHECKBOX/.test(driveIn)&&
  /id="send-email"/.test(driveIn)&&
  !/Messenger|messenger|m\.me\//.test(driveIn));

for(const [name,source] of [['tscms-muse-referral.js',museJs],['tscms-public-runtime.js',runtime],['tscms-quick-jump.js',quickJs],['tscms-home-dubby.js',homeDubbyJs]]) {
  let valid=true;
  try {new vm.Script(source,{filename:name});}catch(e){valid=false;}
  assert(name+' JavaScript syntax',valid);
}
if(failures.length) {
 console.error('\nBLOCK DEPLOY: '+failures.length+' missing/broken required feature(s):\n - '+failures.join('\n - '));
 process.exitCode=1;
} else {
 console.log('\nALL '+passed+' protected-feature checks PASS. Eligible for publish, pending independent live verification.');
}
