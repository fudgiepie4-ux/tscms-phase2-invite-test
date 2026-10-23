/* Dicey Discovery — protected outcome-first 3D dice and saloon reveal cards.
   No PLAY, SUNO or in-site audio; the sole action is the original Facebook post.
   Loaded only after the existing public post pool validates successfully. */
(function () {
  'use strict';
  var section=document.getElementById('diceSection');
  var table=document.getElementById('diceTable');
  var button=document.getElementById('diceBtn');
  var result=document.getElementById('diceResult');
  if(!section||!table||!button||!result) return;
  var cryptoSource=window.crypto;
  var READY=!!(cryptoSource&&typeof cryptoSource.getRandomValues==='function');
  var rolling=false, lastPostKey='tscms_dicey_last_post_v3';
  var ROT={1:[0,0],2:[0,180],3:[0,-90],4:[0,90],5:[-90,0],6:[90,0]};
  function node(tag,cls,text) {
    var n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function ident(s){return String(s||'').trim().toLocaleLowerCase();}
  function randomInt(n) {
    if(!READY||!Number.isInteger(n)||n<1||n>4294967296)throw Error('Secure dice randomness unavailable');
    var max=4294967296-(4294967296%n),b=new Uint32Array(1);
    do{cryptoSource.getRandomValues(b);}while(b[0]>=max);
    return b[0]%n;
  }
  function dieFace(){return randomInt(6)+1;}
  function pick(a){return a[randomInt(a.length)];}
  function readLast(){try{return localStorage.getItem(lastPostKey)||'';}catch(e){return '';}}
  function saveLast(v){try{localStorage.setItem(lastPostKey,v);}catch(e){}}
  function safePosts(pool){
    return (pool||[]).filter(function(p){
      return p&&typeof p.member==='string'&&p.member.trim()&&
        typeof p.title==='string'&&p.title.trim()&&
        typeof p.post_url==='string'&&
        /^https:\/\/(?:www\.)?facebook\.com\/groups\/1410002804113962\/permalink\/\d+\/?$/i.test(p.post_url);
    });
  }
  function selectSongs(pool,count,bridge){
    var valid=safePosts(pool),names=Array.from(new Set(valid.map(function(p){return ident(p.member);})));
    if(names.length<count)return null;
    var seen=new Set(bridge.getSeen().map(ident).filter(function(k){return names.includes(k);}));
    var current=[],used=new Set(),last=readLast();
    for(var slot=0;slot<count;slot++) {
      var eligible=names.filter(function(k){return !seen.has(k)&&!used.has(k);});
      if(!eligible.length) {
        seen.clear(); // Everyone has had a turn; begin the next cycle.
        eligible=names.filter(function(k){return !used.has(k);});
      }
      var options=valid.filter(function(p){
        return eligible.includes(ident(p.member)) && p.post_url!==last;
      });
      if(!options.length) {
        options=valid.filter(function(p){return eligible.includes(ident(p.member));});
      }
      if(!options.length)return null;
      // Choose the voice uniformly first, then a post from that voice.
      var voice=pick(Array.from(new Set(options.map(function(p){return ident(p.member);}))));
      var post=pick(options.filter(function(p){return ident(p.member)===voice;}));
      used.add(voice);seen.add(voice);current.push(post);last=post.post_url;
    }
    return {songs:current,history:Array.from(seen),last:last};
  }
  function makeCard(p,bridge) {
    var card=node('article','dicey-v3-card');
    var member=node('div','dicey-v3-member',p.member);
    var title=node('div','dicey-v3-song',p.title);
    var link=node('a','dicey-v3-visit','❤️ VISIT FACEBOOK POST');
    link.href=p.post_url;link.target='_blank';link.rel='noopener noreferrer';
    link.addEventListener('click',function(){bridge.diceLog('tap',p);});
    card.appendChild(member);card.appendChild(title);card.appendChild(link);
    return card;
  }
  function reveal(chosen,doubles,bridge) {
    var prior=result.querySelector('.dicey-v3-output');
    if(prior)prior.remove();
    var block=node('div','dicey-v3-output');
    var head=node('div','dicey-v3-headline',doubles?'🎲 DOUBLES! TWO VOICES TO DISCOVER':'✦ YOUR DISCOVERY ✦');
    var cards=node('div','dicey-v3-cards'+(doubles?' double':''));
    chosen.songs.forEach(function(p){
      cards.appendChild(makeCard(p,bridge));
      bridge.diceLog('roll',p);
    });
    block.appendChild(head);block.appendChild(cards);
    var count=result.querySelector('#diceCount');
    result.insertBefore(block,count||result.firstChild);
    result.classList.add('show');
    result.setAttribute('role','status');
    result.setAttribute('aria-live','polite');
    bridge.saveSeen(chosen.history);
    saveLast(chosen.last);
    bridge.updateCount();
  }
  function clearBanner(){
    var b=table.querySelector('.dicey-v3-banner');if(b)b.remove();
  }
  function placeFace(die,face,x,y) {
    var r=ROT[face];
    die.style.transform='translate3d('+x+'px,'+y+'px,0) rotateX('+r[0]+'deg) rotateY('+r[1]+'deg)';
    die.setAttribute('aria-label','Die showing '+face);
  }
  function animateDice(values,finish) {
    var one=document.getElementById('die1'),two=document.getElementById('die2');
    if(!one||!two){finish();return;}
    var dice=[one,two],animations=[],done=false;
    var reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var skip=function(){complete();};
    function complete(){
      if(done)return;done=true;
      animations.forEach(function(a){try{a.cancel();}catch(e){}});
      dice.forEach(function(d,i){placeFace(d,values[i],configs[i].x,configs[i].y);});
      table.removeEventListener('click',skip);
      finish();
    }
    // Cosmetic movement only: the cryptographically selected faces are already fixed.
    var clack=randomInt(10)<4;
    var configs=dice.map(function(_,i){
      return {
        x:randomInt(23)-11,y:randomInt(11)-5,
        x1:randomInt(63)-31,y1:-(22+randomInt(20)),
        x2:clack?(i===0?27:-27):(randomInt(81)-40),
        y2:-(5+randomInt(16)),dur:860+randomInt(330),
        sx:(randomInt(2)?1:-1)*(1+randomInt(2))*360,
        sy:(randomInt(2)?1:-1)*(1+randomInt(2))*360
      };
    });
    if(reduced||!one.animate||!two.animate) {
      configs.forEach(function(c,i){placeFace(dice[i],values[i],c.x,c.y);});
      finish();return;
    }
    dice.forEach(function(d,i){
      var c=configs[i],r=ROT[values[i]];
      var from=d.style.transform||'rotateX(-20deg) rotateY(30deg)';
      try{
        var a=d.animate([
          {transform:from,offset:0},
          {transform:'translate3d('+c.x1+'px,'+c.y1+'px,0) rotateX('+(c.sx*.33)+'deg) rotateY('+(c.sy*.31)+'deg)',offset:.29},
          {transform:'translate3d('+c.x2+'px,'+c.y2+'px,0) rotateX('+(c.sx*.59)+'deg) rotateY('+(c.sy*.57)+'deg)',offset:.55},
          {transform:'translate3d('+(c.x2/2)+'px,-12px,0) rotateX('+(c.sx*.84)+'deg) rotateY('+(c.sy*.83)+'deg)',offset:.8},
          {transform:'translate3d('+c.x+'px,'+c.y+'px,0) rotateX('+(c.sx+r[0])+'deg) rotateY('+(c.sy+r[1])+'deg)',offset:1}
        ],{duration:c.dur,easing:'cubic-bezier(.22,.75,.3,1)',fill:'forwards'});
        animations.push(a);
      }catch(e){ /* The completion fallback below lands the true result. */ }
    });
    table.addEventListener('click',skip);
    setTimeout(complete,Math.max(configs[0].dur,configs[1].dur)+65);
  }
  function roll(pool,bridge){
    if(rolling)return;
    if(!READY){button.disabled=true;button.textContent='DICE TEMPORARILY UNAVAILABLE';return;}
    var doublesFaces=[dieFace(),dieFace()],doubles=doublesFaces[0]===doublesFaces[1];
    var chosen=selectSongs(pool,doubles?2:1,bridge);
    if(!chosen){ // Don't promise two distinct voices unless the source contains them.
      button.disabled=true;button.textContent='DISCOVERY POOL UNAVAILABLE';return;
    }
    rolling=true;button.disabled=true;section.setAttribute('aria-busy','true');
    result.classList.remove('show');clearBanner();
    animateDice(doublesFaces,function(){
      if(doubles){
        var b=node('div','dicey-v3-banner','🎲 DOUBLES! TWO SONGS');
        table.appendChild(b);
      }
      reveal(chosen,doubles,bridge);
      button.disabled=false;section.removeAttribute('aria-busy');rolling=false;
    });
  }
  section.classList.add('dicey-autumn-v3');
  if(!READY){button.disabled=true;button.textContent='DICE TEMPORARILY UNAVAILABLE';}
  window.TSCMSDiceyUpgrade={roll:roll,secure:READY};
})();