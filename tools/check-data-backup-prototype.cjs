'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fields=new Map(),events={},ticks=new Map();let next=0;
function el(s){if(!fields.has(s))fields.set(s,{innerHTML:'',textContent:'',value:'normal',hidden:false,disabled:false,checked:false,open:false,showModal(){this.open=true;},close(){this.open=false;},focus(){}});return fields.get(s);}
const context=vm.createContext({document:{querySelector:el,addEventListener:(n,f)=>events[n]=f},window:{scrollTo(){},addEventListener(){},InclassUpload:{mount(){return ()=>{};}}},setInterval:f=>{ticks.set(++next,f);return next;},clearInterval:id=>ticks.delete(id),setTimeout:()=>0,clearTimeout(){},Date,console});
vm.runInContext(fs.readFileSync('prototype/data-backup.js','utf8'),context);
const run=s=>vm.runInContext(s,context),click=(a,id)=>events.click({target:{closest:()=>({dataset:{action:a,id},disabled:false})}}),finish=()=>{for(let i=0;i<8;i++)for(const f of [...ticks.values()])f();};
assert.match(el('#view').innerHTML,/创建完整备份/);
click('backup');assert.equal(run('operation'),'backup');finish();assert.equal(run('records.length'),4);assert.equal(run('operation'),null);
el('#scenario').value='busy';el('#scenario').onchange();click('backup');assert.equal(run('operation'),null);assert.equal(run('records.length'),3);
el('#scenario').value='normal';el('#scenario').onchange();click('start-restore');click('sample');click('check');assert.equal(run('step'),2);finish();assert.equal(run('checkComplete'),true);click('confirm-page');assert.equal(run('step'),3);
click('ask-restore');assert.equal(el('#dialog').open,false,'must acknowledge before confirmation');el('#ack').checked=true;el('#ack').onchange();click('ask-restore');assert.equal(el('#dialog').open,true);click('close-dialog');assert.equal(run('step'),3);assert.equal(run('operation'),null);
click('ask-restore');click('restore');assert.equal(run('operation'),'restore');assert.equal(run('step'),4);finish();assert.equal(run('result'),'success');assert.equal(run('records[0].type'),'恢复前快照');
el('#scenario').value='invalid';el('#scenario').onchange();click('start-restore');click('sample');click('check');finish();click('confirm-page');assert.equal(run('step'),2);assert.match(el('#view').innerHTML,/检查未通过/);
el('#scenario').value='restore-fail';el('#scenario').onchange();click('record-restore','b1');finish();click('confirm-page');el('#ack').checked=true;el('#ack').onchange();click('ask-restore');click('restore');finish();assert.match(el('#view').innerHTML,/已回滚/);assert.equal(run('records[0].type'),'恢复前快照');
el('#scenario').value='backup-fail';el('#scenario').onchange();click('backup');finish();assert.equal(run('records.length'),3);assert.match(el('#view').innerHTML,/空间不足/);
el('#scenario').value='empty';el('#scenario').onchange();assert.match(el('#view').innerHTML,/尚未创建备份/);click('backup');finish();assert.equal(run('records.length'),1);
console.log('PASS prototype: create, busy gate, explicit acknowledgement+confirmation, safe cancel, check failure blocks, restore success/safety snapshot, rollback, failed creation and first backup; no real service or file access');
