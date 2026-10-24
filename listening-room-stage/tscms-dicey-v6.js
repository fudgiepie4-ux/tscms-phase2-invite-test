/* Preview controller — secure result-first rolls, photo-matched 3D faces,
   visible dice-to-dice collisions, and Facebook-only demo cards. */
(function(){
'use strict';
const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const ROT={1:[0,0],2:[0,180],3:[0,-90],4:[0,90],5:[-90,0],6:[90,0]};
const TILT_X=-22, TILT_Y=-24;
const ids=['die1','die2'];
for(const id of ids){
  const die=document.getElementById(id);
  if(!die || die.querySelector('.dface')) continue;
  for(let i=1;i<=6;i++){
    const f=document.createElement('div');f.className='dface df'+i;
    for(let j=1;j<=9;j++){
      const p=document.createElement('span');p.className=PIPS[i].includes(j)?'pip':'blank';f.appendChild(p);
    }
    die.appendChild(f);
  }
}
const section=document.getElementById('diceSection'),result=document.getElementById('diceResult'),
  table=document.getElementById('diceTable'),button=document.getElementById('diceBtn');
const dice=ids.map(id=>document.getElementById(id));
const columns=dice.map(d=>d.closest('.die-col'));
let rolling=false,lastRest=null;
const SEEN_KEY='tscms_dicey_last_post_v3';
function ident(s){return String(s||'').trim().toLocaleLowerCase();}
function readLast(){try{return localStorage.getItem(SEEN_KEY)||'';}catch(e){return '';}}
function saveLast(v){try{localStorage.setItem(SEEN_KEY,v);}catch(e){}}
function validPool(pool){return (pool||[]).filter(p=>p && typeof p.member==='string' && p.member.trim() && typeof p.post_url==='string' && /^https:\/\/(?:www\.)?facebook\.com\/groups\/1410002804113962\/permalink\/\d+\/?$/i.test(p.post_url));}
function chooseSongs(pool,count,bridge){
  const valid=validPool(pool), voices=Array.from(new Set(valid.map(p=>ident(p.member))));
  if(voices.length<count)return null;
  const seen=new Set((bridge.getSeen()||[]).map(ident).filter(x=>voices.includes(x))), used=new Set();
  const chosen=[];let last=readLast();
  for(let slot=0;slot<count;slot++){
    let available=voices.filter(v=>!seen.has(v)&&!used.has(v));
    if(!available.length){seen.clear();available=voices.filter(v=>!used.has(v));}
    let options=valid.filter(p=>available.includes(ident(p.member)) && p.post_url!==last);
    if(!options.length)options=valid.filter(p=>available.includes(ident(p.member)));
    if(!options.length)return null;
    const currentVoices=Array.from(new Set(options.map(p=>ident(p.member))));
    const v=currentVoices[rand(currentVoices.length)];
    const posts=options.filter(p=>ident(p.member)===v);
    const p=posts[rand(posts.length)];
    used.add(v);seen.add(v);chosen.push(p);last=p.post_url;
  }
  return {songs:chosen,history:Array.from(seen),last};
}
function rand(n){
  if(!window.crypto||typeof crypto.getRandomValues!=='function')throw new Error('Secure randomness unavailable');
  const b=new Uint32Array(1),lim=4294967296-4294967296%n;
  do{crypto.getRandomValues(b)}while(b[0]>=lim);
  return b[0]%n;
}
function pose(n,x=0,y=0,rx=0,ry=0){
  return `translate3d(${x}px,${y}px,0) rotateX(${ROT[n][0]+TILT_X+rx}deg) rotateY(${ROT[n][1]+TILT_Y+ry}deg)`;
}
function land(die,n,x=0,y=0){
  die.style.transform=pose(n,x,y);
  die.setAttribute('aria-label','Die showing '+n);
  die.dataset.face=String(n);
}
land(dice[0],5);land(dice[1],3);
const reduced=()=>window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Position both dice on the same coordinate plane. No flex lanes.
function stage(){
 const rect=table.getBoundingClientRect(), size=columns[0].offsetWidth;
 return {w:rect.width,h:rect.height,size,maxX:Math.max(0,rect.width-size),maxY:Math.max(0,rect.height-size)};
}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function place(column,p){column.style.transform=`translate3d(${p.x}px,${p.y}px,0)`;}
function startingPositions(){
 const s=stage(),sep=Math.min(s.size*1.82,s.maxX*.72);
 const base=(s.w-s.size)/2,cy=clamp((s.h-s.size)*.5,0,s.maxY);
 return [{x:clamp(base-sep*.5,0,s.maxX),y:cy},{x:clamp(base+sep*.5,0,s.maxX),y:cy}];
}
function initTable(){lastRest=startingPositions();columns.forEach((col,i)=>place(col,lastRest[i]));}
requestAnimationFrame(initTable);
window.addEventListener('resize',()=>{if(!rolling)initTable();});
function finalPositions(s){
 // Both may settle anywhere on the same shared surface, not into assigned slots.
 const center=(s.w-s.size)/2, jitter=()=>rand(Math.max(1,Math.floor(Math.min(22,s.maxX*.13)+1)))-10;
 const spread=Math.min(s.maxX*.41,s.size*.77);
 const swapped=rand(5)===0;
 const left={x:clamp(center-spread+jitter(),0,s.maxX),y:rand(Math.max(1,Math.floor(s.maxY)+1))};
 const right={x:clamp(center+spread+jitter(),0,s.maxX),y:rand(Math.max(1,Math.floor(s.maxY)+1))};
 return swapped?[right,left]:[left,right];
}
function reveal(chosen,doubles,bridge){
  const last=result.querySelector('.dicey-v3-output');if(last)last.remove();
  const out=document.createElement('div');out.className='dicey-v3-output';
  const h=document.createElement('div');h.className='dicey-v3-headline';
  h.textContent=doubles?'🎲 DOUBLES! TWO VOICES TO DISCOVER':'✦ YOUR DISCOVERY ✦';out.appendChild(h);
  const cards=document.createElement('div');cards.className='dicey-v3-cards'+(doubles?' double':'');
  for(const p of chosen.songs){
    const c=document.createElement('article');c.className='dicey-v3-card';
    const m=document.createElement('div');m.className='dicey-v3-member';m.textContent=p.member;
    const t=document.createElement('div');t.className='dicey-v3-song';t.textContent=p.title||'Discover this member’s post';
    const a=document.createElement('a');a.className='dicey-v3-visit';
    a.href=p.post_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='❤️ VISIT FACEBOOK POST';
    a.addEventListener('click',()=>bridge.diceLog('tap',p));
    c.append(m,t,a);cards.appendChild(c);bridge.diceLog('roll',p);
  }
  out.appendChild(cards);
  result.insertBefore(out,document.getElementById('diceCount'));
  result.classList.add('show');
  bridge.saveSeen(chosen.history);saveLast(chosen.last);bridge.updateCount();
}
function roll(pool,bridge){
  if(rolling)return;
  if(!window.crypto||typeof crypto.getRandomValues!=='function'){
    button.disabled=true;button.setAttribute('aria-label','Secure dice unavailable');return;
  }
  rolling=true;button.disabled=true;section.setAttribute('aria-busy','true');
  const nums=[rand(6)+1,rand(6)+1],doubles=nums[0]===nums[1];
  const chosen=chooseSongs(pool,doubles?2:1,bridge);
  if(!chosen){button.disabled=true;button.textContent='DISCOVERY POOL UNAVAILABLE';rolling=false;section.removeAttribute('aria-busy');return;}
  const doClack=rand(10)<4;
  const s=stage(), initial=lastRest||startingPositions(), finishAt=finalPositions(s);
  const duration=1400+rand(220);
  let finished=false, anims=[];
  const centerX=(s.w-s.size)/2;
  const impactY=clamp((s.h-s.size)*.55,0,s.maxY);
  // 2D geometry: overlap slightly (approx 10% of a die) at impact, so it
  // visibly looks like one cube striking the other and causing a rebound.
  const edgeGap=s.size*.80;
  const meet=[{x:clamp(centerX-edgeGap/2,0,s.maxX),y:impactY},
              {x:clamp(centerX+edgeGap/2,0,s.maxX),y:impactY}];
  // More pronounced and visible hop through the common felt plane.
  const moves=initial.map((p,i)=>{
    const dy=rand(15)-7,dx=rand(23)-11;
    return {x:clamp(p.x+dx,0,s.maxX),y:clamp(p.y+dy,0,s.maxY)};
  });
  const collisionPositions=doClack?meet:null;
  const debug={faces:nums,doubles,clack:doClack,impact:collisionPositions,
    starts:initial.map(v=>({...v})),ends:finishAt.map(v=>({...v})),dieSize:s.size};

  const finish=()=>{
    if(finished)return;finished=true;
    anims.forEach(a=>{try{a.cancel()}catch(e){}});
    columns.forEach((c,i)=>place(c,finishAt[i]));
    lastRest=finishAt;
    dice.forEach((d,i)=>land(d,nums[i]));
    table.removeEventListener('click',finish);
    const banner=table.querySelector('.dicey-v3-banner');if(banner)banner.remove();
    reveal(chosen,doubles,bridge);
    rolling=false;button.disabled=false;section.removeAttribute('aria-busy');

  };
  if(reduced()||!dice[0].animate){finish();return;}
  const pos=p=>`translate3d(${p.x}px,${p.y}px,0)`;
  // Unconfined rolling. On collision rolls, BOTH dice reach the same center,
  // spend visible time in contact, kick apart, then settle at new positions.
  columns.forEach((c,i)=>{
    let f;
    if(doClack){
      const near={x:meet[i].x+(i===0?-s.size*.39:s.size*.39),y:clamp(meet[i].y-6,0,s.maxY)};
      const recoil={x:clamp(meet[i].x+(i===0?-s.size*.55:s.size*.55),0,s.maxX),
        y:clamp(meet[i].y+6,0,s.maxY)};
      f=[{transform:pos(initial[i]),offset:0},
        {transform:pos(moves[i]),offset:.16},
        {transform:pos(near),offset:.37},
        {transform:pos(meet[i]),offset:.49},
        {transform:pos(meet[i]),offset:.60},
        {transform:pos(recoil),offset:.69},
        {transform:pos(finishAt[i]),offset:1}];
    }else{
      const centerward={x:clamp(centerX+(i===0?-s.size*.62:s.size*.62)+(rand(35)-17),0,s.maxX),
        y:clamp(impactY+(rand(15)-7),0,s.maxY)};
      f=[{transform:pos(initial[i]),offset:0},
        {transform:pos(moves[i]),offset:.21},
        {transform:pos(centerward),offset:.57},
        {transform:pos(finishAt[i]),offset:1}];
    }
    try{anims.push(c.animate(f,{duration:duration,easing:'linear',fill:'forwards'}));}catch(e){}
  });
  // Each cube tumbles independently while its parent travels the shared table.
  dice.forEach((d,i)=>{
    const sx=(rand(2)?1:-1)*(360+360*rand(2)),
          sy=(rand(2)?1:-1)*(360+360*rand(2)),n=nums[i];
    const from=d.style.transform||pose(5);
    const frames=[
      {transform:from,offset:0},
      {transform:`rotateX(${sx*.38}deg) rotateY(${sy*.38}deg)`,offset:.37},
      {transform:`rotateX(${sx*.53}deg) rotateY(${sy*.54}deg)`,offset:.54},
      {transform:`rotateX(${sx*.72}deg) rotateY(${sy*.76}deg)`,offset:.71},
      {transform:`rotateX(${sx+ROT[n][0]+TILT_X}deg) rotateY(${sy+ROT[n][1]+TILT_Y}deg)`,offset:1}];
    try{anims.push(d.animate(frames,{duration:duration,easing:'cubic-bezier(.2,.6,.2,1)',fill:'forwards'}));}catch(e){}
  });
  table.addEventListener('click',finish);
  setTimeout(finish,duration+45);
}
window.TSCMSDiceyUpgrade={roll,secure:!!(window.crypto && typeof window.crypto.getRandomValues==='function')};
})();

/* Dicey Discovery v4 — scene builder ONLY. Existing approved crypto dice controller
   continues deciding faces and member selection. No new audio / no new post links. */
(function(){
'use strict';
var section=document.getElementById('diceSection');
if(!section||section.classList.contains('dicey-v4'))return;
var table=document.getElementById('diceTable'),button=document.getElementById('diceBtn');
if(!table||!button||!window.TSCMSDiceyUpgrade)return;
function elem(cl){var e=document.createElement('div');e.className=cl;return e}
var world=elem('dicey-v4-world'),sign=elem('dicey-v4-sign'),felt=elem('dicey-v4-felt'),plaque=elem('dicey-v4-plaque');
world.appendChild(sign);world.appendChild(felt);world.appendChild(plaque);
section.insertBefore(world,section.querySelector('.dice-kicker')||section.firstChild);
felt.appendChild(table);plaque.appendChild(button);
section.classList.add('dicey-v4');
window.dispatchEvent(new Event('resize'));
table.setAttribute('aria-label','Roll two real six-sided carved-wood dice. Tap to skip animation.');
button.setAttribute('aria-label','Roll the Dice — discover a TSCMS member Facebook post');

})();
