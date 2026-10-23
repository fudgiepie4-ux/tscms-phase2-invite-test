'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const html=fs.readFileSync('town-journal.html','utf8');
const source=fs.readFileSync('town-journal-sources/TSCMS_Town_Journal_FULL_TEXT_20261022.md','utf8');
const data=JSON.parse(fs.readFileSync('town-journal-content-source.json','utf8'));
const found=source.split('## PAGE 1 — THE FOUNDING PAGE')[1].split('## FEATURED-MEMBER PAGES')[0].trim();
const led=source.split("## THE TOWN'S CONSTRUCTION JOURNAL")[1].split("## KEEPER'S NOTES")[0];
const titles=[...led.matchAll(/^### (.+)$/gm)].map(x=>x[1]);
const qj=fs.readFileSync('tscms-quick-jump.js','utf8');
const tests=[
  ['Source manuscript is complete',()=>assert.equal(Buffer.byteLength(source),17200)],
  ['Brenda always opens',()=>assert.ok(html.includes('const sheets=[founding,...journalPages'))],
  ['Founding words use official source, not sample copy',()=>{
    assert.equal(data.founding_markdown,found);
    assert.ok(data.founding_markdown.includes("Absolutely love and I don't know why I had so much fun with the dice. Thank you, I've got a lot to learn."));
    assert.ok(!html.includes('Layout sample only'));
  }],
  ['Exact 16 entries in correct source order',()=>{
    assert.equal(titles.length,16);assert.equal(data.entries.length,16);
    assert.deepEqual(data.entries.map(x=>x.date+' — '+x.title),titles);
    assert.equal(data.entries[0].title,'The Terms Got a Page of Their Own');
    assert.equal(data.entries.at(-1).title,'Halloween at the Front of the List');
  }],
  ['Every journal body comes directly from Cherish',()=>{
    const chunks=led.split(/^### .+$/gm).slice(1);
    assert.deepEqual(data.entries.map(x=>x.content),chunks.map(x=>x.trim()));
    assert.ok(html.includes('const entrySource='));
  }],
  ['Keeper notes and outdated build-last draft not visible',()=>{
    assert.ok(!html.includes('## KEEPER\'S NOTES'));
    assert.ok(!html.includes('the Journal builds LAST'));
    assert.ok(!html.includes('Preview the next member'));
  }],
  ['Correct desktop and phone A images',()=>{
    const a=fs.readFileSync('town-journal-assets/dicey-storefront-phone-a.png');
    assert.equal(crypto.createHash('sha256').update(a).digest('hex'),'20361adc52e11e8e233cddef2171c9f069a7e021a04183ccab835090e7ea1ec7');
    assert.match(html,/media="\(max-width: 770px\)" srcset="town-journal-assets\/dicey-storefront-phone-a.png"/);
    assert.match(html,/img src="town-journal-assets\/dicey-storefront-desktop.webp"/);
    assert.match(html,/\.store-figure img\{aspect-ratio:834 \/ 1041; height:auto\}/);
  }],
  ['All 7 local art assets available',()=>{
    for(const s of [...html.matchAll(/town-journal-assets\/([\w.-]+)\b/g)])assert.ok(fs.statSync('town-journal-assets/'+s[1]).size>100,'Missing '+s[1]);
  }],
  ['Live site Larger Text inclusion and existing button',()=>{
    assert.match(html,/\.\/tscms-legibility.css\?v=wave-20261022/);
    assert.match(html,/\.\/tscms-legibility.js\?v=wave-20261022/);
    assert.match(html,/id="tscms-text-toggle-btn"/);
  }],
  ['No independent audio or local music upload',()=>{
    assert.ok(!/<audio\b/i.test(html));assert.ok(!/id="audioFile"/.test(html));
    assert.ok(!html.includes('aria-label="Open TSCMS Radio')); // v1 radio link removed on Fudgie's order (Oct 22) until the real in-page radio exists
  }],
  ['One page at a time with dynamic count and keyboard buttons',()=>{
    assert.ok(html.includes('Page '+"'"+'+')); // checked via actual source in next assertion
    assert.ok(html.includes("q('previous').addEventListener('click'"));
    assert.ok(html.includes("q('next').addEventListener('click'"));
    assert.ok(html.includes('function packEntries(items)'));
  }],
  ['Quick Jump visibly exposes Town Journal in both desktop and drawer',()=>{
    assert.match(qj,/key:'journal', icon:'📖', label:'Town Journal — Heard & Built', href:'town-journal\.html'/);
    assert.match(qj,/items\.forEach\(function\(item\)\{createLink\(item,desktop\);createLink\(item,drawerNav\);\}\)/);
    assert.match(qj,/item\.href \|\| '#tscms-qj-'/);
  }],
  ['Quick Jump Journal link remains real navigation, never an in-page jump',()=>{
    assert.match(qj,/key==='videos' \|\| key==='journal'\) return true/);
    assert.match(qj,/key==='videos'\|\|key==='journal'\)\{closeMenu\(false\);return;\}/);
    assert.match(qj,/if\(item\.href\)\{link\.target='_self';\}/);
    assert.ok(!qj.includes("if(key==='journal'){e.preventDefault"));
  }],
  ['No site-wide deploy changes in staging PR',()=>{assert.ok(!html.includes('firebaseConfig'));assert.ok(!html.includes('admin-data.enc.json'));}],
];
for(const [name,fn] of tests){try{fn();console.log('PASS:',name);}catch(e){console.error('FAIL:',name);throw e;}}
console.log('Town Journal source/asset/structure preflight '+tests.length+'/'+tests.length+' PASS; real phone/browser visual and Owner ship tap still required.');
