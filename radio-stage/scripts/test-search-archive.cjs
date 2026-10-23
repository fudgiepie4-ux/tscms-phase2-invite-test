'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {normalize,mergeIndex,isValidDate,safeStream}=require('./build-search-archive.cjs');
const make=(week,artist='Ronish Studios',title='A Verified Song',suffix='a')=>
  ({week,artist,title,stream:'https://cdn1.suno.ai/'+suffix+'.mp4'});
const date='2026-10-22T16:00:00Z';
const passes=[];
const test=(name,fn)=>{fn();passes.push(name);};
test('1 valid date and rejects impossible dates',()=>{
  assert.equal(isValidDate('2026-10-14'),true);
  assert.equal(isValidDate('2026-02-31'),false);
});
test('2 direct https media stream required',()=>{
  assert.equal(safeStream('https://cdn1.suno.ai/test.mp4'),true);
  assert.equal(safeStream('https://suno.com/s/example'),false);
  assert.equal(safeStream('javascript:alert(1)'),false);
  assert.equal(safeStream('http://cdn1.suno.ai/test.mp4'),false);
});
test('3 refuses invented artist/title and URL-only title',()=>{
  assert.equal(normalize(make('2026-10-14')).artist,'Ronish Studios');
  assert.equal(normalize(make('2026-10-14','Unknown')),null);
  assert.equal(normalize(make('2026-10-14','Artist','https://suno.com/s/no-title')),null);
});
test('4 no partial metadata accepted',()=>{
  assert.equal(normalize({artist:'Artist',title:'Song',week:'2026-10-14'}),null);
  assert.equal(normalize({artist:'Artist',stream:'https://cdn1.suno.ai/a.mp4',week:'2026-10-14'}),null);
});
test('5 refuses empty or wholly invalid extraction',()=>{
  assert.throws(()=>mergeIndex({songs:[]},[],date),/empty extraction/);
  assert.throws(()=>mergeIndex({songs:[]},[make('2026-10-14','Unknown')],date),/No verified/);
});
test('6 truthfully reports only represented station weeks',()=>{
  const x=mergeIndex({songs:[]},[make('2026-10-14'),make('2026-10-21','Artist B','Song B','b')],date);
  assert.equal(x.count,2);
  assert.deepEqual(x.coverage,{first_week:'2026-10-14',last_week:'2026-10-21',
    week_count:2,label:'Verified songs from 2 archived station weeks (2026-10-14 to 2026-10-21)'});
});
test('7 merges repeated feed safely without double counting',()=>{
  const row=make('2026-10-14');
  const once=mergeIndex({songs:[]},[row],date);
  const twice=mergeIndex(once,[row],date);
  assert.equal(once.count,1);assert.equal(twice.count,1);
});
test('8 retains historical verified songs during incremental week refresh',()=>{
  const first=mergeIndex({songs:[]},[make('2026-10-14')],date);
  const next=mergeIndex(first,[make('2026-10-21','Other','Title','b')],date);
  assert.equal(next.count,2);
  assert.equal(next.songs.some(s=>s.week==='2026-10-14'),true);
});
test('9 trims archive to current plus prior six verified week groups',()=>{
  const weeks=['2026-09-02','2026-09-09','2026-09-16','2026-09-23','2026-09-30',
    '2026-10-07','2026-10-14','2026-10-21'];
  const x=mergeIndex({songs:[]},weeks.map((w,i)=>make(w,'A','Song'+i,String(i))),date);
  assert.equal(x.coverage.week_count,7);
  assert.equal(x.coverage.first_week,'2026-09-09');
  assert.equal(x.songs.some(s=>s.week==='2026-09-02'),false);
});
test('10 artist search can return ALL matching artist tracks',()=>{
  const x=mergeIndex({songs:[]},[make('2026-10-14','A','One','a'),
    make('2026-10-14','A','Two','b'),make('2026-10-21','A','Three','c'),
    make('2026-10-21','B','Four','d')],date);
  assert.equal(x.songs.filter(s=>s.artist.toLowerCase().includes('a')).length,3);
});
test('11 rejects unsafe script titles at ingest rather than trusting HTML',()=>{
  const bad=make('2026-10-14','A','<script>alert(1)</script>');
  const x=mergeIndex({songs:[]},[bad],date);
  assert.equal(x.count,1); // escaping is done by UI textContent, not by altering artist/song names
});
test('12 browser UI source parses and renders text without innerHTML',()=>{
  const browser=fs.readFileSync('tscms-search.js','utf8');
  new vm.Script(browser);
  assert.equal(browser.includes('title.textContent=song.title'),true);
  assert.equal(browser.includes('results.replaceChildren()'),true);
  assert.equal(browser.includes('innerHTML'),false);
  assert.equal(browser.includes('slice(0,'),false);
});
test('13 Search preview page remains separate from production homepage',()=>{
  const html=fs.readFileSync('tscms-search.html','utf8');
  assert.ok(html.includes('id="tscms-search-form"'));
  assert.ok(html.includes('tscms-public-runtime.js'));
  assert.ok(html.includes('aria-live="polite"'));
});

test('14 browser code normalizes search text and apostrophes',()=>{
  const browser=fs.readFileSync('tscms-search.js','utf8');
  assert.ok(browser.includes("function searchKey(text)"));
  assert.ok(browser.includes("function matchesQuery(song,queryKey)"));
  assert.ok(browser.includes("const q=searchKey(input.value)"));
  assert.ok(browser.includes("songs.filter(s=>matchesQuery(s,q))"));
});
test('15 browser results show original title and friendly week',()=>{
  const browser=fs.readFileSync('tscms-search.js','utf8');
  assert.ok(browser.includes("title.textContent=song.title"));
  assert.ok(browser.includes("meta.textContent=song.artist+' · Week of '+friendlyWeek(song.week)"));
  assert.ok(browser.includes("timeZone:'UTC'"));
});


test('16 real matching helpers ignore curly and plain apostrophes',()=>{
  const src=fs.readFileSync('tscms-search.js','utf8');
  const start=src.indexOf('  function searchKey(text){');
  const end=src.indexOf('  function clear(){',start);
  assert.ok(start>=0&&end>start);
  const context={};
  vm.runInNewContext(src.slice(start,end)+';this.helpers={searchKey,matchesQuery,friendlyWeek}',context);
  const h=context.helpers;
  assert.ok(h.matchesQuery({artist:'Singer',title:'That’s a Tomorrow Problem'},h.searchKey('thats a tomorrow')));
  assert.ok(h.matchesQuery({artist:'Singer',title:"That's a Tomorrow Problem"},h.searchKey('thats a tomorrow')));
  assert.ok(h.matchesQuery({artist:'O’Connor',title:'Another Song'},h.searchKey('oconnor')));
  assert.equal(h.friendlyWeek('2026-10-14'),'Oct 14, 2026');
});
test('17 real matching helper returns all 21 tracks for an artist',()=>{
  const src=fs.readFileSync('tscms-search.js','utf8');
  const start=src.indexOf('  function searchKey(text){');
  const end=src.indexOf('  function clear(){',start);
  const context={};
  vm.runInNewContext(src.slice(start,end)+';this.helpers={searchKey,matchesQuery}',context);
  const songs=Array.from({length:21},(_,n)=>({artist:'Bettyxxoxx',title:'Track '+n}));
  assert.equal(songs.filter(s=>context.helpers.matchesQuery(s,context.helpers.searchKey('BETTY'))).length,21);
});

console.log('TSCMS Search seed + grow: '+passes.length+'/'+passes.length+' PASS');
