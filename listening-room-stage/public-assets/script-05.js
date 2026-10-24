
/* ===== DICEY DISCOVERY ENGINE (production) ===== */
const DICE_PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const DICE_ROT={1:[0,0],2:[0,180],3:[0,-90],4:[0,90],5:[-90,0],6:[90,0]};
let dicePool=[], diceRolling=false;
const DICE_LS='tscms_discovered_v1';
const DISCOVERY_DATA={"pool":[{"member":"Dallas Tieking","member_id":"dallas tieking","title":"We've Got Enough","artist":"pccowboy","suno":"https://suno.com/s/VP4ixObnRp76kfdC","stream":"https://cdn1.suno.ai/70286efb-fd7f-4eef-a075-4e150d4b8556.mp4","post_url":"https://facebook.com/groups/1410002804113962/permalink/1649154843532089/","song_id":"1649154843532089","excerpt":"Sometimes we don't know when we have enough."},{"member":"David Lynn","member_id":"david lynn","title":"Ain't in a hurry ","artist":"David Lynn ","suno":"https://suno.com/s/n0VVhIr2NEo8WcTy","stream":"https://cdn1.suno.ai/62734d9f-fd09-4bf3-8b59-3e49c3bfa7b5.mp4","post_url":"https://facebook.com/groups/1410002804113962/permalink/1649115690202671/","song_id":"1649115690202671","excerpt":"Hey Y'all this is my new song . This is \" Ain't in a hurry \""},{"member":"Brian Hawkeye Ketchum","member_id":"brian hawkeye ketchum","title":"I'm Homesick for Both","artist":"Brian Ketchum","suno":"https://suno.com/s/GYBzvJaBORiAUFTS","stream":"https://cdn1.suno.ai/eec8bffd-1d26-44c3-b52c-ba620e64b080.mp4","post_url":"https://facebook.com/groups/1410002804113962/permalink/1649018873545686/","song_id":"1649018873545686","excerpt":"**I'M HOMESICK FOR BOTH** Written by Brian Ketchum \u2764\ufe0f Hey everyone! I wanted to share ano"},{"member":"The Dave Hewens Project","member_id":"the dave hewens project","title":"Just Let Her Go","artist":"davehewensproject","suno":"https://suno.com/s/m42GOdhi9bdKO7yX","stream":"https://cdn1.suno.ai/2cc16354-d84a-4908-9286-7ebd620ed0aa.mp4","post_url":"https://facebook.com/groups/1410002804113962/permalink/1647872466993660/","song_id":"1647872466993660","excerpt":"My latest effort. Enjoy!"},{"member":"Jason J Lyte","member_id":"jason j lyte","title":"The Cotton Don't Care","artist":"jason lyte","suno":"https://suno.com/s/2cFw0i2eNFAIpSoZ","stream":"https://cdn1.suno.ai/969e40e9-3447-40ea-9aee-6d9d5209dadc.mp4","post_url":"https://facebook.com/groups/1410002804113962/permalink/1647757543671819/","song_id":"1647757543671819","excerpt":""},{"member":"Gary Clardy","member_id":"gary clardy","title":"Truth Don't Wear a Hood","artist":"GWCDawg","suno":"https://suno.com/s/rRKO30e6zVFxF7fU","stream":"https://cdn1.suno.ai/3c883f5b-fccf-453e-a62c-5ed852ed115e.mp4","post_url":"https://facebook.com/groups/1410002804113962/permalink/1647475993699974/","song_id":"1647475993699974","excerpt":"\u201cWhite Hood, Black Hood\u201d is a song about looking past the outside and taking an honest loo"},{"member":"Joe Vuono","member_id":"joe vuono","title":"","artist":"","suno":"https://suno.com/s/T8T34CcR3zKdM5oA","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646999960414244/","song_id":"1646999960414244","excerpt":"This one\u2019s different than what I normally do. Here I\u2019"},{"member":"Craig Mytton","member_id":"craig mytton","title":"","artist":"","suno":"https://suno.com/s/FlqOpEMInWNBNNR2","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646767497104157/","song_id":"1646767497104157","excerpt":"True story."},{"member":"Alisha Collins","member_id":"alisha collins","title":"","artist":"","suno":"https://suno.com/s/09LX3sueTwBjKnSc","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646736127107294/","song_id":"1646736127107294","excerpt":"This is the sequel to Hel's Showdown. Dark country mix with gothic metal."},{"member":"Jenna Alexander","member_id":"jenna alexander","title":"","artist":"","suno":"https://suno.com/s/TUemaDiBtFsjGcFr","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646836820430558/","song_id":"1646836820430558","excerpt":"Not an entry but I had to play.\ud83d\ude06 @[1629726588:2048:Zoe Titterton]"},{"member":"JC Deyah","member_id":"jc deyah","title":"","artist":"","suno":"https://suno.com/s/a1ycTTBLyRTIYR63","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646629383784635/","song_id":"1646629383784635","excerpt":"Wrote me a little ditty for party time down here in F"},{"member":"Vickie Gibson","member_id":"vickie gibson","title":"","artist":"","suno":"https://suno.com/s/hQc0RSYhuuFsBD6i","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646557407125166/","song_id":"1646557407125166","excerpt":"\ud83c\udfd4\ufe0f\u2764\ufe0f MOUNTAINS ON BOTH SIDES \u2764\ufe0f\ud83c\udfd4\ufe0f \ud83c\udfb6 Written by Vickiejo With the Blue Ridge Mountains in"},{"member":"Simon Potter","member_id":"simon potter","title":"","artist":"","suno":"https://suno.com/s/rrPYP5BhF0RlA6KM","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646418530472387/","song_id":"1646418530472387","excerpt":""},{"member":"Zaxcee Hyde","member_id":"zaxcee hyde","title":"","artist":"","suno":"https://suno.com/s/Yy5vcvlF0a1NIs6t","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1646075060506734/","song_id":"1646075060506734","excerpt":"When you get writer's block and the fourth shot of Jim's doesn't help.. i wrote about not"},{"member":"Ton Smith","member_id":"ton smith","title":"","artist":"","suno":"https://suno.com/s/oO1DqYWwvYiZukH8","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1645835567197350/","song_id":"1645835567197350","excerpt":"Here's an acoustic version of a song I wrote this from being inspired by Gin Blossoms song"},{"member":"David Chrisman","member_id":"david chrisman","title":"","artist":"","suno":"https://suno.com/s/gIZKnUuVWa9W4U8f","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1645616067219300/","song_id":"1645616067219300","excerpt":""},{"member":"Brea Butler Corcoran","member_id":"brea butler corcoran","title":"","artist":"","suno":"https://suno.com/s/AA6DVPwbVdF1Hl02","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1645537163893857/","song_id":"1645537163893857","excerpt":"Here\u2019s another personal one. \u201cMaybe One Day\u201d"},{"member":"Ryan Brodnax","member_id":"ryan brodnax","title":"","artist":"","suno":"https://suno.com/s/i6kiuwRdt3VC5iIZ","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1644799970634243/","song_id":"1644799970634243","excerpt":"I tried something a little different with this one. I"},{"member":"Isabelle Vargas Payan","member_id":"isabelle vargas payan","title":"","artist":"","suno":"https://suno.com/s/JTpnlejd8WkJ0rnu","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1644728643974709/","song_id":"1644728643974709","excerpt":"Good morning world! This is remix of one of my original songs called Common Sense. Enjoy \u2764"},{"member":"Kaitlyn Tyler","member_id":"kaitlyn tyler","title":"","artist":"","suno":"https://suno.com/s/BuPhnDWkBLrBrpgC","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1644697403977833/","song_id":"1644697403977833","excerpt":"I finally finished my song inspired by Dolly and i LOVE how it came out. I managed to sque"},{"member":"Ffs Noway","member_id":"ffs noway","title":"","artist":"","suno":"https://suno.com/s/5xsi7sqjq47UmIXj","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1644094810704759/","song_id":"1644094810704759","excerpt":"Hi Everyone Since Friday is so busy, Im starting it Right here Right now Thirsty Thurs"},{"member":"Matt Woodruff","member_id":"matt woodruff","title":"","artist":"","suno":"https://suno.com/s/fvzMDHbPeDxNKYc1","stream":"","post_url":"https://facebook.com/groups/1410002804113962/permalink/1643815784065995/","song_id":"1643815784065995","excerpt":"Underneath"}]};
function diceDiscovered(){try{return JSON.parse(localStorage.getItem(DICE_LS))||[];}catch(e){return[];}}
function diceSaveDiscovered(a){try{localStorage.setItem(DICE_LS,JSON.stringify(a));}catch(e){}}
function diceLog(ev,p){
  if(!p||!p.song_id) return;
  try{
    if(window.goatcounter&&typeof goatcounter.count==='function')
      goatcounter.count({path:'/dice/'+ev+'/'+p.song_id,event:true});
  }catch(e){}
}
function buildDice(el){
  const cls=['df1','df2','df3','df4','df5','df6'];
  for(let v=1;v<=6;v++){
    const f=document.createElement('div'); f.className='dface '+cls[v-1];
    for(let p=1;p<=9;p++){
      const s=document.createElement('span');
      s.className=DICE_PIPS[v].includes(p)?'pip':'blank';
      f.appendChild(s);
    }
    el.appendChild(f);
  }
}
function diceLoadPool(){
  dicePool=DISCOVERY_DATA.pool||[];
  diceUpdateCount();
}
function diceInit(){
  const d1=document.getElementById('die1'), d2=document.getElementById('die2');
  if(!d1||!d2) return;
  buildDice(d1); buildDice(d2);
  d1.style.transform='rotateX(-20deg) rotateY(30deg)';
  d2.style.transform='rotateX(-15deg) rotateY(-25deg)';
  diceLoadPool();
}
function diceRemaining(){
  const seen=new Set(diceDiscovered());
  return dicePool.filter(e=>!seen.has(e.member_id));
}
function diceUpdateCount(){
  const el=document.getElementById('diceCount');
  if(!el) return;
  const rem=diceRemaining().length, total=dicePool.length;
  if(!total) return;
  if(rem===0){
    diceSaveDiscovered([]);
    el.textContent=total+' voices — reshuffled, keep rolling!';
  } else {
    const n=total-rem;
    el.textContent = n===0
      ? total+' voices waiting — roll the dice!'
      : n+' '+(n===1?'voice':'voices')+' discovered so far — unlimited rolls, keep going!';
  }
}
function diceRoll(){
  if(diceRolling) return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  diceRolling=true;
  document.getElementById('diceBtn').disabled=true;
  const v1=1+Math.floor(Math.random()*6), v2=1+Math.floor(Math.random()*6);
  [['die1',v1],['die2',v2]].forEach(function(pair){
    const id=pair[0], v=pair[1];
    const el=document.getElementById(id);
    const bx=DICE_ROT[v][0], by=DICE_ROT[v][1];
    if(reduced){ el.style.transform='rotateX('+bx+'deg) rotateY('+by+'deg)'; }
    else{
      const sx=720+Math.floor(Math.random()*360)+bx;
      const sy=720+Math.floor(Math.random()*360)+by;
      el.style.transition='none'; el.style.transform='rotateX(0deg) rotateY(0deg)';
      void el.offsetWidth; el.style.transition='';
      el.style.transform='rotateX('+sx+'deg) rotateY('+sy+'deg)';
    }
  });
  let rem=diceRemaining();
  if(!rem.length && dicePool.length){
    diceSaveDiscovered([]);
    rem=diceRemaining();
  }
  const pick=rem.length?rem[Math.floor(Math.random()*rem.length)]:null;
  setTimeout(function(){
    diceRolling=false;
    document.getElementById('diceBtn').disabled=false;
    if(!pick) return;
    const seen=diceDiscovered();
    if(seen.indexOf(pick.member_id)<0){ seen.push(pick.member_id); diceSaveDiscovered(seen); }
    diceShowResult(pick);
    diceLog('roll',pick);
    diceUpdateCount();
  }, reduced?60:1600);
}
function diceShowResult(p){
  document.getElementById('diceMember').textContent=p.member;
  let songTxt;
  if(p.title) songTxt=p.title+(p.artist?' — '+p.artist:'');
  else if(p.excerpt) songTxt='“'+(p.excerpt.length>80?p.excerpt.slice(0,80)+'…':p.excerpt)+'”';
  else songTxt='Untitled Song';
  document.getElementById('diceSong').textContent='🎵 '+songTxt;
  const acts=document.getElementById('diceActions');
  let h='';
  if(p.stream) h+='<button class="btn play" data-stream="'+p.stream+'" data-suno="'+(p.suno||'')+'">▶ PLAY SONG</button>';
  else if(p.suno) h+='<a class="btn play" href="'+p.suno+'" target="_blank" rel="noopener">▶ PLAY SONG</a>';
  h+='<a class="btn post" data-dicetap="1" href="'+p.post_url+'" target="_blank" rel="noopener">❤️ VISIT POST</a>';
  if(p.suno) h+='<a class="btn post" href="'+p.suno+'" target="_blank" rel="noopener">?? SUNO</a>';
  acts.innerHTML=h;
  const tapEl=acts.querySelector('[data-dicetap]');
  if(tapEl) tapEl.addEventListener('click',function(){diceLog('tap',p);});
  const pb=acts.querySelector('[data-stream]');
  if(pb) pb.onclick=function(){dicePlay(pb.getAttribute('data-stream'),pb.getAttribute('data-suno'));};
  const r=document.getElementById('diceResult');
  r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');  r.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function dicePlay(stream,suno){
  if(window.TSCMSAudio)TSCMSAudio.requestPlay('song');
  const audio=document.getElementById('songAudio');
  if(!audio) return;
  audio.src=stream;
  audio.play().catch(function(){});
  if(typeof markPlayingRow==='function' && suno) markPlayingRow(suno);
  if(window.TSCMSClearStaticRow)window.TSCMSClearStaticRow();
  if(typeof clearDayPlaying==='function')clearDayPlaying();
  if(typeof syncDayButtons==='function')syncDayButtons();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',diceInit);
else diceInit();
