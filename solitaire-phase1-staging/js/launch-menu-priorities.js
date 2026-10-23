/* TSCMS Gamehouse — Clara's isolated four-item menu integration candidate.
 * 2026-10-18. No production changes, no developer/debug controls.
 * Only the launch priorities: theme, timer, help, back to saloon.
 * The existing engine owns gameplay and the next new deal's settings.
 */
(function () {
  'use strict';
  function el(id){ return document.getElementById(id); }
  function prefs(){
    if (typeof SessionManager === 'undefined') return null;
    return SessionManager.getPrefs() || SessionManager.defaultPrefs();
  }
  function status(message){const node=el('launch-settings-status');if(node)node.textContent=message;}
  function setChoice(id,selected){
    const node=el(id);if(!node)return;
    node.classList.toggle('selected',selected);
    node.setAttribute('aria-pressed',selected?'true':'false');
  }
  function paint(){
    const p=prefs(); if(!p)return;
    const theme=p.theme==='halloween'?'halloween':'classic';
    const timer=p.timerMode==='relaxed'?'relaxed':'stopwatch';
    const stage=el('stage');if(stage)stage.dataset.gamehouseTheme=theme;
    setChoice('launch-theme-classic',theme==='classic');
    setChoice('launch-theme-halloween',theme==='halloween');
    setChoice('launch-timer-stopwatch',timer==='stopwatch');
    setChoice('launch-timer-relaxed',timer==='relaxed');
  }
  function savePreference(key,value){
    if(typeof SessionManager==='undefined')return false;
    const p=prefs();if(!p)return false;
    p[key]=value;
    const ok=SessionManager.savePrefs(p);
    if(ok)paint();
    return ok;
  }
  function closeMenu(){
    const menu=el('menu');if(!menu)return;
    menu.setAttribute('hidden',''); menu.style.display='none';
    const open=el('btn-menu'); if(open)open.focus();
  }
  function openHelp(){
    const help=el('launch-help');const menu=el('menu'); if(!help||!menu)return;
    menu.setAttribute('hidden','');menu.style.display='none';
    help.removeAttribute('hidden');
    const back=el('launch-help-back');if(back)back.focus();
  }
  function closeHelp(){
    const help=el('launch-help');const menu=el('menu'); if(!help)return;
    help.setAttribute('hidden','');
    if(menu){menu.removeAttribute('hidden');menu.style.display='block';}
    const opener=el('launch-how-to-play');if(opener)opener.focus();
  }
  function init(){
    const menu=el('menu'),panel=menu&&menu.querySelector('.panel');
    if(!menu||!panel)return;
    panel.classList.add('launch-menu-panel');
    [['launch-theme-classic','theme','classic'],
     ['launch-theme-halloween','theme','halloween'],
     ['launch-timer-stopwatch','timerMode','stopwatch'],
     ['launch-timer-relaxed','timerMode','relaxed']]
      .forEach(([id,key,value])=>{const node=el(id);if(!node)return;
        node.addEventListener('click',()=>{
          if(savePreference(key,value))status((key==='theme'?'Theme':'Timer')+' saved for next new game.');
          else status('Could not save that setting. Please try again.');
        });
      });
    const back=el('launch-back-to-saloon');if(back)back.addEventListener('click',closeMenu);
    const help=el('launch-how-to-play');if(help)help.addEventListener('click',openHelp);
    const helpBack=el('launch-help-back');if(helpBack)helpBack.addEventListener('click',closeHelp);
    const layer=el('launch-help');if(layer)layer.addEventListener('click',e=>{if(e.target===layer)closeHelp();});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&layer&&!layer.hasAttribute('hidden')){e.preventDefault();closeHelp();}
    });
    setTimeout(paint,0);
    document.addEventListener('game:new',paint);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
