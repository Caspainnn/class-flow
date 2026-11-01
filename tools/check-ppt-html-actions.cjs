'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8');let click,work,calls=[];
const fields={htmlReviewed:{checked:true},changeText:{value:'Make the example clearer'}};
const ctx=vm.createContext({document:{addEventListener(name,handler){if(name==='click')click=handler;}},$:id=>fields[id],perform:fn=>{work=Promise.resolve().then(fn);},isDirty:()=>false,outlineDirty:()=>false,workflowSteps:()=>({active:vm.runInContext('outlineViewing',ctx)?3:4}),endpoint:()=>'/run',api:async(url,body)=>{calls.push(body);return {id:'task',status:'running',htmlVersions:[{number:2}]};},render(){},htmlData:()=>({number:2})});
vm.runInContext("let current={id:'task'},step=3,outlineDraft=null,outlineViewing=false,showHtmlPreview=false,selectedHtmlVersion=null,selectedPage=0;"+source.slice(source.indexOf('function outlineEditing()'),source.indexOf('function outlineDirty()'))+source.slice(source.indexOf("document.addEventListener('click'"),source.indexOf("$('modal').addEventListener")),ctx);
async function action(a){click({target:{closest:()=>({dataset:{action:a}})},preventDefault(){}});await work;}
(async()=>{
 await action('confirm-outline');assert.equal(calls.at(-1).phase,'html');
 await action('confirm-html');assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify({phase:'export',htmlVersion:2,approved:true}));
 await action('html-change');assert.equal(calls.at(-1).phase,'html-modify');assert.equal(calls.at(-1).page,1);
 await action('view-html');assert.equal(vm.runInContext('showHtmlPreview',ctx),true);await action('run-status');assert.equal(vm.runInContext('showHtmlPreview',ctx),false);
 const count=calls.length;vm.runInContext("current={id:'task',status:'html-ready',outline:{objective:'Learn',sections:[]}};step=3",ctx);await action('back');assert.equal(vm.runInContext('outlineEditing()',ctx),false);assert.equal(vm.runInContext('outlineViewing',ctx),true);assert.equal(calls.length,count);await action('back');assert.equal(vm.runInContext('step',ctx),2);assert.equal(vm.runInContext('outlineDraft',ctx),null);
 console.log('PASS: outline, direct explicit export of current version, page changes and run-status navigation');
})().catch(e=>{console.error(e);process.exitCode=1;});
