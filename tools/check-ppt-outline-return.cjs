'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8');let click,work,rendered='',calls=[];
const field={value:'',textContent:'',focus(){},scrollIntoView(){},open:false,showModal(){this.open=true;},close(){this.open=false;},classList:{toggle(){},add(){},remove(){}}};
const ctx=vm.createContext({document:{getElementById:()=>field,querySelectorAll:()=>[],addEventListener(name,handler){if(name==='click')click=handler;}},window:{addEventListener(){}},location:{hash:''},setTimeout,clearTimeout,setInterval,clearInterval,console});
vm.runInContext(source.slice(0,source.indexOf("$('modal').addEventListener")),ctx);
vm.runInContext("render=()=>{rendered=feedbackPage();};perform=fn=>{work=Promise.resolve().then(fn);};api=async(url,value)=>{calls.push({url,value});if(value?.phase)return {...current,status:'running',run:{phase:value.phase}};return {...current,status:'outline',outline:value};};",Object.assign(ctx,{calls,rendered,work}));
// Expose render result and asynchronous click work across the VM boundary.
vm.runInContext("render=()=>{globalThis.rendered=feedbackPage();};perform=fn=>{globalThis.work=Promise.resolve().then(fn);};",ctx);
async function action(name){click({target:{closest:()=>({dataset:{action:name}})},preventDefault(){}});await ctx.work;}
function seed(status){vm.runInContext(`current={id:'test',title:'Synthetic',minutes:20,pageCount:2,status:'${status}',run:{phase:'html'},outline:{pageBased:true,objective:'Learn',sections:[{title:'One',minutes:5,description:'First page'},{title:'Two',minutes:15,description:'Second page'}]},files:[],versions:[],feedback:[]};step=3;outlineDraft=null;outlineViewing=false;`,ctx);}
(async()=>{
 for(const status of ['failed','cancelled']){
  seed(status);const before=calls.length;await action('edit-outline');assert.match(ctx.rendered,/编辑教学大纲/);await action('cancel-outline-edit');assert.match(ctx.rendered,/逐页教学大纲/);assert.match(ctx.rendered,/确认全部页面/);assert.equal(calls.length,before);assert.equal(vm.runInContext('workflowSteps().active',ctx),3);
  await action('edit-outline');assert.equal(await vm.runInContext('saveOutlineDraft()',ctx),true);vm.runInContext('render()',ctx);assert.match(ctx.rendered,/逐页教学大纲/);assert.equal(calls.length,before,'unchanged save does not start or change a task');
  await action('edit-outline');vm.runInContext("outlineDraft.value.sections[0].description='Edited content'",ctx);await action('cancel-outline-edit');assert.equal(field.open,true);await action('discard-outline');assert.match(ctx.rendered,/逐页教学大纲/);assert.equal(calls.length,before);
  await action('edit-outline');vm.runInContext("outlineDraft.value.sections[0].description='Saved content'",ctx);assert.equal(await vm.runInContext('saveOutlineDraft()',ctx),true);vm.runInContext('render()',ctx);assert.match(ctx.rendered,/Saved content/);assert.equal(calls.length,before+1);assert.ok(!calls.at(-1).value.phase);
  await action('confirm-outline');assert.equal(calls.at(-1).value.phase,'html');assert.equal(vm.runInContext('outlineViewing',ctx),false);
 }
 console.log('PASS: interrupted task cancel, unchanged save, discard and changed save all remain in outline view; only whole-outline confirmation starts generation');
})().catch(e=>{console.error(e);process.exitCode=1;});
