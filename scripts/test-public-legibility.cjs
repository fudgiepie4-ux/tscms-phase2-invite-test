'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const js=fs.readFileSync('tscms-legibility.js','utf8');
const css=fs.readFileSync('tscms-legibility.css','utf8');
const start=js.indexOf('  function scaledFontSize(base,active){');
const end=js.indexOf('  function collectAndApply(){',start);
assert.ok(start!==-1&&end>start,'Use the shipped size rule rather than a separate mock');
const ctx={};
vm.runInNewContext(js.slice(start,end)+'this.sizeRule=scaledFontSize;',ctx);
const scale=ctx.sizeRule;
const shadowStart=js.indexOf('  function subtleBoldShadow(base,active){');
const shadowEnd=js.indexOf('  function collectAndApply(){',shadowStart);
assert.ok(shadowStart>=0&&shadowEnd>shadowStart,'Test shipped subtle shadow rather than mocking it');
const shadowCtx={};
vm.runInNewContext(js.slice(shadowStart,shadowEnd)+'this.bold= subtleBoldShadow;',shadowCtx);
const subtle=shadowCtx.bold;
const tests=[
['9px labels have 12px floor',()=>assert.equal(scale(9,false),12)],
['11.5px labels have 12px floor',()=>assert.equal(scale(11.5,false),12)],
['12px labels unchanged',()=>assert.equal(scale(12,false),12)],
['14px labels unchanged when off',()=>assert.equal(scale(14,false),14)],
['18px+ headings unchanged when off',()=>assert.equal(scale(18,false),18)],
['small 9px ON-mode gains 3px above floor',()=>assert.equal(scale(9,true),15)],
['12px ON-mode gains 3px',()=>assert.equal(scale(12,true),15)],
['13px ON-mode gains 2.5px',()=>assert.equal(scale(13,true),15.5)],
['14px ON-mode gains 2.5px',()=>assert.equal(scale(14,true),16.5)],
['15px text unchanged even when ON',()=>assert.equal(scale(15,true),15)],
['18px headings unchanged even when ON',()=>assert.equal(scale(18,true),18)],
['24px headers unchanged even when ON',()=>assert.equal(scale(24,true),24)],
['approved subtle weight: ON, only <=14px original',()=>{
 assert.equal(subtle(12,true),'0.28px 0 currentColor, -0.28px 0 currentColor');
 assert.equal(subtle(14,true),'0.28px 0 currentColor, -0.28px 0 currentColor');
 assert.equal(subtle(14.01,true),null);assert.equal(subtle(18,true),null);
}],
['no boldness when OFF',()=>{assert.equal(subtle(9,false),null);assert.equal(subtle(14,false),null);}],
['paint-only text shadow, no reflow-causing weight or spacing changes',()=>{
 assert.ok(js.includes("el.style.setProperty('text-shadow',shadow,'important')"));
 assert.ok(!js.includes("el.style.setProperty('font-weight'"));
 assert.ok(!js.includes("el.style.setProperty('letter-spacing'"));
 assert.ok(js.includes("shadowComputed:"));
 assert.ok(js.includes("old.base>14?old.shadowComputed"));
}],
['no document zoom or transformation',()=>{assert.ok(!js.includes('document.body.style.zoom'));assert.ok(!js.includes('style.transform='));assert.ok(!css.includes('zoom:'));}],
['persistent preference and dynamic labels',()=>{assert.ok(js.includes("localStorage.getItem(KEY)"));assert.ok(js.includes("localStorage.setItem(KEY"));assert.ok(js.includes('MutationObserver'));}],
['non-decorative only, no text rewrites',()=>{assert.ok(js.includes('directWords(el)'));assert.ok(js.includes('[aria-hidden="true"]'));assert.ok(!js.includes('.innerHTML='));}],
['public control remains focusable',()=>{assert.ok(css.includes('min-height:44px'));assert.ok(css.includes(':focus-visible'));}],
['both real homeviews load text enhancement',()=>{for(const x of ['index.html','tscms-today.html']){let t=fs.readFileSync(x,'utf8');assert.ok(t.includes('tscms-legibility.css'));assert.ok(t.includes('tscms-legibility.js'));}}],
['Gamehouse and Drive-In also include it',()=>{for(const x of ['gamehouse.html','videos.html','public-redesign.html']){let t=fs.readFileSync(x,'utf8');assert.ok(t.includes('tscms-legibility.css'));assert.ok(t.includes('tscms-legibility.js'));}}],
['Admin is not modified by this wave',()=>{let t=fs.readFileSync('admin.html','utf8');assert.ok(!t.includes('tscms-legibility.js'));}],
['CSS engine is independent and scoped',()=>{assert.ok(css.includes('.tscms-legibility-controls'));assert.ok(!css.includes('.erow'));}]
];
let passed=0;
for(const [name,fn] of tests){try{fn();passed++}catch(e){console.error('FAIL '+name);throw e;}}
new vm.Script(js);
console.log('TSCMS Public Legibility: '+passed+'/'+tests.length+' PASS');
