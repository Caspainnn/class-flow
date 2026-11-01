'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8');let writes=0,received;
const field={textContent:'',scrollIntoView(){},classList:{toggle(){}}};
const context=vm.createContext({$:()=>field,document:{getElementById:()=>field},endpoint:()=>'/outline',api:async(url,value)=>{writes++;received=value;return {id:'one',minutes:5,outline:value};}});
vm.runInContext("let outlineViewing=false;let current={id:'one',minutes:5,outline:{objective:'Original',sections:[{title:'One',minutes:5,description:'Original'}]}},outlineDraft={taskId:'one',value:JSON.parse(JSON.stringify(current.outline))};"+source.slice(source.indexOf('function outlineEditing()'),source.indexOf('function durationLabel(')),context);
(async()=>{
 vm.runInContext("outlineDraft.value.sections=[{title:'Title | with separator',minutes:'2',description:'Line one\\nLine two | unchanged'},{title:'New section',minutes:'4',description:'Independent content'}]",context);
 assert.equal(await vm.runInContext('saveOutlineDraft()',context),false);assert.equal(writes,0);
 vm.runInContext("outlineDraft.value.sections[1].minutes='3'",context);assert.equal(await vm.runInContext('saveOutlineDraft()',context),true);assert.equal(writes,1);assert.equal(received.sections.length,2);assert.equal(vm.runInContext('outlineViewing',context),true);assert.equal(received.sections[0].description,'Line one\nLine two | unchanged');assert.equal(vm.runInContext('outlineDraft',context),null);
 vm.runInContext("outlineDraft={taskId:current.id,value:JSON.parse(JSON.stringify(current.outline))}",context);assert.equal(await vm.runInContext('saveOutlineDraft()',context),true);assert.equal(writes,1);
 console.log('PASS: structured editing, validation and multiline content preserved; unchanged outline does not invalidate the existing PPT');
})().catch(e=>{console.error(e);process.exitCode=1;});
