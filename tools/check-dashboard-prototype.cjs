'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fields=new Map(),listeners={};
function el(s){if(!fields.has(s))fields.set(s,{value:({'#course':'all','#term':'all','#period':'30','#from':'2026-10-01','#to':'2026-10-31'}[s]||''),hidden:false,innerHTML:'',textContent:'',classList:{toggle(){}},setAttribute(){},addEventListener(n,f){listeners[s+n]=f;},showModal(){this.open=true;},close(){this.open=false;},focus(){}});return fields.get(s);}
const ctx=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],addEventListener(){}},location:{hash:'#overview'},window:{addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console});
vm.runInContext(fs.readFileSync('prototype/dashboard.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.match(el('#content').innerHTML,/课程教学概况/);
for(const section of ['classroom','homework','survey','resources','courses'])assert.ok(el('#content').innerHTML.includes('id="'+section+'"'));
assert.ok(!fs.readFileSync('prototype/dashboard.html','utf8').includes('class="tabs"'));
for(const tab of ['overview','classroom','homework','survey','resources']){ctx.location.hash='#'+tab;run('render()');assert.ok(el('#content').innerHTML.length>500,tab);assert.ok(!el('#content').innerHTML.includes('NaN'));}
assert.equal(run('SESSIONS.every(x=>new Date(x.date).toISOString().slice(0,10)===x.date)'),true);
el('#course').value='empty';run('render()');assert.match(el('#content').innerHTML,/暂无活动/);
el('#course').value='ai';el('#period').value='7';assert.equal(run('scope().sessions.every(x=>x.courseId==="ai"&&x.date>="2026-10-25")'),true);
el('#term').value='2025';assert.equal(run('scope().courses.length'),0);
el('#period').value='custom';el('#from').value='2026-11-02';el('#to').value='2026-11-01';run('render()');assert.equal(el('#dateError').hidden,false);
assert.equal(run('pct(0,0)'), '—');
console.log('PASS: unified page with all sections, no category tabs, filtered fixtures, valid dates, empty states and zero denominator');
