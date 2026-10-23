// Dependency-free regression of the actual parser-time failure, not Firebase QA.
// Run: node scripts/test-dicey-startup.mjs [mc-source-path]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.argv[2]||'mc.js','utf8');
const html=fs.readFileSync('admin.html','utf8');
const feed=JSON.parse(fs.readFileSync('dice_stats.json','utf8'));
const ids=['mc-dice-rolls','mc-dice-taps','mc-dice-comments','mc-dice-data-status'];
assert(html.indexOf('src="mc.js?')<html.indexOf('id="apw"'));
for(const id of ids)assert.equal(html.split('id="'+id+'"').length-1,1);
function harness({ready='loading',missingPin=false,missingCard=false,response=feed,fail=null,large=false}={}){
  const elements=new Map(),events=new Map();let requests=0;
  function element(id){return {id,textContent:'placeholder',style:{},listeners:{},classList:{add(){},toggle(){}},addEventListener(type,fn){this.listeners[type]=fn;}};}
  function parse(){
    if(!missingPin)elements.set('apw',element('apw'));
    if(!missingCard)for(const id of ids)elements.set(id,element(id));
    elements.set('mc-text-toggle-btn',element('mc-text-toggle-btn'));
    elements.set('adminbody',element('adminbody'));
    elements.get('adminbody').style.display='none';
  }
  const document={readyState:ready,body:element('body'),getElementById:id=>elements.get(id)||null,
    addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};
  const context=vm.createContext({document,sessionStorage:{getItem(){return null;}},localStorage:{getItem(){return large?'1':null;}},
    fetch:async()=>{requests++;if(fail==='network')throw Error('offline');return {ok:fail!=='http',json:async()=>{if(fail==='json')throw Error('bad JSON');return response;}};},
    setTimeout,clearTimeout,console});
  context.window=context;
  if(ready!=='loading')parse();
  function run(){vm.runInContext(source,context,{filename:'mc.js'});}
  function domReady(){parse();document.readyState='interactive';for(const fn of events.get('DOMContentLoaded')||[])fn();}
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  return {run,domReady,settle,context,elements,events,get requests(){return requests;}};
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
await test('parser-time script survives missing PIN and registers Dicey exactly once',async()=>{
  const h=harness();h.run();assert.equal(h.requests,0);
  assert.equal(h.events.get('DOMContentLoaded').filter(f=>f.name==='mcLoadDiceyStats').length,1);
  assert.equal(typeof h.context.mcLoadDiceyStats,'function');
  h.domReady();await h.settle();assert.equal(h.requests,1);
  assert.equal(h.elements.get(ids[0]).textContent,String(feed.rolls_7d));
  assert.equal(h.elements.get(ids[1]).textContent,feed.tap_through_7d_pct.toFixed(1)+'%');
  assert.equal(h.elements.get(ids[2]).textContent,String(feed.attributed_7d));
  assert.match(h.elements.get(ids[3]).textContent,/snapshot.*CT/);
  let unlocks=0;h.context.unlockAdmin=()=>unlocks++;
  h.elements.get('apw').listeners.keydown({key:'Escape'});assert.equal(unlocks,0);
  h.elements.get('apw').listeners.keydown({key:'Enter'});assert.equal(unlocks,1);
  // Both real login paths only show the existing adminbody; no card replacement.
  h.elements.get('adminbody').style.display='block';await h.settle();
  assert.equal(h.requests,1);assert.equal(h.elements.get(ids[0]).textContent,String(feed.rolls_7d));
});
await test('late script after DOM ready and fresh page refresh each load once',async()=>{
  for(let i=0;i<2;i++){const h=harness({ready:'complete'});h.run();await h.settle();assert.equal(h.requests,1);assert.equal(h.elements.get(ids[0]).textContent,String(feed.rolls_7d));}
});
await test('missing PIN does not prevent Dicey startup',async()=>{
  const h=harness({missingPin:true});h.run();h.domReady();await h.settle();assert.equal(h.requests,1);
});
await test('missing card performs no request',async()=>{
  const h=harness({missingCard:true});h.run();h.domReady();await h.settle();assert.equal(h.requests,0);
});
await test('verified zeros remain zeros',async()=>{
  const h=harness({response:{...feed,rolls_7d:0,taps_7d:0,tap_through_7d_pct:0,attributed_7d:0}});
  h.run();h.domReady();await h.settle();assert.deepEqual(ids.slice(0,3).map(id=>h.elements.get(id).textContent),['0','0.0%','0']);
});
for(const fail of ['network','http','json'])await test(fail+' failure remains unavailable',async()=>{
  const h=harness({fail});h.run();h.domReady();await h.settle();assert.equal(h.requests,1);
  assert.equal(h.elements.get(ids[0]).textContent,'Data unavailable');assert.match(h.elements.get(ids[3]).textContent,/No zero has been assumed/);
});
for(const response of [{...feed,rolls_7d:null},{...feed,generated:'invalid'},{...feed,tap_through_7d_pct:101}])await test('invalid feed rejected: '+JSON.stringify(response).slice(-80),async()=>{
  const h=harness({response});h.run();h.domReady();await h.settle();assert.equal(h.elements.get(ids[0]).textContent,'Data unavailable');
});
await test('later top-level initialization is reached',async()=>{
  const h=harness({large:true});h.run();h.domReady();await h.settle();assert.equal(h.context.SIGNON_ENABLED,false);assert.match(h.elements.get('mc-text-toggle-btn').innerHTML,/Larger Text: ON/);
});
console.log(passed+' startup regression checks passed. Real authenticated acceptance is still required.');
