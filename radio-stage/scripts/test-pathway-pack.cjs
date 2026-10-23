'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const js=fs.readFileSync('tscms-pathway-pack.js','utf8');
const quick=fs.readFileSync('tscms-quick-jump.js','utf8');
const css=fs.readFileSync('tscms-pathway-pack.css','utf8');
const runtime=fs.readFileSync('tscms-public-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const today=fs.readFileSync('tscms-today.html','utf8');
let count=0;
function test(label,fn){fn();count++;console.log('PASS '+count+': '+label);}
const GROUP_URL='https://www.facebook.com/share/g/1HhNCD6FSS/';
function mount(options={}){
  const {document,window}=parseHTML('<html><head></head><body><div class="wrap"><nav class="tscms-site-tabs"></nav>'+
    '<a class="saloon-playnow" href="gamehouse.html">🎮 PLAY NOW — TSCMS GAMEHOUSE</a>'+
    '<header id="masthead">Existing header</header>'+
    '<section id="tscms-personal-note"><div id="tnLetter">Original Personal Note</div></section>'+
    '<div class="tabs" id="daily"><button class="tab" data-day="1">Fri</button></div>'+
    '<section id="existing-halloween">Existing Halloween</section>'+
    '<section id="existing-spotlight">Existing spotlight</section>'+
    '<section id="existing-dubby">Existing Dubby</section>'+
    '</div></body></html>');
  const wrap=document.querySelector('.wrap');
  if(options.hero!==false){
    const hero=document.createElement('section');hero.id='tscms-autumn-nav';
    const g=document.createElement('a');g.className='hotspot-group';g.href=GROUP_URL;
    hero.append(g);
    wrap.insertBefore(hero,wrap.firstElementChild);
  }
  if(options.quick!==false){
    const q=document.createElement('nav');q.id='tscms-qj-bar';
    const daily=document.createElement('a');daily.className='tscms-qj-link';daily.dataset.target='daily';
    daily.href='#daily';q.append(daily);wrap.prepend(q);
  }
  let clicks=0,scrolls=0;
  const dayLink=document.querySelector('#tscms-qj-bar .tscms-qj-link');
  if(dayLink)dayLink.addEventListener('click',e=>{e.preventDefault();clicks++});
  document.querySelector('.tabs').scrollIntoView=()=>{scrolls++};
  const scriptCtx={document,window,MutationObserver:window.MutationObserver,location:{pathname:options.pathname||'/'},console};
  vm.runInNewContext(js,scriptCtx,{filename:'tscms-pathway-pack.js'});
  return {document,window,wrap,counts:()=>({clicks,scrolls}),runAgain:()=>vm.runInNewContext(js,scriptCtx)};
}
test('Existing generated templates retain preserved Quick Jump loader',()=>{
  for(const html of [index,today])assert.match(html,/tscms-quick-jump\.js\?v=/);
  assert.match(quick,/script\.src='\.\x2ftscms-pathway-pack\.js\?v=20261023-additive-1'/);
  assert.match(quick,/data-tscms-preserved','pathway-pack'/);
});
test('Personal Note runtime text and placement source remain unaltered',()=>{
  assert.match(runtime,/section\.id='tscms-personal-note'/);
  assert.match(runtime,/play\.insertAdjacentElement\('afterend',section\)/);
  assert.ok(!quick.includes('tn-letter-copy'));
});
test('Exact three door titles and helper copy in order',()=>{
  const {document}=mount();
  assert.deepEqual(Array.from(document.querySelectorAll('#tscms-pathway-pack .tscms-pathway-label'),e=>e.textContent),
    ["▶ Today's Songs",'🎬 Submit Your Music Video','🔍 Search the Songs']);
  assert.deepEqual(Array.from(document.querySelectorAll('#tscms-pathway-pack .tscms-pathway-helper'),e=>e.textContent),
    ["Skip straight to today's music.",'Send it in for the Monday Night Drive-In.','Find a song — or a singer.']);
  assert.equal(document.querySelector('.tscms-pathway-tip').textContent,
    'Solitaire lives in the Gamehouse. Dicey Discovery is down in the song list.');
});
test('Pathway comes directly AFTER existing approved autumn hero',()=>{
  const {document}=mount();
  assert.equal(document.getElementById('tscms-autumn-nav').nextElementSibling.id,'tscms-pathway-pack');
});
test('Middle door goes to existing Drive-In submissions page, Search stays unchanged',()=>{
  const {document}=mount();
  assert.equal(document.querySelector('.tscms-pathway-video').getAttribute('href'),'./videos.html');
  assert.equal(document.querySelector('.tscms-pathway-search').getAttribute('href'),'tscms-search.html');
});
test('Only one Play Now in top view; original Protected Gamehouse bar is untouched',()=>{
  const {document}=mount();
  const playLinks=Array.from(document.querySelectorAll('.wrap a'))
    .filter(a=>/play now/i.test(a.textContent));
  assert.equal(playLinks.length,1);
  assert.equal(playLinks[0],document.querySelector('a.saloon-playnow'));
  assert.equal(playLinks[0].getAttribute('href'),'gamehouse.html');
  assert.equal(playLinks[0].textContent,'🎮 PLAY NOW — TSCMS GAMEHOUSE');
  assert.equal(document.querySelector('.tscms-pathway-play'),null);
});
test('Today routes through EXISTING Quick Jump day selector',()=>{
  const e=mount();
  e.document.querySelector('.tscms-pathway-today').click();
  assert.equal(e.counts().clicks,1);
});
test('Today still scrolls to songs if Quick Jump is absent',()=>{
  const e=mount({quick:false});
  e.document.querySelector('.tscms-pathway-today').click();
  assert.equal(e.counts().scrolls,1);
});
test('Exact signpost immediately AFTER Personal Note letter section',()=>{
  const {document}=mount();
  assert.equal(document.querySelector('#tscms-personal-note').nextElementSibling.id,'tscms-group-song-signpost');
  assert.equal(document.querySelector('#tscms-group-song-heading').textContent,'🎵 Want your song on TSCMS?');
  assert.equal(document.querySelector('.tscms-group-signpost-copy').textContent,
    "Post your song in our Facebook group — that's where we gather each day's music. If it's posted there, it can ride the radio right here.");
  assert.equal(document.querySelector('.tscms-group-signpost-link').textContent,'🎵 Go to the Group');
});
test('Signpost goes to EXACT same URL as the existing GROUP hotspot',()=>{
  const {document}=mount();
  assert.equal(document.querySelector('.tscms-group-signpost-link').getAttribute('href'),
    document.querySelector('.hotspot-group').getAttribute('href'));
});
test('No submission form/upload/email intake anywhere in new module',()=>{
  for(const banned of [/<form\b/i,/\bmailto:/i,/type=['"]file['"]/i,/type=['"]email['"]/i,/input\s+type/i,/<textarea/i]){
    assert.ok(!banned.test(js),'Forbidden intake token '+banned);
  }
  const {document}=mount();
  assert.equal(document.querySelectorAll('#tscms-group-song-signpost form,input,textarea').length,0);
});
test('Idempotent if module evaluated twice',()=>{
  const e=mount();e.runAgain();
  assert.equal(e.document.querySelectorAll('#tscms-pathway-pack').length,1);
  assert.equal(e.document.querySelectorAll('#tscms-group-song-signpost').length,1);
});
test('Admin route cannot mount this module',()=>{
  const e=mount({pathname:'/admin.html'});
  assert.equal(e.document.querySelector('#tscms-pathway-pack'),null);
  assert.equal(e.document.querySelector('#tscms-group-song-signpost'),null);
});
test('No approved existing homepage sections changed or moved',()=>{
  const {document}=mount();
  assert.equal(document.querySelector('#tnLetter').textContent,'Original Personal Note');
  assert.ok(document.querySelector('#existing-halloween'));
  assert.ok(document.querySelector('#existing-spotlight'));
  assert.ok(document.querySelector('#existing-dubby'));
});
test('Responsive CSS and focus-visible controls',()=>{
  assert.match(css,/@media\(max-width:660px\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/min-height:48px/);
});
new vm.Script(js);
console.log('TSCMS approved additive Pathway pack: '+count+'/'+count+' PASS');
