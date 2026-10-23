'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const terms=fs.readFileSync('drive-in-terms.html','utf8');
const videos=fs.readFileSync('videos.html','utf8');
const approved=fs.readFileSync('DRIVEIN-APPROVED-TEXT-20261022.txt','utf8');
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cases=[
 ['Correct date/version header',()=>assert.ok(terms.includes('Version 1 · October 22, 2026'))],
 ['Verbatim correct approved title',()=>assert.ok(terms.includes('<h1>🎬 TSCMS Drive-In — Submission Terms</h1>'))],
 ['Real selectable terms text',()=>assert.ok(terms.includes('<article class="terms-copy"')&&!terms.includes('<img'))],
 ['All 26 source lines preserved exactly (no missing contractions)',()=>{
   const lines=approved.split('\n').filter(Boolean);assert.equal(lines.length,26);
   for(const l of lines){const phrase=l.startsWith('• ')?'<li>'+escape(l.slice(2))+'</li>':escape(l);assert.ok(terms.includes(phrase),'Missing/rewritten approved line: '+l);}
 }],
 ['Contractions have not been silently expanded',()=>{
   for(const word of ['we’ve','can’t','there’s','doesn’t','What you’re agreeing to','you’re','You’re'])assert.ok(terms.includes(word));
 }],
 ['Email addresses and original song-title placeholder unchanged',()=>{
   assert.ok(terms.includes('fudgiepie4@gmail.com'));
   assert.ok(terms.includes('TSCMS Drive-In Submission — [your song title]'));
 }],
 ['18px minimum base on screen',()=>assert.ok(terms.includes('font:18px/1.43')&&terms.includes('font-size:18px'))],
 ['Print contrast + Letter setup',()=>assert.ok(terms.includes('@media print')&&terms.includes('color:#000!important')&&terms.includes('@page{size:letter;'))],
 ['Navigation hidden from printed paper',()=>assert.ok(terms.includes('.actions{display:none!important}'))],
 ['Print Save button active',()=>assert.ok(terms.includes('onclick="window.print()"')&&!terms.includes('<button type="button" disabled'))],
 ['Approved article exposed to assistive tech',()=>assert.ok(terms.includes('aria-label="Approved Drive-In submission terms"')&&!terms.includes('id="approved-terms-copy" hidden'))],
 ['No old source-missing warning after inserting approved copy',()=>assert.ok(!terms.includes('id="missing-approved-terms"'))],
 ['CTA linked to exact published path, staging branch only',()=>{
   const p=videos.indexOf('id="drivein-submission-terms-link"'),q=videos.indexOf('<div class="steps">',p);
   assert.ok(p>0&&q>p&&q-p<400);
   assert.ok(videos.includes('<a href="./drive-in-terms.html"'));
   assert.ok(!videos.includes('id="drivein-submission-terms-link" hidden'));
 }],
 ['No fabricated approval/consent',()=>assert.ok(!terms.includes('I agree to the following'))],
 ['No accidental deployment modifications to PIN or members',()=>assert.ok(!terms.includes('admin-data.enc.json')&&!terms.includes('mcLoadDiceyStats'))]
];
for(const [name,fn] of cases){try{fn();}catch(e){console.error('FAIL: '+name);throw e;}}
console.log('Drive-In staged terms source/UI preflight: '+cases.length+'/'+cases.length+' PASS. Independent one-page print + new file-link ruling check still required.');
