/* Swiper visual bridge — Clara's OWNER-APPROVED STAGING integration, 2026-10-18.
   STAGING QA ONLY, NOT FOR PUBLIC DEPLOYMENT. Uses the original approved V3 sprites.
   Converts actual mischief:* DOM events into presentation only.
   Does not write game state, schedule encounters, create or move actual deck cards.
   Production acceptance remains blocked on hosted asset loading, real jukebox
   continuity, end-to-end victory, phone UX, and owner sign-off.
*/
'use strict';
const SwiperVisualBridge = (() => {
  const PREFIX = 'solitaire-phase1-staging/swiper-approved-art/';
  const CARD_ROOT = 'solitaire-phase1-staging/card-art/';
  const SAFE_CARD_ID = /^[cdhs](?:[1-9]|1[0-3])$/;
  function cardPath(artId){return SAFE_CARD_ID.test(String(artId||'')) ? CARD_ROOT+artId+'.png' : null;}
  const SAFE_POSES = new Set(['swiper_idle', 'swiper_fly', 'swiper_target',
    'swiper_hat_tip', 'swiper_scared', 'swiper_flee']);
  let installed = false, token = 0, stage = null, layer = null, ghost = null, carriedCard = null;
  let narrator = null, encounter = null;
  const timers = new Set();
  const pending = new Map(); // cancel must resolve outstanding waits, not strand promises
  const cleanupFns = [];
  function safeUrl(pose) { if (!SAFE_POSES.has(pose)) throw Error('Unapproved pose'); return PREFIX+pose+'.png'; }
  function notify(message) { if(narrator) narrator.textContent=message; }
  function makeStage() {
    stage=document.getElementById('stage');
    if(!stage) throw Error('Swiper visual bridge: stage #stage missing');
    if(!document.getElementById('swiper-visual-layer')) {
      layer=document.createElement('div'); layer.id='swiper-visual-layer';
      Object.assign(layer.style,{position:'absolute',inset:'0',zIndex:'70',pointerEvents:'none',overflow:'hidden'});
      stage.appendChild(layer);
    } else layer=document.getElementById('swiper-visual-layer');
    ghost=document.createElement('img'); ghost.id='swiper-ghost-visual';
    ghost.alt=''; ghost.setAttribute('aria-hidden','true'); ghost.decoding='async';
    Object.assign(ghost.style,{position:'absolute',width:'clamp(70px,22%,155px)',height:'auto',maxHeight:'32%',objectFit:'contain',left:'-35%',top:'35%',opacity:'0',filter:'drop-shadow(0 1px 9px rgba(94,189,255,.5))',transition:'none'});
    layer.appendChild(ghost);
    // Presentation-only clone of the exact real card identified by
    // MischiefIntegration's authoritative mischief:steal {cardId} event.
    // The engine already moved the real card; NEVER mutate or duplicate game state.
    carriedCard=document.createElement('img'); carriedCard.id='swiper-carried-card-visual';
    carriedCard.alt=''; carriedCard.setAttribute('aria-hidden','true');
    Object.assign(carriedCard.style,{position:'absolute',width:'clamp(35px,8%,65px)',height:'auto',aspectRatio:'338 / 600',objectFit:'contain',pointerEvents:'none',
      left:'-35%',top:'35%',opacity:'0',borderRadius:'3px',transform:'translate(125%,35%) rotate(-12deg)',
      filter:'drop-shadow(0 3px 5px rgba(0,0,0,.65))',transition:'none'});
    layer.appendChild(carriedCard);
    narrator=document.getElementById('swiper-visual-announcer');
    if(!narrator){narrator=document.createElement('div');narrator.id='swiper-visual-announcer';narrator.setAttribute('role','status');narrator.setAttribute('aria-live','polite');
      Object.assign(narrator.style,{position:'absolute',left:'-9999px',top:'auto'});stage.appendChild(narrator);}
  }
  function clearTimer() {for(const t of timers) clearTimeout(t);timers.clear();
    for(const resolve of pending.values()) resolve(false); pending.clear();}
  function cancel() {token++;clearTimer();encounter=null;
    if(layer)layer.style.pointerEvents='none';
    if(ghost){ghost.style.opacity='0';ghost.style.transition='none';ghost.style.left='-35%';}
    if(carriedCard){carriedCard.onload=null;carriedCard.onerror=null;
      carriedCard.style.opacity='0';carriedCard.style.transition='none';carriedCard.style.left='-35%';
      carriedCard.removeAttribute('src'); delete carriedCard.dataset.artId;
      delete carriedCard.dataset.carryReady; delete carriedCard.dataset.carryPhase;}
  }
  function wait(ms,id){return new Promise(resolve=>{
    if(id!==token){resolve(false);return;}
    const t=setTimeout(()=>{timers.delete(t);pending.delete(t);resolve(id===token);},ms);
    timers.add(t); pending.set(t,resolve);
  });}
  function pose(name){ghost.src=safeUrl(name);ghost.dataset.pose=name;}
  function move(left,top,duration=0){ghost.style.transition=duration?`left ${duration}ms ease, top ${duration}ms ease, opacity ${duration}ms ease`:'none';
    ghost.style.left=left;ghost.style.top=top;ghost.style.opacity='1';
    if(carriedCard){carriedCard.style.transition=duration?`left ${duration}ms ease, top ${duration}ms ease, opacity 80ms ease`:'none';
      carriedCard.style.left=left;carriedCard.style.top=top;}
  }
  function prepareExactCard(rec,id){
    if(!carriedCard)return false;
    const src=rec && !rec.scared && !rec.flyby && cardPath(rec.cardId);
    if(!src)return false;
    carriedCard.dataset.artId=rec.cardId;
    carriedCard.dataset.carryReady='false';
    carriedCard.onload=()=>{if(id!==token)return;carriedCard.dataset.carryReady='true';
      if(carriedCard.dataset.carryPhase==='active')carriedCard.style.opacity='1';};
    carriedCard.onerror=()=>{if(id!==token)return;carriedCard.dataset.carryReady='error';carriedCard.style.opacity='0';};
    carriedCard.src=src;
    if(carriedCard.complete && carriedCard.naturalWidth>0)carriedCard.dataset.carryReady='true';
    return true;
  }
  function targetPct(record){
    const e=record?.target;
    const id=e?.from==='tableau'?'tableau-'+e.col:e?.from==='waste'?'waste-pile':'stock-pile';
    const el=document.getElementById(id);const sr=stage.getBoundingClientRect();const b=el?.getBoundingClientRect();
    if(!b||!sr.width||!sr.height)return {x:55,y:46};
    return {x:Math.max(12,Math.min(78,Math.round((b.left+b.width/2-sr.left)/sr.width*100))),
      y:Math.max(8,Math.min(78,Math.round((b.top+b.height/2-sr.top)/sr.height*100)))};
  }
  async function show(rec) {
    cancel(); const id=token; if(!rec||!layer||!ghost)return;
    const scared=rec.scared===true;const flyby=rec.flyby===true;
    const isRealCard=prepareExactCard(rec,id);
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const target=targetPct(rec);
    const x=`${Math.max(8,target.x-12)}%`, y=`${Math.max(10,target.y-15)}%`;
    // Block board gestures during the short visual sequence, without mutating game state.
    layer.style.pointerEvents='auto';
    try {
      pose('swiper_idle');move('-25%','36%',0);ghost.style.opacity='0';
      if(reduced){ move(x,y,0);notify(scared?'Swiper was frightened by the Joker.':flyby?'Swiper flew past.':'Swiper took a card.');
        if(isRealCard){carriedCard.dataset.carryPhase='active';
          if(carriedCard.dataset.carryReady==='true')carriedCard.style.opacity='1';}
        if(!await wait(550,id))return;
      } else {
        if(!await wait(40,id))return;
        pose('swiper_fly');move(x,y,650);
        if(!await wait(650,id))return;
        pose('swiper_target');move(x,y,90);
        if(!await wait(320,id))return;
        if(scared){
          pose('swiper_scared');notify('Swiper touched a Joker and got scared!');
          if(!await wait(420,id))return;
          pose('swiper_flee');move('110%','6%',520);
          if(!await wait(560,id))return;
        } else {
          if(!flyby){
            pose('swiper_hat_tip');notify(isRealCard?'Swiper took a real card.':'Swiper made a mischief move!');
            if(isRealCard){carriedCard.dataset.carryPhase='active';
              if(carriedCard.dataset.carryReady==='true') carriedCard.style.opacity='1';}
            if(!await wait(500,id))return;
          }
          else notify('Swiper flew past!');
          pose('swiper_fly');move('120%','18%',530);
          if(!await wait(550,id))return;
        }
      }
    } finally {if(id===token)cancel();}
  }
  function event(name){return e=>{
    const d=e.detail||{};
    if(name==='mischief:strike')encounter={flyby:!!d.flyby,scared:false,target:null,cardId:null,destination:null};
    if(!encounter)return;
    if(name==='mischief:target')encounter.target=d;
    if(name==='mischief:steal')encounter.cardId=d.cardId;
    if(name==='mischief:place')encounter.destination=d;
    if(name==='mischief:burned')encounter.scared=true;
    if(name==='mischief:leave'){const rec={...encounter,scared:!!d.scared||encounter.scared,flyby:!!d.flyby||encounter.flyby};encounter=null;void show(rec);}
  };}
  function enhanceIntro(){
    const intro=document.getElementById('swiper-intro'),panel=intro?.querySelector('.panel');
    if(!panel||panel.querySelector('#swiper-approved-joker-guide'))return false;
    const img=document.createElement('img');img.id='swiper-approved-joker-guide';
    img.src=PREFIX+'approved_joker_rules.jpg';img.alt='Approved four-step Joker scare explanation and gameplay rules';
    Object.assign(img.style,{display:'block',width:'100%',height:'auto',maxHeight:'40dvh',objectFit:'contain',margin:'8px auto 12px'});
    panel.style.maxHeight='calc(100dvh - 40px)';panel.style.overflowY='auto';
    const h=panel.querySelector('h2');if(h)h.after(img);else panel.prepend(img);
    return true;
  }
  function init(){
    if(installed)return false;makeStage();installed=true;
    for(const name of ['mischief:strike','mischief:target','mischief:steal','mischief:place','mischief:burned','mischief:leave']){
      const listener=event(name);document.addEventListener(name,listener);cleanupFns.push(()=>document.removeEventListener(name,listener));
    }
    for(const id of ['btn-newgame','pause-newgame','btn-pause','btn-exit']){
      const el=document.getElementById(id);if(!el)continue;
      el.addEventListener('click',cancel,true);cleanupFns.push(()=>el.removeEventListener('click',cancel,true));
    }
    const vis=()=>{if(document.visibilityState==='hidden')cancel();};
    document.addEventListener('visibilitychange',vis);cleanupFns.push(()=>document.removeEventListener('visibilitychange',vis));
    window.addEventListener('pagehide',cancel);cleanupFns.push(()=>window.removeEventListener('pagehide',cancel));
    enhanceIntro();
    const observer=new MutationObserver(enhanceIntro);observer.observe(document.body,{childList:true,subtree:true});cleanupFns.push(()=>observer.disconnect());
    return true;
  }
  function dispose(){cancel();for(const f of cleanupFns.splice(0))f();
    layer?.remove();narrator?.remove();layer=null;ghost=null;carriedCard=null;narrator=null;stage=null;installed=false;
  }
  return {init,cancel,dispose,enhanceIntro,_test:{safeUrl,cardPath,targetPct}};
})();
