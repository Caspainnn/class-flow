'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const stored=new Map();let failSave=false;
function boot(){
 const elements=new Map(),events={};
 const make=()=>({value:'',textContent:'',dataset:{},children:[],classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},focus(){},addEventListener(){},append(child){this.children.push(child);},replaceChildren(){this.children=[];},querySelector(){return this.children.at(-1);},showModal(){this.open=true;},close(){this.open=false;}});
 const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const buttons=type=>(type==='module'?el('catalog'):el('subfunctions')).children.filter(b=>b.dataset?.[type]);
 const context=vm.createContext({window:{addEventListener:(k,fn)=>events[k]=fn},document:{getElementById:el,createElement:make,createTextNode:text=>({textContent:text}),querySelectorAll:s=>s==='[data-id]'?buttons('id'):s==='[data-module]'?buttons('module'):[]},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,v)=>{assert.match(key,/prototype/);if(failSave)throw Error('test quota');stored.set(key,v);}},setTimeout:()=>1,clearTimeout(){},location:{}});
 vm.runInContext(fs.readFileSync('prototype/workbuddy-prompts-data.js','utf8'),context);vm.runInContext(fs.readFileSync('prototype/workbuddy-prompts.js','utf8'),context);
 return {el,events,run:code=>vm.runInContext(code,context),select:id=>buttons('id').find(b=>b.dataset.id===id).onclick(),module:id=>buttons('module').find(b=>b.dataset.module===id).onclick(),type:text=>{el('prompt').value=text;el('prompt').oninput();}};
}
const record=()=>JSON.parse(stored.get('inclass.prototype.workbuddy-module-settings.v2'));
let ui=boot();assert.equal(ui.run('catalog.length'),11);assert.equal(ui.el('title').textContent,'批改作业');assert.equal(ui.el('model').value,'default');assert.equal(ui.el('timeout').value,'60');
ui.type('测试批改要求');ui.el('timeout').value='90';ui.el('save').onclick();assert.equal(record().prompts.grade,'测试批改要求');assert.equal(record().parameters.grade.timeout,90);ui=boot();assert.equal(ui.el('prompt').value,'测试批改要求');assert.equal(ui.el('timeout').value,'90');
ui.module('ppt');ui.type('封面草稿');ui.select('outline');assert.notEqual(ui.el('confirm').open,true,'same module child switch must preserve drafts without modal');ui.type('大纲草稿');ui.select('cover');assert.equal(ui.el('prompt').value,'封面草稿');ui.el('save').onclick();assert.equal(record().prompts.cover,'封面草稿');assert.equal(record().prompts.outline,'大纲草稿');assert.equal(record().prompts.grade,'测试批改要求');
ui.type('未保存');ui.module('connection');assert.equal(ui.el('confirm').open,true);ui.el('keep').onclick();assert.equal(ui.el('title').textContent,'PPT管理');ui.module('connection');ui.el('confirmAction').onclick();assert.equal(ui.el('business').hidden,true);ui.module('ppt');assert.equal(ui.el('prompt').value,'封面草稿');
ui.el('reset').onclick();ui.el('confirmAction').onclick();assert.match(ui.el('prompt').value,/每条不超过16字/);assert.equal(record().prompts.cover,'封面草稿');ui.el('save').onclick();assert.equal(record().prompts.cover,undefined);assert.equal(record().prompts.outline,'大纲草稿','restoring one prompt must not erase siblings');
ui.module('lesson');ui.type('无变量');ui.el('save').onclick();assert.match(ui.el('error').textContent,/课时分钟/);ui.type('   ');ui.el('save').onclick();assert.match(ui.el('error').textContent,/空白/);ui.type('x'.repeat(20001));ui.el('save').onclick();assert.match(ui.el('error').textContent,/20000/);
ui.type('保留{{课时分钟}}分钟');failSave=true;ui.el('save').onclick();assert.match(ui.el('storageError').textContent,/保存失败/);assert.equal(ui.el('prompt').value,'保留{{课时分钟}}分钟');failSave=false;ui.el('save').onclick();assert.equal(record().prompts.lesson,'保留{{课时分钟}}分钟');
ui.type('尚未保存');let protectedUnload=false;ui.events.beforeunload({preventDefault:()=>protectedUnload=true});assert.ok(protectedUnload);ui.module('grade');ui.el('confirmAction').onclick();ui.el('timeout').value='0';ui.el('save').onclick();assert.match(ui.el('parameterError').textContent,/1至7200/);
assert.ok(!fs.readFileSync('prototype/workbuddy-prompts.js','utf8').includes('fetch('));
console.log('PASS: module navigation, shared parameters and prompts, child drafts, atomic module save/reload, per-module isolation, default restore, validation, storage failure and unload guards.');
