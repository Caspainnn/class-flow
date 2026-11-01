'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('server/public/courses.html','utf8');
const code=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].replace("window.addEventListener('hashchange',route);route();",'');
const elements={};function el(id){return elements[id]||(elements[id]={textContent:'',innerHTML:'',value:'',disabled:false,classList:{values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)}},click(){this.clicked=true}})}
const calls=[];let release;const file={name:'roster.csv',size:10,arrayBuffer:()=>new Promise(r=>release=()=>r(new ArrayBuffer(1)))};
const ctx=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},location:{hash:''},console,setTimeout,clearTimeout,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:1,skipped:0,total:1})}}});
vm.runInContext(code,ctx);vm.runInContext("draft={id:'c-pinned'};renderEditor=()=>{};refreshRoster=async id=>{if(id!=='c-pinned')throw Error('wrong context')};showImport=()=>{};bindUpload()",ctx);
el('roster').value='90002 尚未提交';el('roster').oninput();el('roster').value='';vm.runInContext('bindUpload()',ctx);assert.equal(el('roster').value,'90002 尚未提交','rerender must preserve unsaved roster');
let prevented=false;el('rosterDrop').ondragenter({preventDefault(){}});assert(el('rosterDrop').classList.values.has('dragging'));
el('rosterDrop').ondrop({preventDefault(){prevented=true},dataTransfer:{files:[file]}});assert(prevented);assert(!el('rosterDrop').classList.values.has('dragging'));assert(vm.runInContext('locked',ctx));
el('rosterDrop').onclick();assert(!el('file').clicked,'upload lock must prevent another chooser');release();
setTimeout(()=>{try{assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/students/upload');assert.equal(JSON.parse(calls[0].options.body).courseId,'c-pinned');assert(!vm.runInContext('locked',ctx));el('rosterDrop').ondrop({preventDefault(){},dataTransfer:{files:[{name:'bad.exe',size:10}]}});assert.match(el('uploadError').textContent,/xlsx/);assert.equal(calls.length,1);console.log('PASS course upload: drag/drop, shared upload API, pinned course, busy lock, invalid extension')}catch(e){console.error(e);process.exitCode=1}},20);
