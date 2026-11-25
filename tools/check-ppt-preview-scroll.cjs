'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8');
let rail,selected=12,horizontal=false;
function newRail(){return {dataset:{},scrollTop:0,scrollLeft:0,clientHeight:300,clientWidth:300,getBoundingClientRect:()=>({top:100,left:40}),querySelector:()=>({getBoundingClientRect:()=>horizontal?{top:100,bottom:180,left:40+selected*100-rail.scrollLeft,right:140+selected*100-rail.scrollLeft}:{top:100+selected*100-rail.scrollTop,bottom:200+selected*100-rail.scrollTop,left:40,right:140}})};}
const view={set innerHTML(value){rail=newRail();}};
const context=vm.createContext({document:{querySelector:selector=>selector==='.deck-workspace .slide-list'?rail:null},window:{parent:{}},$:()=>view,unmountUpload(){},error(){},frame:()=>'',feedbackPage:()=>'',footer:()=>'',stopPoll(){},bind:()=>vm.runInContext('keepSelectedSlideVisible()',context)});
vm.runInContext("let current={id:'deck',status:'html-ready'},step=3,outlineViewing=false,viewEpoch=0;"+source.slice(source.indexOf('function render(){'),source.indexOf('function draft(){'))+source.slice(source.indexOf('function keepSelectedSlideVisible(){'),source.indexOf('\nfunction bind(){')),context);
for(horizontal of [false,true]){
 rail=newRail();rail.dataset.taskId='deck';rail[horizontal?'scrollLeft':'scrollTop']=1100;
 for(selected of [12,11,13]){const before=rail[horizontal?'scrollLeft':'scrollTop'];vm.runInContext('render()',context);assert.equal(rail[horizontal?'scrollLeft':'scrollTop'],before,'Clicking a visible thumbnail preserves the exact scroll position');}
 selected=20;vm.runInContext('render()',context);assert.equal(rail[horizontal?'scrollLeft':'scrollTop'],1800,'An off-screen selection scrolls only as far as needed');
 vm.runInContext("current={id:'other',status:'html-ready'}",context);selected=0;vm.runInContext('render()',context);assert.equal(rail.scrollTop,0);assert.equal(rail.scrollLeft,0);vm.runInContext("current.id='deck'",context);
}
console.log('PASS: preview rerender preserves vertical/horizontal scroll, reveals off-screen selection, and resets for another deck');
