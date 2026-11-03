'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createServer}=require('./preview-ppt-outline.cjs');
const source=fs.readFileSync(path.join(__dirname,'../prototype/ppt-outline-layout.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../prototype/ppt-outline-layout.html'),'utf8');
const script=new vm.Script(source);
function fixture(saved){
 const nodes=new Map(),events={},windowEvents={};let storage=saved||null;
 function el(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,open:false,disabled:false,classList:{toggle(){}},listeners:{},querySelector:el,focus(){},setAttribute(){},removeAttribute(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener:(name,fn)=>el(selector).listeners[name]=fn});return nodes.get(selector);}
 const document={getElementById:el,addEventListener:(name,fn)=>events[name]=fn};
 const context={document,window:{addEventListener:(name,fn)=>windowEvents[name]=fn},localStorage:{getItem:key=>{assert.equal(key,'inclass.prototype.outline-layout.v1');return storage;},setItem:(key,value)=>{assert.equal(key,'inclass.prototype.outline-layout.v1');storage=value;}},setTimeout:()=>1,clearTimeout(){}};
 script.runInNewContext(context);
 const click=(action,page,id)=>events.click({target:{closest:selector=>selector==='[data-demo-nav]'?null:{dataset:{action,page:String(page),layout:id}}},preventDefault(){}});
 const input=(name,value)=>events.input({target:{name,value,closest:()=>true,removeAttribute(){}}});
 const submit=()=>events.submit({target:{matches:()=>true,querySelector:el},preventDefault(){}});
 return {el,click,input,submit,events,windowEvents,saved:()=>JSON.parse(storage)};
}
const f=fixture();
assert.equal((f.el('outlinePages').innerHTML.match(/<article /g)||[]).length,6);
assert.doesNotMatch(f.el('outlinePages').innerHTML,/选择理由|布局用途|结构示意 · 非最终页面/);
assert.match(f.el('outlineTotal').textContent,/20 \/ 20/);
f.click('choose',1);assert(f.el('layoutPicker').open);
assert.equal((f.el('layoutOptions').innerHTML.match(/class="prototype-layout-option"/g)||[]).length,6);
f.click('pick',1,'image');assert.match(f.el('layoutDetail').innerHTML,/左文右图/);
f.click('close-picker');assert(!f.el('layoutPicker').open);assert.match(f.el('outlinePages').innerHTML,/双栏对比/);
f.click('choose',1);f.click('pick',1,'image');f.click('apply-layout');assert.equal(f.saved()[1].layout,'image');
f.click('edit',1);f.input('title','修改后的风险标题');f.input('content','已输入的教学内容不能丢失');
f.click('choose',1);f.click('pick',1,'three');f.click('apply-layout');
assert.match(f.el('outlinePages').innerHTML,/修改后的风险标题/);assert.match(f.el('outlinePages').innerHTML,/已输入的教学内容不能丢失/);assert.equal(f.saved()[1].layout,'image');
f.submit();assert.equal(f.saved()[1].layout,'three');assert.equal(f.saved()[1].title,'修改后的风险标题');
f.click('edit',1);f.input('title','不应保存的标题');f.click('cancel-edit');assert(f.el('discardDialog').open);
f.click('keep-editing');f.click('choose',1);f.click('apply-layout');assert.match(f.el('outlinePages').innerHTML,/不应保存的标题/);
f.click('cancel-edit');f.click('discard');assert(!f.el('discardDialog').open);assert(!f.el('outlinePages').innerHTML.includes('不应保存的标题'));
f.click('edit',2);f.input('minutes','-1');f.submit();assert.match(f.el('.prototype-field-error').textContent,/时长/);assert.equal(f.el('.prototype-field-error').hidden,false);
f.input('minutes','4.1');f.submit();assert.match(f.el('.prototype-field-error').textContent,/0.5/);
f.input('minutes','4');f.input('title','   ');f.submit();assert.match(f.el('.prototype-field-error').textContent,/标题/);
f.input('title','恢复标题');f.input('content','   ');f.submit();assert.match(f.el('.prototype-field-error').textContent,/内容/);
f.click('confirm');assert.match(f.el('toast').textContent,/请先保存/);
f.click('cancel-edit');f.click('discard');f.click('confirm');assert.match(f.el('toast').textContent,/不会启动实际课件制作/);
for(const i of [0,5]){f.click('choose',i);assert.equal((f.el('layoutOptions').innerHTML.match(/class="prototype-layout-option"/g)||[]).length,1);assert(f.el('[data-action="apply-layout"]').disabled);f.click('close-picker');}
const restored=fixture(JSON.stringify(f.saved()));assert.match(restored.el('outlinePages').innerHTML,/修改后的风险标题/);
const unsafe=f.saved();unsafe[1].title='<img src=x onerror=alert(1)>';unsafe[1].content='</textarea><script>alert(1)</script>';
assert(!fixture(JSON.stringify(unsafe)).el('outlinePages').innerHTML.includes('<img src=x'));
unsafe[1].layout='cover';assert.match(fixture(JSON.stringify(unsafe)).el('outlinePages').innerHTML,/两类常见风险/);
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(source));
assert(!/ppt\.js|shell\.js|window\.openai|Tweak/.test(source+html));
assert.doesNotMatch(html,/仅为结构示意，非最终课件页面/);
assert(html.includes('../shell.css')&&html.includes('../ppt.css'));
(async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/prototype/ppt-outline-layout.html');assert.equal(page.status,200);assert(page.headers.get('content-security-policy').includes("connect-src 'none'"));
  for(const url of ['/prototype/ppt-outline-layout.js','/prototype/ppt-outline-layout.css','/shell.css','/assets/logo.svg','/ppt.css','/ppt-management.css','/narrow'])assert.equal((await fetch(base+url)).status,200,url);
  for(const url of ['/api/ppt/tasks','/api/gb/settings','/data/settings.json','/server/server.js','/prototype/ppt-update.html'])assert.equal((await fetch(base+url)).status,404,url);
  assert.equal((await fetch(base+'/prototype/ppt-outline-layout.html',{method:'POST',body:'{}'})).status,405);
  const head=await fetch(base+'/prototype/ppt-outline-layout.html',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }finally{await new Promise(resolve=>server.close(resolve));}
 if(process.argv[2]){
  const base=new URL(process.argv[2]).origin,page=await fetch(base+'/prototype/ppt-outline-layout.html');
  assert.equal(page.status,200);assert.equal(await page.text(),html);assert(page.headers.get('content-security-policy').includes("connect-src 'none'"));
  for(const ref of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert.equal((await fetch(new URL(ref[1],base+'/prototype/ppt-outline-layout.html'))).status,200,ref[1]);
  assert.equal((await fetch(base+'/prototype/ppt-outline-layout.html',{method:'HEAD'})).status,200);
  assert.equal((await fetch(base+'/prototype/ppt-outline-layout.html',{method:'POST',body:'{}'})).status,405);
  assert.equal((await fetch(base+'/api/ping')).status,200);
 }
 console.log('PASS: outline layout selection, edit/save/cancel, preserved drafts, validation, role-only layouts, browser storage, escaped text; shared website styles; static preview routes, no APIs or writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
