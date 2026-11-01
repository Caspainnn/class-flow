'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8');
let resolve,renderCount=0;const field={value:'B prompt'};
const context=vm.createContext({api:()=>new Promise(r=>resolve=r),endpoint:()=>'',render:()=>renderCount++,error:()=>{},$:()=>field});
vm.runInContext("let current={id:'a',status:'running'},actionPending=false,viewEpoch=1,selectedVersion=null,changeDrafts={};"+source.slice(source.indexOf('async function loadPrompt()'),source.indexOf('function positionCards()')),context);
(async()=>{
 const pending=vm.runInContext('refresh()',context);vm.runInContext("current={id:'b',status:'manual'};viewEpoch++",context);resolve({id:'a',status:'complete'});await pending;
 assert.equal(vm.runInContext('current.id',context),'b');assert.equal(renderCount,0);
 vm.runInContext("current={id:'a'};viewEpoch++",context);const prompt=vm.runInContext('loadPrompt()',context);vm.runInContext("current={id:'b'};viewEpoch++",context);resolve({text:'A prompt'});await prompt;assert.equal(field.value,'B prompt');
 console.log('PASS: late task progress and late manual prompt cannot overwrite the newly selected task');
})().catch(e=>{console.error(e);process.exitCode=1;});
