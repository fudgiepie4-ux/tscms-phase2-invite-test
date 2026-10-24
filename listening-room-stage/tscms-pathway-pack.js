/* TSCMS Pathway Pack — additive Oct 23 2026 owner-approved copy.
 * Preserved via the existing Quick Jump bootloader; generated catalog untouched.
 * Songs come from Facebook GROUP POSTS only: never provide an individual intake.
 */
(function(){
  'use strict';
  function init(){
    var wrap=document.querySelector('body > .wrap');
    if(!wrap || !wrap.querySelector('.tscms-site-tabs') ||
       !wrap.querySelector('a.saloon-playnow') || !wrap.querySelector('.tabs') ||
       /(?:^|\/)admin\.html$/i.test(location.pathname))return;
    if(document.getElementById('tscms-pathway-pack') ||
       document.getElementById('tscms-group-song-signpost'))return;
    var stylesheet=document.createElement('link');
    stylesheet.rel='stylesheet';
    stylesheet.href='./tscms-pathway-pack.css?v=20261023-additive-1';
    stylesheet.setAttribute('data-tscms-preserved','pathway-pack-style');
    if(!document.querySelector('link[data-tscms-preserved="pathway-pack-style"]'))document.head.appendChild(stylesheet);
    var strip=null,signpost=null,groupLink=null;
    function element(tag,cls,text){
      var e=document.createElement(tag);
      if(cls)e.className=cls;
      if(text!==undefined)e.textContent=text;
      return e;
    }
    function groupDestination(){
      var current=document.querySelector('#tscms-autumn-nav .hotspot-group');
      return current&&current.href?current.href:'https://www.facebook.com/share/g/1HhNCD6FSS/';
    }
    function makeStrip(){
      strip=element('nav','tscms-pathway');
      strip.id='tscms-pathway-pack';
      strip.setAttribute('aria-label','TSCMS music and games pathways');
      var grid=element('div','tscms-pathway-grid');
      function link(cls,label,helper,href){
        var a=element('a','tscms-pathway-door '+cls);
        a.href=href;a.target='_self';
        a.appendChild(element('strong','tscms-pathway-label',label));
        if(helper)a.appendChild(element('span','tscms-pathway-helper',helper));
        grid.appendChild(a);return a;
      }
      var today=link('tscms-pathway-today',"▶ Today's Songs",
        "Skip straight to today's music.",'#tscms-song-tabs');
      today.addEventListener('click',function(event){
        var jump=document.querySelector('#tscms-qj-bar .tscms-qj-link[data-target="daily"]');
        var tabs=wrap.querySelector('.tabs');
        if(jump && !jump.hidden){
          event.preventDefault();jump.click();
        }else if(tabs){
          event.preventDefault();tabs.scrollIntoView({
            behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
            block:'start'
          });
        }
      });
      link('tscms-pathway-video','🎬 Submit Your Music Video',
        'Send it in for the Monday Night Drive-In.','./videos.html');
      var search=link('tscms-pathway-search','🔍 Search the Songs',
        'Find a song — or a singer.','tscms-search.html');
      search.setAttribute('aria-label','🔍 Search the Songs — Find a song — or a singer.');
      strip.appendChild(grid);
      strip.appendChild(element('p','tscms-pathway-tip',
        'Solitaire lives in the Gamehouse. Dicey Discovery is down in the song list.'));
    }
    function makeSignpost(){
      signpost=element('section','tscms-group-signpost');
      signpost.id='tscms-group-song-signpost';
      signpost.setAttribute('aria-labelledby','tscms-group-song-heading');
      var heading=element('h2','tscms-group-signpost-title','🎵 Want your song on TSCMS?');
      heading.id='tscms-group-song-heading';
      var paragraph=element('p','tscms-group-signpost-copy',
        "Post your song in our Facebook group — that's where we gather each day's music. If it's posted there, it can ride the radio right here.");
      groupLink=element('a','tscms-group-signpost-link','🎵 Go to the Group');
      groupLink.href=groupDestination();
      groupLink.target='_blank';
      groupLink.rel='noopener noreferrer';
      signpost.appendChild(heading);
      signpost.appendChild(paragraph);
      signpost.appendChild(groupLink);
    }
    function place(){
      if(!strip)makeStrip();
      if(!signpost)makeSignpost();
      var hero=wrap.querySelector('#tscms-autumn-nav');
      var fallback=wrap.querySelector('header')||wrap.querySelector('a.saloon-playnow');
      var anchor=hero||fallback;
      if(anchor&&anchor.nextElementSibling!==strip)anchor.insertAdjacentElement('afterend',strip);
      var note=wrap.querySelector('#tscms-personal-note');
      if(note&&note.nextElementSibling!==signpost)note.insertAdjacentElement('afterend',signpost);
      var expectedGroup=groupDestination();
      if(groupLink.href!==expectedGroup)groupLink.href=expectedGroup;
    }
    place();
    if(window.MutationObserver){
      var observer=new MutationObserver(function(mutations){
        if(mutations.some(function(m){return m.type==='childList' && m.target===wrap;}))place();
      });
      observer.observe(wrap,{childList:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
