/* TSCMS public legibility: floor small informational type without zooming the page.
 * Applies only to opted-in public pages; never loaded in the signed-in Admin room.
 * Keeps all text 18px+ at its original size; leaves elements already >14px unchanged.
 */
(function(){
  'use strict';
  const KEY='tscms_large_text';
  let enabled=false;
  try{enabled=localStorage.getItem(KEY)==='1';}catch(e){}
  const tracked=new Map();
  const skipTags=new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','PATH','CANVAS','IFRAME','VIDEO','AUDIO','OPTION','TEXTAREA','SELECT']);
  let schedulePending=false;
  let toggle=null;
  function directWords(el){
    if(skipTags.has(el.tagName)||el.closest('.tscms-legibility-controls,[aria-hidden="true"],[hidden],.tscms-decorative'))return false;
    if(el.id==='tscms-text-toggle-btn')return false;
    for(const n of el.childNodes){
      if(n.nodeType===3 && /[\p{L}\p{N}]/u.test(n.nodeValue||''))return true;
    }
    return false;
  }
  function scaledFontSize(base,active){
    const minimum=Math.max(12,base);
    return active&&base<=14?minimum+(base<=12?3:2.5):minimum;
  }
  // Fudgie's phone-approved subtle weight: paint only, zero layout change.
  // No font-weight/letter-spacing/font-size adjustment is used for boldness.
  function subtleBoldShadow(base,active){
    return active&&base<=14?'0.28px 0 currentColor, -0.28px 0 currentColor':null;
  }
  function collectAndApply(){
    if(!document.body)return;
    const candidates=Array.from(document.body.querySelectorAll('*')).filter(directWords);
    // Capture every baseline BEFORE writing font sizes to prevent inherited scaling.
    const upcoming=[];
    for(const el of candidates){
      if(!el.isConnected)continue;
      let old=tracked.get(el);
      if(!old){
        const style=window.getComputedStyle(el);
        if(style.display==='none'||style.visibility==='hidden')continue;
        const px=parseFloat(style.fontSize);
        if(!Number.isFinite(px)||px<=0)continue;
        old={base:px,inline:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size'),
          shadowInline:el.style.getPropertyValue('text-shadow'),shadowPriority:el.style.getPropertyPriority('text-shadow'),
          shadowComputed:typeof style.textShadow==='string'?style.textShadow:'none'};
        tracked.set(el,old);
      }
      const target=scaledFontSize(old.base,enabled);
      upcoming.push([el,target,enabled&&old.base>14?old.shadowComputed:subtleBoldShadow(old.base,enabled),old]);
    }
    // Lock the original computed pixel size for already-large text as well.
    // This prevents em-sized headings from being unintentionally enlarged by a
    // smaller ancestor that received the accessibility text floor.
    for(const [el,target,shadow,old] of upcoming){
      el.style.setProperty('font-size',target+'px','important');
      if(shadow)el.style.setProperty('text-shadow',shadow,'important');
      else if(old.shadowInline)el.style.setProperty('text-shadow',old.shadowInline,old.shadowPriority);
      else el.style.removeProperty('text-shadow');
    }
    for(const [el] of tracked)if(!el.isConnected)tracked.delete(el);
  }
  function schedule(){
    if(schedulePending)return;
    schedulePending=true;
    window.requestAnimationFrame(()=>{schedulePending=false;collectAndApply();});
  }
  function setEnabled(next){
    enabled=!!next;
    try{localStorage.setItem(KEY,enabled?'1':'0');}catch(e){}
    // Reuse an existing public toggle instead of introducing duplicate controls.
    if(toggle){
      toggle.textContent='🔍 Larger Text: '+(enabled?'ON':'OFF');
      toggle.setAttribute('aria-pressed',String(enabled));
    }
    schedule();
  }
  function installControl(){
    toggle=document.getElementById('tscms-text-toggle-btn');
    if(toggle){
      toggle.removeAttribute('onclick');
      toggle.addEventListener('click',()=>setEnabled(!enabled));
      toggle.setAttribute('aria-pressed',String(enabled));
      toggle.textContent='🔍 Larger Text: '+(enabled?'ON':'OFF');
      return;
    }
    const bar=document.createElement('div');bar.className='tscms-legibility-controls';
    toggle=document.createElement('button');toggle.className='tscms-legibility-button';
    toggle.id='tscms-public-text-toggle';toggle.type='button';
    toggle.setAttribute('aria-label','Make small text larger');
    toggle.addEventListener('click',()=>setEnabled(!enabled));
    bar.appendChild(toggle);
    let target=document.querySelector('.wrap header');
    if(target)target.insertAdjacentElement('afterend',bar);
    else {
      target=document.querySelector('.paper-header');
      if(target)target.insertAdjacentElement('afterend',bar);
      else {
        target=document.querySelector('main');
        if(target)target.insertAdjacentElement('beforebegin',bar);
        else document.body.insertBefore(bar,document.body.firstChild);
      }
    }
    // Same initial rendering as existing toggle, but don't re-read stylesheet after applying.
    toggle.textContent='🔍 Larger Text: '+(enabled?'ON':'OFF');
    toggle.setAttribute('aria-pressed',String(enabled));
  }
  function init(){
    if(!document.body)return;
    installControl();
    collectAndApply();
    const watcher=new MutationObserver(events=>{
      // Pager, card, menu and form visibility can change after initial paint.
      // Ignore our own font-size style writes so this never loops.
      if(events.some(e=>e.type==='childList'||e.type==='attributes'))schedule();
    });
    watcher.observe(document.body,{subtree:true,childList:true,attributes:true,
      attributeFilter:['hidden','class','aria-hidden']});
    let lastWidth=window.innerWidth;
    window.addEventListener('resize',()=>{
      if(window.innerWidth===lastWidth)return;
      lastWidth=window.innerWidth;
      for(const [el,old] of tracked){
        if(!el.isConnected)continue;
        if(old.inline)el.style.setProperty('font-size',old.inline,old.priority);
        else el.style.removeProperty('font-size');
        if(old.shadowInline)el.style.setProperty('text-shadow',old.shadowInline,old.shadowPriority);
        else el.style.removeProperty('text-shadow');
      }
      tracked.clear();
      schedule();
    },{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
