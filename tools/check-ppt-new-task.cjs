'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8');
let click,work,rendered=0;const fields=new Map();
const context=vm.createContext({$:id=>fields.get(id)||null,location:{hash:''},endpoint:()=>'/task',api:async(url,value)=>url.includes('/connection')?{ready:false}:{id:'saved',...value,files:[],versions:[],feedback:[],status:'draft'},render:()=>rendered++,stopPoll(){},document:{addEventListener(name,handler){if(name==='click')click=handler;}},perform:fn=>{work=Promise.resolve().then(fn);}});
vm.runInContext('let current=null,outlineDraft=null,outlineViewing=false,templateReview=null,step=1,viewEpoch=0,connection={};'+source.slice(source.indexOf('function outlineEditing()'),source.indexOf('function durationLabel('))+source.slice(source.indexOf('function draft(){'),source.indexOf('async function fileValue('))+source.slice(source.indexOf('function startNew(){'),source.indexOf('function askSave(')),context);
vm.runInContext(source.slice(source.indexOf("document.addEventListener('click'"),source.indexOf("$('modal').addEventListener")),context);
(async()=>{
 assert.equal(vm.runInContext('isDirty()',context),false);assert.equal(vm.runInContext('outlineEditing()',context),false);
 click({target:{closest:()=>({disabled:false,dataset:{action:'new'}})},preventDefault(){}});await work;
 assert.equal(rendered,1);assert.equal(vm.runInContext('current.status',context),'draft');assert.equal(vm.runInContext('step',context),1);
 fields.set('requirements',{});fields.set('pageCountError',{});for(const [key,value] of Object.entries({title:'',audience:'',minutes:'45',pageCount:'',content:'',course:'',style:'清晰简洁，适合投影',extra:''}))fields.set(key,{value,removeAttribute(){},setAttribute(){},focus(){}});
 assert.equal(vm.runInContext('isDirty()',context),false);fields.get('title').value='New lesson';assert.equal(vm.runInContext('isDirty()',context),true);
 for(const pageCount of ['0','151','2.5']){fields.get('pageCount').value=pageCount;const before=rendered;for(const action of ['save','save-leave']){click({target:{closest:()=>({disabled:false,dataset:{action}})},preventDefault(){}});await work;assert.equal(rendered,before);assert.equal(fields.get('title').value,'New lesson');assert.equal(vm.runInContext('current.title',context),'');}}fields.get('pageCount').value='';
 fields.get('audience').value='Grade 7';fields.get('content').value='Synthetic lesson';assert.equal(await vm.runInContext('saveForm(true)',context),true);assert.equal(vm.runInContext('step',context),2);assert.equal(vm.runInContext('current.title',context),'New lesson');assert.equal(vm.runInContext('isDirty()',context),false);
 fields.clear();vm.runInContext("current=null;outlineDraft=null",context);assert.equal(vm.runInContext('isDirty()',context),false);
 vm.runInContext("current={id:'saved',outline:{objective:'Old',sections:[]}};outlineDraft={taskId:'saved',value:{objective:'Changed',sections:[]}}",context);assert.equal(vm.runInContext('isDirty()',context),true);
 console.log('PASS: actual New button from empty list, new wizard defaults, unsaved requirement/outline protection, return to list');
})().catch(error=>{console.error(error);process.exitCode=1;});
