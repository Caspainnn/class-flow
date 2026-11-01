'use strict';
// Local VM check only: no browser, no business data, no provider calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('prototype/ppt-preparation.js','utf8');
const elements=new Map(),timers=[];
const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},focus(){},select(){},showModal(){},close(){},click(){},prepend(){},after(){}});return elements.get(id);};
const sandbox={document:{getElementById:element,addEventListener(){},querySelector:()=>element('query')},window:{addEventListener(){},matchMedia:()=>({matches:false})},location:{hash:'#list'},navigator:{clipboard:{writeText:async()=>{}}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},console,URL,Blob};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const run=code=>vm.runInContext(code,sandbox);
assert.equal(run('tasks.length'),4);
run("currentId='information'");
for(const minutes of [5,40,45,90,240]){
  run(`task().minutes=${minutes}`);
  assert.equal(run('getOutline(task()).reduce((n,x)=>n+x.minutes,0)'),minutes);
}
assert(run("promptText(task()).includes('本课主题：信息与数据')"));
assert.equal(run("esc('<img>')"),'&lt;img&gt;');
run('task().status="ready";task().confirmed=true;task().reviewed=true;task().version=2;invalidate(task())');
assert.equal(run('task().status'),'draft');assert.equal(run('task().confirmed'),false);assert.equal(run('task().reviewed'),false);assert.equal(run('task().version'),2,'upstream edits retain delivered version');
run('begin(false)');const first=timers.at(-1);
run('begin(false)');const latest=timers.at(-1);
first();assert.equal(run('task().status'),'submitting','stale run does not deliver');
latest();assert.equal(run('task().status'),'outline');
run('task().outlineRevision=0;renderFeedback()');element('outlineNote').value='增加练习';element('outlineFeedback').onsubmit({preventDefault(){}});
assert.equal(run('task().outlineRevision'),0,'recording feedback does not claim adjusted outline');
run('task().confirmed=true;begin(true)');const cancelled=timers.at(-1);
run('stopRun(task());task().status="cancelled"');cancelled();
assert.equal(run('task().status'),'cancelled','cancelled run ignores late output');
run('task().status="complete";act("confirm-cancel",{})');
assert.equal(run('task().status'),'complete','late cancel confirmation retains completed result');
run('task().status="outline";task().confirmed=true;begin(true)');timers.at(-1)();
assert.equal(run('task().status'),'complete');assert.equal(run('task().version'),3);
for(const page of [3,4]){
  run(`task().pendingChange={slide:${page},title:'changed-${page}',note:'note-${page}'};begin(true)`);
  timers.at(-1)();
}
assert.equal(run('task().changes[3].title'),'changed-3','second page change retains first page');
assert.equal(run('task().changes[4].note'),'note-4');
run("task().pendingChange={slide:3,title:'cancelled',note:'cancelled'};begin(true)");
const abandoned=timers.at(-1);run("stopRun(task());task().status='cancelled'");abandoned();
assert.equal(run('task().changes[3].title'),'changed-3','cancelled edit is not applied');
run("task().status='complete';task().selectedSlide=3;renderFeedback()");
element('changeText').oninput({target:{value:'keep my description'}});
element('changeSlide').onchange({target:{value:'4'}});
assert.equal(run('task().changeDrafts[3]'),'keep my description','switching pages retains unsent description');
assert(run("resultSide(task()).includes('id=\"changeText\"')"),'modification input is always rendered');
run("task().selectedSlide=3;task().pendingChange={slide:3,title:'submitted',note:'keep my description'};begin(true)");
timers.at(-1)();
assert.equal(run('task().changeDrafts[3]'),undefined,'successful delivery clears only submitted draft');
assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/.test(source),'no API or persistent storage');
console.log('PASS: outline timing, prompt, escaping, upstream invalidation, stale runs, cancellation race, version increment, no business API/storage');
