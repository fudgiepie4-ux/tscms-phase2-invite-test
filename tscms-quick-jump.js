/* TSCMS Quick Jump — public homepage navigation, October 2026.
   Standalone enhancement; never loads or exposes private Admin content. */
(function () {
  'use strict';
  function initialize() {
    var wrap = document.querySelector('.wrap');
    if (!wrap || document.getElementById('tscms-qj-bar')) return;
    var insertBefore = wrap.querySelector('.tscms-site-tabs') || wrap.firstElementChild;
    if (!insertBefore) return;

    var items = [
      {key:'admin', icon:'🔐', label:'Admin Sign In', href:'admin.html'},
      {key:'home', icon:'⌂', label:'Home'},
      {key:'gamehouse', icon:'♠', label:'TSCMS Gamehouse', href:'gamehouse.html'},
      {key:'journal', icon:'📖', label:'Town Journal — Heard & Built', href:'town-journal.html'},
      {key:'videos', icon:'🎬', label:'Submit Your Music Video — Now Open', href:'videos.html'},
      {key:'halloween', icon:'🎃', label:'Halloween Playlist'},
      {key:'dicey', icon:'🎲', label:'Dicey Discovery'},
      {key:'daily', icon:'♫', label:'Daily Songs'},
      {key:'weekly', icon:'▦', label:'Weekly Songs'},
      {key:'loved', icon:'♥', label:'Most Loved'},
      {key:'spotlight', icon:'★', label:'Monthly Spotlight'}
    ];
    // The Admin shortcut is navigation to the protected login page only.
    // Public navigation never grants Admin access or bypasses authentication.
    var bar = document.createElement('nav');
    bar.id='tscms-qj-bar';
    bar.className='tscms-qj-bar';
    bar.setAttribute('aria-label','Quick jump navigation');

    var trigger=document.createElement('button');
    trigger.type='button'; trigger.className='tscms-qj-trigger';
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.setAttribute('aria-controls','tscms-qj-drawer');
    trigger.setAttribute('aria-expanded','false');
    trigger.innerHTML='<span aria-hidden="true">☰</span> QUICK JUMP <span aria-hidden="true">★</span>';
    bar.appendChild(trigger);

    var desktop=document.createElement('div');
    desktop.className='tscms-qj-desktop';
    desktop.setAttribute('aria-label','Website sections');
    bar.appendChild(desktop);
    insertBefore.parentNode.insertBefore(bar,insertBefore);

    var shade=document.createElement('div');
    shade.id='tscms-qj-overlay';
    shade.className='tscms-qj-overlay';
    shade.hidden=true;
    document.body.appendChild(shade);

    var drawer=document.createElement('aside');
    drawer.id='tscms-qj-drawer';
    drawer.className='tscms-qj-drawer';
    drawer.setAttribute('role','dialog');
    drawer.setAttribute('aria-modal','true');
    drawer.setAttribute('aria-labelledby','tscms-qj-title');
    drawer.hidden=true;
    drawer.innerHTML='<button class="tscms-qj-close" type="button" aria-label="Close quick jump menu">×</button>'+
      '<div class="tscms-qj-hero">'+
        '<div class="tscms-qj-brand">★ THE SUNO COUNTRY MUSIC SPOT ★</div>'+
        '<h2 id="tscms-qj-title">Quick Jump</h2>'+
        '<p class="tscms-qj-tagline">Songs · Friends · Community</p>'+
      '</div>'+
      '<nav class="tscms-qj-drawer-links" aria-label="Quick jump destinations"></nav>'+
      '<div class="tscms-qj-footer" aria-hidden="true">🍁 COUNTRY MUSIC BRINGS US TOGETHER 🍂</div>';
    document.body.appendChild(drawer);
    var drawerNav=drawer.querySelector('.tscms-qj-drawer-links');
    var closeButton=drawer.querySelector('.tscms-qj-close');
    var lastFocus=null,oldOverflow='';
    var sections = {
      dicey:document.getElementById('diceSection'),
      halloween:document.querySelector('.daypanel .halloween-pin-head'),
      loved:document.querySelector('.most-loved-autumn'),
      spotlight:document.getElementById('tscms-september-spotlight-2026'),
      weekly:document.querySelector('.tabs button.tab[data-day]')?.closest('.tabs') || null,
      daily:document.querySelector('.tabs button.tab[data-day]')?.closest('.tabs') || null
    };

    function isReady(key) {
      if (key==='dicey') {
        var box=sections.dicey;
        return !!(box && !box.hidden && box.getAttribute('aria-hidden')!=='true' && getComputedStyle(box).display!=='none');
      }
      if (key==='admin' || key==='gamehouse' || key==='home' || key==='videos' || key==='journal') return true;
      if (key==='halloween') return !!(sections.halloween && sections.halloween.closest('.daypanel[id^="day-"]'));
      return !!sections[key];
    }
    function createLink(item, targetContainer) {
      var link=document.createElement('a');
      link.className='tscms-qj-link';
      link.dataset.target=item.key;
      link.href=item.href || '#tscms-qj-'+item.key;
      link.innerHTML='<span class="tscms-qj-icon" aria-hidden="true">'+item.icon+'</span><span>'+item.label+'</span>'+
        (targetContainer===drawerNav ? '<span class="tscms-qj-chevron" aria-hidden="true">›</span>' : '');
      if(item.href){link.target='_self';}
      link.hidden=!isReady(item.key);
      targetContainer.appendChild(link);
    }
    items.forEach(function(item){createLink(item,desktop);createLink(item,drawerNav);});

    function syncAvailable(){
      Array.prototype.forEach.call(document.querySelectorAll('.tscms-qj-link'),function(link){
        link.hidden=!isReady(link.dataset.target);
      });
    }
    function closeMenu(restoreFocus) {
      if(drawer.hidden) return;
      drawer.hidden=true;
      shade.hidden=true;
      trigger.setAttribute('aria-expanded','false');
      document.documentElement.style.overflow=oldOverflow;
      if(restoreFocus!==false && lastFocus && typeof lastFocus.focus==='function')lastFocus.focus();
    }
    function openMenu() {
      if(!drawer.hidden) return;
      lastFocus=document.activeElement;
      oldOverflow=document.documentElement.style.overflow;
      document.documentElement.style.overflow='hidden';
      shade.hidden=false;drawer.hidden=false;
      trigger.setAttribute('aria-expanded','true');
      syncAvailable();
      closeButton.focus();
    }
    trigger.addEventListener('click',openMenu);
    closeButton.addEventListener('click',function(){closeMenu(true);});
    shade.addEventListener('click',function(){closeMenu(true);});
    document.addEventListener('keydown',function(e){
      if(drawer.hidden) return;
      if(e.key==='Escape'){e.preventDefault();closeMenu(true);return;}
      if(e.key!=='Tab')return;
      var focusables=Array.prototype.filter.call(drawer.querySelectorAll('button,a[href]'),function(n){return !n.hidden;});
      if(!focusables.length)return;
      var first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    });

    function findCurrentDayButton() {
      var buttons=Array.prototype.slice.call(document.querySelectorAll('.tabs .tab[data-day]'));
      if(!buttons.length) return null;
      try{
        var today = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'numeric',day:'numeric'}).format(new Date());
        var current=buttons.find(function(btn){
          var s=btn.querySelector('.t-m');
          if(!s)return false;
          var left=s.textContent.trim().split('/').map(function(n){return Number(n);});
          var right=today.split('/').map(function(n){return Number(n);});
          return left[0]===right[0] && left[1]===right[1];
        });
        if(current)return current;
      }catch(e){/* Older browser: keep the active tab. */}
      return buttons.find(function(btn){return btn.classList.contains('active');})||buttons[0];
    }
    function scrollToElement(node){
      if(!node)return;
      var reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
    }
    function jump(key) {
      if(key==='home'){window.scrollTo({top:0,behavior:'smooth'});return;}
      if(key==='daily'){
        var dayButton=findCurrentDayButton();
        if(dayButton && typeof window.showDay==='function')window.showDay(Number(dayButton.dataset.day));
        scrollToElement(sections.daily);return;
      }
      if(key==='halloween'){
        var pin=sections.halloween;
        var halloweenPanel=pin && pin.closest('.daypanel[id^="day-"]');
        if(!halloweenPanel)return;
        var day=Number(halloweenPanel.id.slice(4));
        if(typeof window.showDay==='function')window.showDay(day);
        // If someone is already on the Halloween day but on a later song page,
        // return to its first page before scrolling to the pinned collection.
        var prev;
        for(var n=0;n<35;n++){
          prev=halloweenPanel.querySelector('.song-pager--top button[aria-label="Previous page of songs"]');
          if(!prev || prev.disabled)break;
          prev.click();
        }
        requestAnimationFrame(function(){scrollToElement(pin);});
        return;
      }
      if(key==='weekly'){scrollToElement(sections.weekly);return;}
      if(key==='loved'){scrollToElement(sections.loved);return;}
      if(key==='spotlight'){scrollToElement(sections.spotlight);return;}
      if(key==='dicey' && isReady('dicey')){scrollToElement(sections.dicey);}
    }
    function handleLink(e){
      var link=e.target.closest('.tscms-qj-link');
      if(!link)return;
      var key=link.dataset.target;
      if(key==='admin'||key==='gamehouse'||key==='videos'||key==='journal'){closeMenu(false);return;} // Separate site pages use normal navigation.
      e.preventDefault();
      if(!isReady(key))return;
      closeMenu(false);
      jump(key);
    }
    desktop.addEventListener('click',handleLink);
    drawerNav.addEventListener('click',handleLink);
    if(sections.dicey && window.MutationObserver){
      var observer=new MutationObserver(syncAvailable);
      observer.observe(sections.dicey,{attributes:true,attributeFilter:['hidden','aria-hidden','style']});
    }
    // Permanent Halloween shortcut beside the date tabs. It does not duplicate
    // songs or audio; it activates the day containing the existing pinned set.
    if(isReady('halloween') && sections.daily && !document.getElementById('tscms-halloween-jump')){
      var halloweenButton=document.createElement('button');
      halloweenButton.type='button';
      halloweenButton.id='tscms-halloween-jump';
      halloweenButton.className='tscms-halloween-jump';
      halloweenButton.setAttribute('aria-label','Open Halloween Favorites playlist');
      halloweenButton.innerHTML='<span class="halloween-pumpkin" aria-hidden="true">🎃</span><span class="halloween-words"><strong>HALLOWEEN PLAYLIST</strong><small>Open Halloween favorites from any day</small></span><span class="halloween-arrow" aria-hidden="true">›</span>';
      sections.daily.parentNode.insertBefore(halloweenButton,sections.daily);
      halloweenButton.addEventListener('click',function(){jump('halloween');});
    }
    // Search door (Fudgie's order, Oct 22): a plain, tappable way into Song
    // Search sitting right above the playlist, so the feature the Town
    // Journal announces is one a visitor can actually reach.
    var playlistTabs=document.querySelector('.tabs');
    if(playlistTabs && !document.getElementById('tscms-search-door')){
      if(!document.getElementById('tscms-search-door-style')){
        var searchStyle=document.createElement('style');
        searchStyle.id='tscms-search-door-style';
        searchStyle.textContent=
          '.tscms-search-door{display:flex;align-items:center;gap:12px;margin:14px auto 12px;padding:14px 18px;'+
          'background:linear-gradient(180deg,#2b1a0c,#1d1106);border:2px solid #c9a227;border-radius:14px;'+
          'color:#f7e8c3;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.35)}'+
          '.tscms-search-door:hover{border-color:#e6c34a}'+
          '.tscms-search-door:focus-visible{outline:3px solid #e6c34a;outline-offset:2px}'+
          '.tscms-search-door .sd-icon{font-size:26px;line-height:1}'+
          '.tscms-search-door .sd-words{display:flex;flex-direction:column;gap:2px;text-align:left}'+
          '.tscms-search-door .sd-main{font-size:19px;font-weight:700;letter-spacing:.2px}'+
          '.tscms-search-door .sd-sub{font-size:14px;opacity:.88}'+
          '.tscms-search-door .sd-go{margin-left:auto;font-size:22px;color:#e6c34a}'+
          '@media (max-width:600px){.tscms-search-door{padding:12px 14px}.tscms-search-door .sd-main{font-size:17px}}';
        document.head.appendChild(searchStyle);
      }
      var searchDoor=document.createElement('a');
      searchDoor.id='tscms-search-door';
      searchDoor.className='tscms-search-door';
      searchDoor.href='tscms-search.html';
      searchDoor.setAttribute('aria-label','Song Search — search for a musician or song');
      searchDoor.innerHTML='<span class="sd-icon" aria-hidden="true">🔎</span>'+
        '<span class="sd-words"><span class="sd-main">Search for a musician or song</span>'+
        '<span class="sd-sub">Search the station\u2019s verified songs — every one plays.</span></span>'+
        '<span class="sd-go" aria-hidden="true">›</span>';
      playlistTabs.parentNode.insertBefore(searchDoor,playlistTabs);
    }
    syncAvailable();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
  else initialize();
})();


/* TSCMS Oct 2026 approved autumn art: genuine image + clickable, keyboard-accessible hotspots.
   Safe fallback: if the approved image hasn't been uploaded yet, original UI stays active. */
(function(){
'use strict';
var artwork='assets/tscms-autumn-public-links.webp';
function mountAutumnNavigation(){
  if(document.getElementById('tscms-autumn-nav'))return;
  var tabs=document.querySelector('.wrap .tscms-site-tabs');
  var game=document.querySelector('.wrap .saloon-playnow');
  if(!tabs||!game)return;
  var preflight=new Image();
  preflight.onload=function(){
    if(document.getElementById('tscms-autumn-nav'))return;
    var style=document.createElement('style');
    style.id='tscms-autumn-nav-style';
    style.textContent=[
      'body.tscms-autumn-nav-ready .wrap #tscms-qj-bar,',
      'body.tscms-autumn-nav-ready .wrap .tscms-site-tabs,',
      'body.tscms-autumn-nav-ready .wrap .saloon-playnow{display:none!important}',
      '.tscms-autumn-nav{position:relative;width:100%;margin:10px 0 16px;aspect-ratio:1448/1086;overflow:hidden}',
      '.tscms-autumn-nav img{display:block;width:100%;height:auto;aspect-ratio:1448/1086}',
      '.tscms-autumn-nav .tscms-autumn-hotspot{position:absolute;display:block;box-sizing:border-box;',
      'border:2px solid transparent;border-radius:12px;background:transparent;color:transparent;',
      'text-decoration:none;cursor:pointer;padding:0;-webkit-tap-highlight-color:rgba(255,211,147,.15)}',
      '.tscms-autumn-nav .tscms-autumn-hotspot:hover{border-color:rgba(255,226,172,.85)}',
      '.tscms-autumn-nav .tscms-autumn-hotspot:focus-visible{outline:3px solid #ffe9ae;outline-offset:-3px;',
      'background:rgba(255,209,126,.1);border-color:#ffe9ae}',
      '.tscms-autumn-nav .hotspot-quick{left:5.7%;top:2.1%;width:88.5%;height:21.2%}',
      '.tscms-autumn-nav .hotspot-group{left:3%;top:36.7%;width:31%;height:29.7%}',
      '.tscms-autumn-nav .hotspot-youtube{left:35.2%;top:36.7%;width:28.9%;height:29.7%}',
      '.tscms-autumn-nav .hotspot-public{left:65%;top:36.7%;width:31.6%;height:29.7%}',
      '.tscms-autumn-nav .hotspot-game{left:3%;top:70.3%;width:94%;height:23.4%}',
      '@media(max-width:400px){.tscms-autumn-nav .tscms-autumn-hotspot{border-radius:7px}}'
    ].join('');
    document.head.appendChild(style);
    var nav=document.createElement('section');
    nav.id='tscms-autumn-nav';
    nav.className='tscms-autumn-nav';
    nav.setAttribute('aria-label','TSCMS website quick links');
    var image=document.createElement('img');
    image.src=artwork;image.width=1448;image.height=1086;
    image.alt='';image.setAttribute('aria-hidden','true');image.decoding='async';
    nav.appendChild(image);
    function hotspot(type,cls,label,url){
      var el=document.createElement(type);
      el.className='tscms-autumn-hotspot hotspot-'+cls;
      el.setAttribute('aria-label',label);
      el.title=label;
      if(type==='a'){
        el.href=url;
        if(/^https?:/.test(url)){el.target='_blank';el.rel='noopener noreferrer'}
        else el.target='_self';
      }else el.type='button';
      nav.appendChild(el);return el;
    }
    var quick=hotspot('button','quick','Open Quick Jump navigation');
    quick.addEventListener('click',function(){
      var original=document.querySelector('#tscms-qj-bar .tscms-qj-trigger');
      if(original)original.click();
    });
    hotspot('a','group','Visit The Suno Country Music Spot Facebook Group','https://www.facebook.com/share/g/1HhNCD6FSS/');
    hotspot('a','youtube','Visit TSCMS on YouTube','https://www.youtube.com/@TSCMSLive');
    hotspot('a','public','Visit the TSCMS Facebook Public Page','https://www.facebook.com/share/19z71PkNja/');
    hotspot('a','game','Play TSCMS Gamehouse Solitaire',game.getAttribute('href')||'gamehouse.html');
    tabs.parentNode.insertBefore(nav,tabs);
    document.body.classList.add('tscms-autumn-nav-ready');
  };
  preflight.onerror=function(){/* Retain original navigation when artwork is unavailable. */};
  preflight.src=artwork;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAutumnNavigation);
else mountAutumnNavigation();
})();


/* TSCMS protected home Dubby module bootloader, October 2026 */
(function(){
  'use strict';
  function loadHomeDubby(){
    var wrap=document.querySelector('.wrap');
    if(!wrap||!wrap.querySelector('.stats')||!wrap.querySelector('.yt-banner')||!wrap.querySelector('.feat'))return;
    if(document.querySelector('link[data-tscms-preserved="home-dubby-style"]'))return;
    var style=document.createElement('link');
    style.rel='stylesheet';
    style.href='./tscms-home-dubby.css?v=20261021-1';
    style.setAttribute('data-tscms-preserved','home-dubby-style');
    style.onload=function(){
      if(document.querySelector('script[data-tscms-preserved="home-dubby"]'))return;
      var script=document.createElement('script');
      script.src='./tscms-home-dubby.js?v=20261021-1';
      script.setAttribute('data-tscms-preserved','home-dubby');
      script.async=true;
      script.onerror=function(){console.warn('TSCMS Sponsor TV module unavailable; existing statistics remain in place.');};
      document.head.appendChild(script);
    };
    style.onerror=function(){console.warn('TSCMS Sponsor TV styles unavailable; existing homepage layout preserved.');};
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadHomeDubby,{once:true});
  else loadHomeDubby();
})();
